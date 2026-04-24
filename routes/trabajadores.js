import { Router }    from 'express';
import { protect }   from '../middleware/auth.js';

let Trabajador = null;
try {
  const m = await import('../models/trabajador.js');
  Trabajador = m.default;
} catch(e) {
  try {
    const m = await import('../models/Trabajador.js');
    Trabajador = m.default;
  } catch(e2) {
    console.error('No se pudo cargar modelo Trabajador:', e2.message);
  }
}

const router = Router();
router.use(protect);

router.get('/', async (req, res) => {
  try {
    if (!Trabajador) return res.status(503).json({ error: 'Modelo Trabajador no disponible.' });
    const { empresa_id } = req.query;
    const query = empresa_id ? { empresa_id } : {};
    const docs = await Trabajador.find(query).sort('-createdAt').lean();
    res.json(docs);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    if (!Trabajador) return res.status(503).json({ error: 'Modelo Trabajador no disponible.' });
    const doc = await Trabajador.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ error: 'No encontrado.' });
    res.json(doc);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    if (!Trabajador) return res.status(503).json({ error: 'Modelo Trabajador no disponible.' });
    const doc = await Trabajador.create(req.body);
    res.status(201).json(doc);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.patch('/:id', async (req, res) => {
  try {
    if (!Trabajador) return res.status(503).json({ error: 'Modelo Trabajador no disponible.' });
    const doc = await Trabajador.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!doc) return res.status(404).json({ error: 'No encontrado.' });
    res.json(doc);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

export default router;
