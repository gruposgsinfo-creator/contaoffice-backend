/**
 * routes/sii.js
 * POST /api/sii/consultar
 *
 * Flujo:
 *  1. Recibe { empresa_id }
 *  2. Busca empresa → desencripta RUT + clave_sii
 *  3. Puppeteer: login en sii.cl → scraping F29, F22, DJ
 *  4. Retorna JSON con los tres conjuntos
 */
import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import Company     from '../models/Company.js';
import { decrypt } from '../utils/crypto.js';

const router = Router();
router.use(protect);

// Puppeteer cargado dinámicamente para no crashear si no está instalado
async function getPuppeteer() {
  try {
    const m = await import('puppeteer');
    return m.default;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────
function normRUT(rut) {
  const clean = (rut || '').replace(/\./g, '').replace(/-/g, '').trim().toUpperCase();
  return { numero: clean.slice(0, -1), dv: clean.slice(-1) };
}

async function launchBrowser() {
  const puppeteer = await getPuppeteer();
  if (!puppeteer) throw new Error('Puppeteer no disponible en este servidor.');
  return puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1280,800',
    ],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    timeout: 30000,
  });
}

async function waitAndType(page, selector, value, timeout = 8000) {
  await page.waitForSelector(selector, { timeout });
  await page.click(selector);
  await page.keyboard.selectAll();
  await page.type(selector, value, { delay: 40 });
}

// Detecta CAPTCHA en la página actual
async function hasCaptcha(page) {
  return page.evaluate(() =>
    !!(document.querySelector('iframe[src*="captcha"]') ||
       document.querySelector('.g-recaptcha') ||
       document.body?.innerText?.toLowerCase().includes('captcha'))
  );
}

// ─────────────────────────────────────────────────────────────────
// Login SII — https://zeusr.sii.cl/AUT2CNET/LoginCnet/html/index.html
// ─────────────────────────────────────────────────────────────────
async function loginSII(page, numero, dv, clave) {
  await page.goto(
    'https://zeusr.sii.cl/AUT2CNET/LoginCnet/html/index.html',
    { waitUntil: 'domcontentloaded', timeout: 30000 }
  );

  if (await hasCaptcha(page))
    throw Object.assign(new Error('El SII presenta CAPTCHA. Intenta más tarde.'), { code: 'CAPTCHA' });

  // Intentar selectores conocidos del formulario de login SII
  const rutSelectors   = ['#rutPrincipal', 'input[name="rutPrincipal"]', '#rut',   'input[name="rut"]'];
  const dvSelectors    = ['#dvPrincipal',  'input[name="dvPrincipal"]',  '#dv',    'input[name="dv"]'];
  const claveSelectors = ['#clave',        'input[name="clave"]',        '#password', 'input[type="password"]'];

  const fill = async (selectors, value) => {
    for (const sel of selectors) {
      try { await waitAndType(page, sel, value, 3000); return; } catch { /* try next */ }
    }
    throw new Error('No se encontró el campo en el formulario de login SII.');
  };

  await fill(rutSelectors, numero);
  await fill(dvSelectors, dv);
  await fill(claveSelectors, clave);

  // Enviar
  const submitSelectors = ['#bt_ingresar', 'button[type="submit"]', 'input[type="submit"]', '#botonEntrar'];
  for (const sel of submitSelectors) {
    try {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 25000 }),
        page.click(sel),
      ]);
      break;
    } catch { /* try next */ }
  }

  const body = (await page.evaluate(() => document.body?.innerText || '').catch(() => '')).toLowerCase();
  const errores = ['clave incorrecta','contraseña incorrecta','rut no existe','acceso denegado',
                   'datos incorrectos','error de autenticación','no autorizado'];
  if (errores.some(e => body.includes(e)))
    throw Object.assign(new Error('Credenciales SII incorrectas.'), { code: 'CREDENCIALES_INVALIDAS' });

  if (await hasCaptcha(page))
    throw Object.assign(new Error('El SII requiere CAPTCHA después del login.'), { code: 'CAPTCHA' });

  return page.url();
}

