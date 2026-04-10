import 'dotenv/config';
import express  from 'express';
import cors     from 'cors';
import mongoose from 'mongoose';

import authRoutes      from './routes/auth.js';
import companyRoutes   from './routes/companies.js';
import taskRoutes      from './routes/tasks.js';

const app    = express();
const PORT   = process.env.PORT || 4000;
const isProd = process.env.NODE_ENV === 'production';

// ── CORS ──────────────────────────────────────────────
const ALLOWED_ORIGINS = (process.env.FRONTEND_URL || '')
  .split(',').map(s => s.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin)                   return cb(null, true); // curl / mismo origen
    if (!isProd)                   return cb(null, true); // desarrollo: acepta todo
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    // Permite cualquier localhost en dev accidental
    if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return cb(null, true);
    cb(new Error('CORS no permitido para: ' + origin));
  },
  credentials: true,
}));

// ── Middleware ─────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.set('trust proxy', 1); // Render usa proxy inverso

// ── Rutas ─────────────────────────────────────────────
app.use('/api/auth',      authRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/tasks',     taskRoutes);

// ── Health check ──────────────────────────────────────
app.get('/api/health', (_req, res) =>
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
);

// ── 404 ───────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));

// ── Error handler ─────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err.message);
  res.status(err.status || 500).json({ error: err.message || 'Error interno.' });
});

// ── Conectar MongoDB y arrancar ───────────────────────
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB conectado');
    app.listen(PORT, '0.0.0.0', () =>
      console.log(`🚀 ContaOffice API en puerto ${PORT}`)
    );
  })
  .catch(err => {
    console.error('❌ MongoDB error:', err.message);
    process.exit(1);
  });
