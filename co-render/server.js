import 'dotenv/config';
import express  from 'express';
import cors     from 'cors';
import mongoose from 'mongoose';
 
import authRoutes      from './routes/auth.js';
import companyRoutes   from './routes/companies.js';
import taskRoutes      from './routes/tasks.js';
import siiRoutes       from './routes/sii.js';
 
const app    = express();
const PORT   = process.env.PORT || 4000;
const isProd = process.env.NODE_ENV === 'production';
 
// ── CORS — acepta todos los orígenes (uso interno) ────
app.use(cors({ origin: true, credentials: true }));
 
// ── Middleware ─────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.set('trust proxy', 1); // Render usa proxy inverso
 
// ── Rutas ─────────────────────────────────────────────
app.use('/api/auth',      authRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/tasks',     taskRoutes);
app.use('/api/sii',       siiRoutes);
 
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
