import { Router } from 'express';
import Task        from '../models/Task.js';
import { protect } from '../middleware/auth.js';

const router = Router();
router.use(protect);

// GET /api/tasks — retorna array directo
router.get('/', async (req, res) => {
  try {
    const { search, empresa_id } = req.query;
    const query = {};
    if (empresa_id) query.empresa_id = empresa_id;
    if (search) query.$or = [{ title: new RegExp(search,'i') }, { cat: new RegExp(search,'i') }];
    const tasks = await Task.find(query).sort('-createdAt').limit(500).lean();
    res.json(tasks); // array directo
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tasks/:id
router.get('/:id', async (req, res) => {
  try {
    const task = await Task.findById(req.params.id).lean();
    if (!task) return res.status(404).json({ error: 'Tarea no encontrada.' });
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tasks
router.post('/', async (req, res) => {
  try {
    const payload = { ...req.body, created_by: req.user.name };
    const task = await Task.create(payload);
    res.status(201).json(task); // retorna doc completo
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/tasks/:id — editar campos o cambiar status
router.patch('/:id', async (req, res) => {
  try {
    const task = await Task.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: false }
    );
    if (!task) return res.status(404).json({ error: 'Tarea no encontrada.' });
    res.json(task);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) return res.status(404).json({ error: 'Tarea no encontrada.' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
