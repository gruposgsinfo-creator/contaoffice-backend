import { Router } from 'express';
import jwt         from 'jsonwebtoken';
import User        from '../models/User.js';
import { protect } from '../middleware/auth.js';

const router = Router();

// Genera token con { id, name } en el payload
const signToken = (user) =>
  jwt.sign({ id: user._id, name: user.name }, process.env.JWT_SECRET, { expiresIn: '7d' });

// ── POST /api/auth/register ───────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: 'Nombre, email y contraseña son requeridos.' });

    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ error: 'El email ya está registrado.' });

    const user  = await User.create({ name, email, password });
    const token = signToken(user);
    res.status(201).json({ token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/auth/login ──────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email y contraseña son requeridos.' });

    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ error: 'Credenciales inválidas.' });

    if (user.status === 'inactivo')
      return res.status(403).json({ error: 'Cuenta desactivada.' });

    const token = signToken(user);
    // Retorna { token, user: { _id, name, email, role } }
    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/auth/me ──────────────────────────────────
router.get('/me', protect, (req, res) => res.json(req.user));

export default router;
