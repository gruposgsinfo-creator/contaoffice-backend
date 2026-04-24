import { Router }  from 'express';
import RRHH         from '../models/RRHH.js';
import { protect }  from '../middleware/auth.js';

const router = Router();
router.use(protect);

// GET /api/rrhh?empresa_id=&mes=&anio=
router.get('/', async (req, res) => {
  try {
    const { empresa_id, mes, anio } = req.query;
    const query = {};
    if (empresa_id) query.empresa_id = empresa_id;
    if (mes)  query.mes  = mes;
    if (anio) query.anio = parseInt(anio);
    const docs = await RRHH.find(query).lean();
    res.json(docs);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/rrhh — crear o actualizar por empresa+mes+anio (upsert)
router.post('/', async (req, res) => {
  try {
    const { empresa_id, mes, anio, ...rest } = req.body;
    const doc = await RRHH.findOneAndUpdate(
      { empresa_id, mes, anio },
      { empresa_id, mes, anio, ...rest },
      { new: true, upsert: true, runValidators: false }
    );
    res.status(201).json(doc);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// PATCH /api/rrhh/:id
router.patch('/:id', async (req, res) => {
  try {
    const doc = await RRHH.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!doc) return res.status(404).json({ error: 'No encontrado.' });
    res.json(doc);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

export default router;