// ─────────────────────────────────────────────────────────────────
// Scraping F29 — últimos 12 períodos
// ─────────────────────────────────────────────────────────────────
async function scrapF29(page) {
  try {
    await page.goto(
      'https://www4.sii.cl/consdcvinternetui/views/index.html#/consulta',
      { waitUntil: 'domcontentloaded', timeout: 25000 }
    );

    // Esperar tabla o contenido relevante
    await page.waitForFunction(
      () => document.body.innerText.length > 200,
      { timeout: 15000 }
    );

    const data = await page.evaluate(() => {
      const rows = [];
      // Buscar tablas con datos de F29
      document.querySelectorAll('table tr').forEach(tr => {
        const cells = [...tr.querySelectorAll('td,th')].map(c => c.innerText.trim());
        if (cells.length >= 3) rows.push(cells);
      });
      return rows;
    });

    // Parsear filas en estructura F29
    const f29 = [];
    for (const row of data.slice(1, 13)) { // máx 12 períodos
      if (!row[0]) continue;
      const estado = detectarEstadoF29(row.join(' ').toLowerCase());
      f29.push({
        periodo:  row[0] || '',
        tipo:     row[1] || 'F29',
        estado:   estado.clave,
        estadoLabel: estado.label,
        monto:    extraerMonto(row.join(' ')),
      });
    }

    // Si no se extrajo nada, intentar scraping por texto plano
    if (!f29.length) {
      const bodyText = await page.evaluate(() => document.body.innerText);
      return parsearF29Texto(bodyText);
    }

    return f29;
  } catch (err) {
    console.warn('scrapF29 warning:', err.message);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────
// Scraping F22 — últimos 3 años
// ─────────────────────────────────────────────────────────────────
async function scrapF22(page) {
  try {
    const anioActual = new Date().getFullYear();
    const f22 = [];

    for (const anio of [anioActual - 1, anioActual - 2, anioActual - 3]) {
      try {
        await page.goto(
          `https://www4.sii.cl/consdcvinternetui/services/data/facades/consultaDeclaracionesRenta?anio=${anio}`,
          { waitUntil: 'domcontentloaded', timeout: 20000 }
        );

        const texto = await page.evaluate(() => document.body?.innerText || '');
        const estado = detectarEstadoF22(texto.toLowerCase());
        const monto  = extraerMonto(texto);

        f22.push({
          anio,
          estado:      estado.clave,
          estadoLabel: estado.label,
          resultado:   detectarResultado(texto.toLowerCase()),
          monto,
        });
      } catch {
        f22.push({ anio, estado: 'sin_datos', estadoLabel: 'Sin datos', resultado: '', monto: null });
      }
    }
    return f22;
  } catch (err) {
    console.warn('scrapF22 warning:', err.message);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────
// Scraping Declaraciones Juradas
// ─────────────────────────────────────────────────────────────────
async function scrapDJ(page) {
  try {
    await page.goto(
      'https://www4.sii.cl/djindirectainternet/secure/indexDJ.html',
      { waitUntil: 'domcontentloaded', timeout: 25000 }
    );

    await page.waitForFunction(
      () => document.body.innerText.length > 100,
      { timeout: 10000 }
    ).catch(() => {});

    const dj = await page.evaluate(() => {
      const rows = [];
      document.querySelectorAll('table tr').forEach(tr => {
        const cells = [...tr.querySelectorAll('td')].map(c => c.innerText.trim());
        if (cells.length >= 3 && cells[0]) rows.push(cells);
      });
      return rows;
    });

    return dj.slice(0, 20).map(row => ({
      folio:     row[0] || '',
      tipo:      row[1] || '',
      periodo:   row[2] || '',
      estado:    row[3] || '',
      fechaPres: row[4] || '',
    })).filter(d => d.folio || d.tipo);
  } catch (err) {
    console.warn('scrapDJ warning:', err.message);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────
// Helpers de parsing
// ─────────────────────────────────────────────────────────────────
function detectarEstadoF29(texto) {
  if (texto.includes('declarado') || texto.includes('aceptado'))
    return { clave: 'declarado',      label: 'Declarado' };
  if (texto.includes('diferencia') || texto.includes('observado') || texto.includes('rectificar'))
    return { clave: 'con_diferencia', label: 'Con diferencia' };
  if (texto.includes('pendiente') || texto.includes('no declaro') || texto.includes('no declaró'))
    return { clave: 'pendiente',      label: 'Pendiente' };
  if (texto.includes('sin movimiento') || texto.includes('sin operaciones'))
    return { clave: 'sin_movimiento', label: 'Sin movimiento' };
  return { clave: 'sin_datos', label: 'Sin datos' };
}

function detectarEstadoF22(texto) {
  if (texto.includes('aceptada') || texto.includes('presentada') || texto.includes('declarada'))
    return { clave: 'aceptada',   label: 'Aceptada' };
  if (texto.includes('observada') || texto.includes('en revisión') || texto.includes('en revision'))
    return { clave: 'observada',  label: 'Observada' };
  if (texto.includes('rectificada'))
    return { clave: 'rectificada', label: 'Rectificada' };
  if (texto.includes('pendiente') || texto.includes('no declaró') || texto.includes('no declaro'))
    return { clave: 'pendiente',  label: 'Pendiente' };
  return { clave: 'sin_datos',   label: 'Sin datos' };
}

function detectarResultado(texto) {
  if (texto.includes('devolución') || texto.includes('devolucion')) return 'devolucion';
  if (texto.includes('pago') || texto.includes('a pagar'))           return 'pago';
  if (texto.includes('sin movimiento'))                               return 'sin_movimiento';
  return '';
}

function extraerMonto(texto) {
  const match = texto.match(/\$?\s*([\d.,]+)\s*(?:pesos?|clp)?/i);
  if (!match) return null;
  const num = parseInt(match[1].replace(/[.,]/g, ''));
  return isNaN(num) ? null : num;
}

function parsearF29Texto(texto) {
  // Fallback: parsear texto plano buscando patrones de período
  const periodos = [];
  const lines = texto.split('\n').map(l => l.trim()).filter(Boolean);
  const periodoRegex = /(\d{4}[-\/]\d{2}|(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+\d{4})/i;
  for (const line of lines) {
    if (periodoRegex.test(line)) {
      const estado = detectarEstadoF29(line.toLowerCase());
      periodos.push({
        periodo:     line.match(periodoRegex)?.[0] || '',
        tipo:        'F29',
        estado:      estado.clave,
        estadoLabel: estado.label,
        monto:       extraerMonto(line),
      });
      if (periodos.length >= 12) break;
    }
  }
  return periodos;
}

// ─────────────────────────────────────────────────────────────────
// POST /api/sii/consultar
// ─────────────────────────────────────────────────────────────────
router.post('/consultar', async (req, res) => {
  const { empresa_id } = req.body;
  if (!empresa_id)
    return res.status(400).json({ error: 'empresa_id es requerido.' });

  // 1. Buscar empresa
  const empresa = await Company.findById(empresa_id);
  if (!empresa)
    return res.status(404).json({ error: 'Empresa no encontrada.' });

  // 2. Obtener credenciales desencriptadas
  const credSII = empresa.credenciales?.find(c => c.institucion === 'SII');
  const rutRaw  = credSII?.usuario || empresa.rut;
  const claveRaw = credSII
    ? decrypt(credSII.clave)
    : decrypt(empresa.clave_sii);

  if (!rutRaw || !claveRaw)
    return res.status(422).json({
      error: 'La empresa no tiene RUT o clave SII configurados.',
      code:  'SIN_CREDENCIALES',
    });

  const { numero, dv } = normRUT(rutRaw);

  let browser;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(30000);
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // 3. Login
    await loginSII(page, numero, dv, claveRaw);

    // 4. Scraping paralelo
    const [f29, f22, dj] = await Promise.all([
      scrapF29(page),
      scrapF22(page),
      scrapDJ(page),
    ]);

    await browser.close();

    // 5. Retornar resultado
    return res.json({
      empresa:  { id: empresa._id, name: empresa.name, rut: empresa.rut },
      consultado_el: new Date().toISOString(),
      f29,
      f22,
      dj,
    });

  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    console.error('SII consultar error:', err.message);

    const code = err.code || 'ERROR_SCRAPING';
    const status = code === 'CREDENCIALES_INVALIDAS' ? 401
                 : code === 'CAPTCHA'                ? 503
                 : 500;

    return res.status(status).json({ error: err.message, code });
  }
});

export default router;
