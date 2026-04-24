import { Router }    from 'express';
import Trabajador     from '../models/Trabajador.js';
import { protect }   from '../middleware/auth.js';

const router = Router();
router.use(protect);

// GET /api/trabajadores
router.get('/', async (req, res) => {
  try {
    const { empresa_id } = req.query;
    const query = empresa_id ? { empresa_id } : {};
    const docs = await Trabajador.find(query).sort('-createdAt').lean();
    res.json(docs);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/trabajadores/:id
router.get('/:id', async (req, res) => {
  try {
    const doc = await Trabajador.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ error: 'No encontrado.' });
    res.json(doc);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/trabajadores
router.post('/', async (req, res) => {
  try {
    const doc = await Trabajador.create(req.body);
    res.status(201).json(doc);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// PATCH /api/trabajadores/:id
router.patch('/:id', async (req, res) => {
  try {
    const doc = await Trabajador.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!doc) return res.status(404).json({ error: 'No encontrado.' });
    res.json(doc);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

export default router;
