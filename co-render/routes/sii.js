import { Router } from 'express';
import puppeteer from 'puppeteer-core';
import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import Company from '../models/Company.js';
import { protect } from '../middleware/auth.js';

const router = Router();

// Cache del path de chromium para no re-instalar en cada request
let _chromiumPath = null;

async function getOrInstallChromium() {
          if (_chromiumPath && existsSync(_chromiumPath)) return _chromiumPath;

  // Primero intentar encontrar en el sistema
  const systemPaths = [
              '/usr/bin/chromium-browser',
              '/usr/bin/chromium',
              '/usr/bin/google-chrome',
              '/usr/local/bin/chromium',
            ];
          for (const p of systemPaths) {
                      if (existsSync(p)) { _chromiumPath = p; return p; }
          }

  // Intentar which
  const cmds = ['chromium-browser', 'chromium', 'google-chrome'];
          for (const cmd of cmds) {
                      try {
                                    const p = execSync(`which ${cmd} 2>/dev/null`, { encoding: 'utf8' }).trim();
                                    if (p && existsSync(p)) { _chromiumPath = p; return p; }
                      } catch(e) {}
          }

  // Instalar via apt-get (requiere permisos)
  try {
              console.log('Intentando instalar chromium via apt-get...');
              execSync('apt-get update -y && apt-get install -y chromium-browser --no-install-recommends 2>&1', { 
                             encoding: 'utf8', 
                            timeout: 120000 // 2 minutos
              });
              if (existsSync('/usr/bin/chromium-browser')) {
                            _chromiumPath = '/usr/bin/chromium-browser';
                            return _chromiumPath;
              }
  } catch(e) {
              console.log('apt-get chromium-browser falló:', e.message.substring(0, 200));
  }

  // Intentar instalar google-chrome via wget
  try {
              console.log('Intentando descargar Chrome via wget...');
              const chromeDir = '/tmp/chrome';
              if (!existsSync(chromeDir)) mkdirSync(chromeDir, { recursive: true });

            execSync(`
                  cd /tmp/chrome && 
                        wget -q https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb && 
                              dpkg -i google-chrome-stable_current_amd64.deb 2>/dev/null || 
                                    apt-get install -f -y 2>/dev/null &&
                                          dpkg -i google-chrome-stable_current_amd64.deb 2>/dev/null
                                              `, { encoding: 'utf8', timeout: 180000 });

            if (existsSync('/usr/bin/google-chrome')) {
                          _chromiumPath = '/usr/bin/google-chrome';
                          return _chromiumPath;
            }
  } catch(e) {
              console.log('wget chrome falló:', e.message.substring(0, 200));
  }

  throw new Error('No se pudo obtener Chromium. Intenta nuevamente en unos minutos.');
}

// POST /api/sii/consultar
router.post('/consultar', protect, async (req, res) => {
          const { empresa_id } = req.body;
          if (!empresa_id) return res.status(400).json({ error: 'empresa_id requerido' });

              let empresa;
          try {
                      empresa = await Company.findById(empresa_id);
          } catch (e) {
                      return res.status(400).json({ error: 'ID de empresa invalido' });
          }
          if (!empresa) return res.status(404).json({ error: 'Empresa no encontrada' });

              const credenciales = empresa.getClaveSII ? empresa.getClaveSII() : null;
          if (!credenciales || !credenciales.rut || !credenciales.clave_sii) {
                      return res.status(400).json({ error: 'La empresa no tiene RUT o clave SII configurados' });
          }

              const { rut, clave_sii } = credenciales;

              let browser;
          try {
                      const executablePath = await getOrInstallChromium();
                      console.log('Usando chromium en:', executablePath);

            browser = await puppeteer.launch({
                          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--single-process'],
                          executablePath,
                          headless: true,
            });

            const page = await browser.newPage();
                      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36');

            await page.goto('https://zeusr.sii.cl/AUT2000/InicioAutenticacion/ingresaRutClave.html', { waitUntil: 'networkidle2', timeout: 30000 });
                      await page.waitForSelector('#rutcntr', { timeout: 10000 });
                      await page.click('#rutcntr');
                      await page.type('#rutcntr', rut.replace(/\./g, ''));
                      await page.click('#clave');
                      await page.type('#clave', clave_sii);

            await Promise.all([
                          page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
                          page.click('#bt_ingresar')
                        ]);

            const url = page.url();
                      if (url.includes('InicioAutenticacion') || url.includes('error')) {
                                    await browser.close();
                                    return res.status(401).json({ error: 'RUT o clave SII incorrectos' });
                      }

            const resultados = { f29: [], f22: [], declaraciones_juradas: [] };

            try {
                          await page.goto('https://www4.sii.cl/consdcxInernet/index.html', { waitUntil: 'networkidle2', timeout: 30000 });
                          await page.waitForSelector('table', { timeout: 10000 });
                          resultados.f29 = await page.evaluate(() => {
                                          const rows = [];
                                          document.querySelectorAll('table tr').forEach(tr => {
                                                            const tds = tr.querySelectorAll('td');
                                                            if (tds.length >= 3) rows.push({ periodo: tds[0]?.innerText?.trim(), estado: tds[1]?.innerText?.trim(), folio: tds[2]?.innerText?.trim() });
                                          });
                                          return rows.slice(0, 24);
                          });
            } catch(e) { resultados.f29 = [{ error: e.message }]; }

            try {
                          await page.goto('https://www4.sii.cl/consdcxInernet/index.html?type=F22', { waitUntil: 'networkidle2', timeout: 30000 });
                          await page.waitForSelector('table', { timeout: 10000 });
                          resultados.f22 = await page.evaluate(() => {
                                          const rows = [];
                                          document.querySelectorAll('table tr').forEach(tr => {
                                                            const tds = tr.querySelectorAll('td');
                                                            if (tds.length >= 3) rows.push({ anio: tds[0]?.innerText?.trim(), estado: tds[1]?.innerText?.trim(), folio: tds[2]?.innerText?.trim() });
                                          });
                                          return rows.slice(0, 10);
                          });
            } catch(e) { resultados.f22 = [{ error: e.message }]; }

            try {
                          await page.goto('https://www4.sii.cl/djindexInternetui/index.html', { waitUntil: 'networkidle2', timeout: 30000 });
                          await page.waitForSelector('table', { timeout: 10000 });
                          resultados.declaraciones_juradas = await page.evaluate(() => {
                                          const rows = [];
                                          document.querySelectorAll('table tr').forEach(tr => {
                                                            const tds = tr.querySelectorAll('td');
                                                            if (tds.length >= 3) rows.push({ tipo: tds[0]?.innerText?.trim(), periodo: tds[1]?.innerText?.trim(), estado: tds[2]?.innerText?.trim() });
                                          });
                                          return rows.slice(0, 20);
                          });
            } catch(e) { resultados.declaraciones_juradas = [{ error: e.message }]; }

            await browser.close();
                      return res.json({ ok: true, empresa: empresa.nombre, resultados });

          } catch (err) {
                      if (browser) { try { await browser.close(); } catch(e) {} }
                      console.error('SII error:', err.message);
                      return res.status(500).json({ error: 'Error al consultar SII: ' + err.message });
          }
});

export default router;
