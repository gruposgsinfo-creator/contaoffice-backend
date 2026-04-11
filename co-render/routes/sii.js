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
                  browser = await puppeteer.launch({
                              args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--single-process'],
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
