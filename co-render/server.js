import 'dotenv/config';
import express  from 'express';
import cors     from 'cors';
import mongoose from 'mongoose';
 
const app  = express();
const PORT = process.env.PORT || 4000;
 
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.set('trust proxy', 1);
 
// Cargar rutas una por una con manejo de errores
const routes = [
  { path: '/api/auth',         file: './routes/auth.js' },
  { path: '/api/companies',    file: './routes/companies.js' },
  { path: '/api/tasks',        file: './routes/tasks.js' },
  { path: '/api/trabajadores', file: './routes/trabajadores.js' },
  { path: '/api/rrhh',         file: './routes/rrhh.js' },
  { path: '/api/balance',      file: './routes/balance.js' },
  { path: '/api/iva',          file: './routes/iva.js' },
];
 
const loaded = [];
for (const r of routes) {
  try {
    const m = await import(r.file);
    app.use(r.path, m.default);
    loaded.push(r.path);
    console.log('✅ Ruta cargada:', r.path);
  } catch(err) {
    console.error('❌ Error cargando', r.file, ':', err.message);
  }
}
 
app.get('/api/health', (_req, res) =>
  res.json({ status: 'ok', routes: loaded, timestamp: new Date().toISOString() })
);
 
app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));
 
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB conectado');
    app.listen(PORT, '0.0.0.0', () =>
      console.log('🚀 ContaOffice API en puerto', PORT)
    );
  })
  .catch(err => {
    console.error('❌ MongoDB error:', err.message);
    process.exit(1);
  });
