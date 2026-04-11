import { Router } from 'express';
import puppeteer from 'puppeteer-core';
import { execSync, execFileSync } from 'child_process';
import { existsSync, readdirSync } from 'fs';
import Company from '../models/Company.js';
import { protect } from '../middleware/auth.js';

const router = Router();

// Debug endpoint - encontrar chromium
router.get('/debug-chromium', protect, (req, res) => {
      const info = {};
      try { info.which_chromium = execSync('which chromium 2>/dev/null || echo ""', { encoding: 'utf8' }).trim(); } catch(e) { info.which_chromium = 'error: ' + e.message; }
      try { info.which_chromium_browser = execSync('which chromium-browser 2>/dev/null || echo ""', { encoding: 'utf8' }).trim(); } catch(e) { info.which_chromium_browser = 'error'; }
      try { info.find_nix_chromium = execSync('find /nix -name "chromium" -type f 2>/dev/null | head -5', { encoding: 'utf8' }).trim(); } catch(e) { info.find_nix_chromium = 'error: ' + e.message; }
      try { info.find_usr_chromium = execSync('find /usr -name "chromium*" -type f 2>/dev/null | head -5', { encoding: 'utf8' }).trim(); } catch(e) { info.find_usr_chromium = 'error'; }
      try { info.nix_profiles = existsSync('/nix/var/nix/profiles/default/bin') ? readdirSync('/nix/var/nix/profiles/default/bin').filter(f => f.includes('chrom')) : 'no nix profiles'; } catch(e) { info.nix_profiles = 'error'; }
      try { info.path_env = process.env.PATH; } catch(e) {}
      res.json(info);
});

// Obtener el path de chromium del sistema (instalado via nixpacks)
function getChromiumPath() {
      // Intentar con find en nix store
  try {
          const found = execSync('find /nix -name "chromium" -type f 2>/dev/null | head -1', { encoding: 'utf8' }).trim();
          if (found) return found;
  } catch(e) {}

  // which commands
  const commands = ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable'];
      for (const cmd of commands) {
              try {
                        const p = execSync(`which ${cmd} 2>/dev/null`, { encoding: 'utf8' }).trim();
                        if (p) return p;
              } catch(e) {}
      }

  // Paths fijos
  const paths = [
          '/nix/var/nix/profiles/default/bin/chromium',
          '/run/current-system/sw/bin/chromium',
          '/usr/bin/chromium',
          '/usr/bin/chromium-browser',
          '/usr/bin/google-chrome',
          '/usr/bin/google-chrome-stable',
        ];
      for (const p of paths) {
              if (existsSync(p)) return p;
      }

  throw new Error('Chromium no encontrado en el sistema');
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
              const executablePath = getChromiumPath();
              console.log('Using chromium at:', executablePath);
              browser = await puppeteer.launch({
                        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--single-process'],
                        executablePath,
                        headless: true,
              });

        const page = await browser.newPage();
              await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36');

        // Login al SII
        await page.goto('https://zeusr.sii.cl/AUT2000/InicioAutenticacion/ingresaRutClave.html', { waitUntil: 'networkidle2', timeout: 30000 });

        // Ingresar RUT
        await page.waitForSelector('#rutcntr', { timeout: 10000 });
              await page.click('#rutcntr');
              await page.type('#rutcntr', rut.replace(/\./g, ''));

        // Ingresar clave
        await page.click('#clave');
              await page.type('#clave', clave_sii);

        // Submit
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

        // ---- F29 ----
        try {
                  await page.goto('https://www4.sii.cl/consdcxInernet/index.html', { waitUntil: 'networkidle2', timeout: 30000 });
                  await page.waitForSelector('table', { timeout: 10000 });
                  const f29Rows = await page.evaluate(() => {
                              const rows = [];
                              document.querySelectorAll('table tr').forEach(tr => {
                                            const tds = tr.querySelectorAll('td');
                                            if (tds.length >= 3) {
                                                            rows.push({
                                                                              periodo: tds[0]?.innerText?.trim(),
                                                                              estado: tds[1]?.innerText?.trim(),
                                                                              folio: tds[2]?.innerText?.trim()
                                                            });
                                            }
                              });
                              return rows.slice(0, 24);
                  });
                  resultados.f29 = f29Rows;
        } catch (e) {
                  resultados.f29 = [{ error: 'No se pudo obtener F29: ' + e.message }];
        }

        // ---- F22 ----
        try {
                  await page.goto('https://www4.sii.cl/consdcxInernet/index.html?type=F22', { waitUntil: 'networkidle2', timeout: 30000 });
                  await page.waitForSelector('table', { timeout: 10000 });
                  const f22Rows = await page.evaluate(() => {
                              const rows = [];
                              document.querySelectorAll('table tr').forEach(tr => {
                                            const tds = tr.querySelectorAll('td');
                                            if (tds.length >= 3) {
                                                            rows.push({
                                                                              anio: tds[0]?.innerText?.trim(),
                                                                              estado: tds[1]?.innerText?.trim(),
                                                                              folio: tds[2]?.innerText?.trim()
                                                            });
                                            }
                              });
                              return rows.slice(0, 10);
                  });
                  resultados.f22 = f22Rows;
        } catch (e) {
                  resultados.f22 = [{ error: 'No se pudo obtener F22: ' + e.message }];
        }

        // ---- Declaraciones Juradas ----
        try {
                  await page.goto('https://www4.sii.cl/djindexInternetui/index.html', { waitUntil: 'networkidle2', timeout: 30000 });
                  await page.waitForSelector('table', { timeout: 10000 });
                  const djRows = await page.evaluate(() => {
                              const rows = [];
                              document.querySelectorAll('table tr').forEach(tr => {
                                            const tds = tr.querySelectorAll('td');
                                            if (tds.length >= 3) {
                                                            rows.push({
                                                                              tipo: tds[0]?.innerText?.trim(),
                                                                              periodo: tds[1]?.innerText?.trim(),
                                                                              estado: tds[2]?.innerText?.trim()
                                                            });
                                            }
                              });
                              return rows.slice(0, 20);
                  });
                  resultados.declaraciones_juradas = djRows;
        } catch (e) {
                  resultados.declaraciones_juradas = [{ error: 'No se pudo obtener DJ: ' + e.message }];
        }

        await browser.close();
              return res.json({ ok: true, empresa: empresa.nombre, resultados });

      } catch (err) {
              if (browser) await browser.close();
              console.error('SII scraping error:', err.message);
              return res.status(500).json({ error: 'Error al consultar SII: ' + err.message });
      }
});

export default router;
