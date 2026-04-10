import { Router } from 'express';
import Company     from '../models/Company.js';
import { protect } from '../middleware/auth.js';

const router = Router();
router.use(protect);

// GET /api/companies — retorna array directo
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    const query = search
      ? { $or: [{ name: new RegExp(search,'i') }, { rut: new RegExp(search,'i') }] }
      : {};
    const companies = await Company.find(query).sort('-createdAt').limit(500).lean();
    res.json(companies); // array directo
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/companies/:id
router.get('/:id', async (req, res) => {
  try {
    const company = await Company.findById(req.params.id).lean();
    if (!company) return res.status(404).json({ error: 'Empresa no encontrada.' });
    res.json(company);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/companies
router.post('/', async (req, res) => {
  try {
    const company = await Company.create(req.body);
    res.status(201).json(company); // retorna doc completo
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/companies/:id
router.patch('/:id', async (req, res) => {
  try {
    const company = await Company.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: false }
    );
    if (!company) return res.status(404).json({ error: 'Empresa no encontrada.' });
    res.json(company);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/companies/:id
router.delete('/:id', async (req, res) => {
  try {
    const company = await Company.findByIdAndDelete(req.params.id);
    if (!company) return res.status(404).json({ error: 'Empresa no encontrada.' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
