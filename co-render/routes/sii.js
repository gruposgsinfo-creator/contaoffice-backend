import { Router } from 'express';
import puppeteer from 'puppeteer';
import Company from '../models/Company.js';
import { protect } from '../middleware/auth.js';

const router = Router();

// POST /api/sii/consultar
router.post('/consultar', protect, async (req, res) => {
  const { empresa_id } = req.body;
  if (!empresa_id) return res.status(400).json({ error: 'empresa_id requerido' });

  let empresa;
  try {
    empresa = await Company.findById(empresa_id);
  } catch (e) {
    return res.status(400).json({ error: 'ID de empresa inválido' });
  }
  if (!empresa) return res.status(404).json({ error: 'Empresa no encontrada' });

  const credenciales = empresa.getClaveSII ? empresa.getClaveSII() : null;
  if (!credenciales || !credenciales.rut || !credenciales.clave_sii) {
    return res.status(400).json({ error: 'La empresa no tiene RUT o clave SII configurados' });
  }

  const { rut, clave_sii } = credenciales;

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(60000);

    // 1. Login al SII
    await page.goto('https://zeusr.sii.cl/AUT2CNET/LoginCnet/html/index.html', { waitUntil: 'networkidle2' });

    // Ingresar RUT (sin puntos, con guión)
    const rutLimpio = rut.replace(/\./g, '').replace(/[^0-9kK-]/g, '');
    const [rutCuerpo, rutDv] = rutLimpio.split('-');

    await page.type('#rutcntr', rutCuerpo || rutLimpio);
    if (rutDv) await page.type('#dv', rutDv);
    await page.type('#clave', clave_sii);
    await page.click('#bt_ingresar');
    
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});

    // Verificar si login fue exitoso
    const url = page.url();
    if (url.includes('login') || url.includes('error') || url.includes('LoginCnet')) {
      const errorMsg = await page.$eval('.error, .alerta, #error', el => el.textContent).catch(() => 'Credenciales incorrectas');
      await browser.close();
      return res.status(401).json({ error: errorMsg || 'Credenciales SII incorrectas' });
    }

    // 2. Consultar F29
    const f29Data = [];
    try {
      await page.goto('https://www4.sii.cl/consdcvinternetui/consultas/ConsultaEstadoDeclaracionesF29.html', { waitUntil: 'networkidle2', timeout: 30000 });
      await page.waitForSelector('table, .tabla-resultado, tr', { timeout: 15000 }).catch(() => {});
      
      const f29Rows = await page.evaluate(() => {
        const rows = document.querySelectorAll('table tbody tr, .tabla-resultado tr');
        const data = [];
        rows.forEach(row => {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 3) {
            data.push({
              periodo: cells[0]?.textContent?.trim() || '',
              tipo: cells[1]?.textContent?.trim() || '',
              estado: cells[2]?.textContent?.trim() || '',
              monto: cells[3]?.textContent?.trim() || ''
            });
          }
        });
        return data;
      });
      f29Data.push(...f29Rows);
    } catch (e) {
      f29Data.push({ error: 'No se pudo obtener F29: ' + e.message });
    }

    // 3. Consultar F22
    const f22Data = [];
    try {
      await page.goto('https://www4.sii.cl/consdcvinternetui/consultas/ConsultaEstadoDeclaracionesF22.html', { waitUntil: 'networkidle2', timeout: 30000 });
      await page.waitForSelector('table, .tabla-resultado, tr', { timeout: 15000 }).catch(() => {});
      
      const f22Rows = await page.evaluate(() => {
        const rows = document.querySelectorAll('table tbody tr, .tabla-resultado tr');
        const data = [];
        rows.forEach(row => {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 3) {
            data.push({
              anio: cells[0]?.textContent?.trim() || '',
              estado: cells[1]?.textContent?.trim() || '',
              resultado: cells[2]?.textContent?.trim() || '',
              monto: cells[3]?.textContent?.trim() || ''
            });
          }
        });
        return data;
      });
      f22Data.push(...f22Rows);
    } catch (e) {
      f22Data.push({ error: 'No se pudo obtener F22: ' + e.message });
    }

    // 4. Consultar Declaraciones Juradas
    const djData = [];
    try {
      await page.goto('https://www4.sii.cl/djinternetui/consultas/ConsultaDeclaracionesJuradas.html', { waitUntil: 'networkidle2', timeout: 30000 });
      await page.waitForSelector('table, .tabla-resultado, tr', { timeout: 15000 }).catch(() => {});
      
      const djRows = await page.evaluate(() => {
        const rows = document.querySelectorAll('table tbody tr, .tabla-resultado tr');
        const data = [];
        rows.forEach(row => {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 3) {
            data.push({
              folio: cells[0]?.textContent?.trim() || '',
              tipo: cells[1]?.textContent?.trim() || '',
              periodo: cells[2]?.textContent?.trim() || '',
              estado: cells[3]?.textContent?.trim() || '',
              fecha: cells[4]?.textContent?.trim() || ''
            });
          }
        });
        return data;
      });
      djData.push(...djRows);
    } catch (e) {
      djData.push({ error: 'No se pudo obtener declaraciones juradas: ' + e.message });
    }

    await browser.close();

    return res.json({
      empresa: empresa.name || empresa.nombre,
      rut: rut,
      f29: f29Data,
      f22: f22Data,
      declaraciones_juradas: djData,
      consultado_en: new Date().toISOString()
    });

  } catch (error) {
    if (browser) await browser.close().catch(() => {});
    
    if (error.message?.includes('net::ERR') || error.message?.includes('timeout')) {
      return res.status(503).json({ error: 'No se pudo conectar al SII. Intente nuevamente.' });
    }
    
    console.error('Error SII scraping:', error);
    return res.status(500).json({ error: 'Error al consultar el SII: ' + error.message });
  }
});

export default router;
