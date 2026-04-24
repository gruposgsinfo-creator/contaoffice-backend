import { Router }  from 'express';
import { protect }  from '../middleware/auth.js';

let Balance = null;
try {
  const m = await import('../models/balance.js');
  Balance = m.default;
} catch(e) {
  try {
    const m = await import('../models/Balance.js');
    Balance = m.default;
  } catch(e2) {
    console.error('No se pudo cargar modelo Balance:', e2.message);
  }
}

const router = Router();
router.use(protect);

router.get('/', async (req, res) => {
  try {
    if (!Balance) return res.status(503).json({ error: 'Modelo Balance no disponible.' });
    const { empresa_id, mes, anio } = req.query;
    const query = {};
    if (empresa_id) query.empresa_id = empresa_id;
    if (mes)  query.mes  = mes;
    if (anio) query.anio = parseInt(anio);
    res.json(await Balance.find(query).lean());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    if (!Balance) return res.status(503).json({ error: 'Modelo Balance no disponible.' });
    const { empresa_id, mes, anio, ...rest } = req.body;
    const doc = await Balance.findOneAndUpdate(
      { empresa_id, mes, anio },
      { empresa_id, mes, anio, ...rest },
      { new: true, upsert: true, runValidators: false }
    );
    res.status(201).json(doc);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.patch('/:id', async (req, res) => {
  try {
    if (!Balance) return res.status(503).json({ error: 'Modelo Balance no disponible.' });
    const doc = await Balance.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!doc) return res.status(404).json({ error: 'No encontrado.' });
    res.json(doc);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

export default router;
