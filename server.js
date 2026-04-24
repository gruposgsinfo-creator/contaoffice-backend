import 'dotenv/config';
import express  from 'express';
import cors     from 'cors';
import mongoose from 'mongoose';

import authRoutes         from './routes/auth.js';
import companyRoutes      from './routes/companies.js';
import taskRoutes         from './routes/tasks.js';
import trabajadorRoutes   from './routes/trabajadores.js';
import rrhhRoutes         from './routes/rrhh.js';
import balanceRoutes      from './routes/balance.js';
import ivaRoutes          from './routes/iva.js';

// SII route cargado dinámicamente (requiere Puppeteer)
let siiRoutes = null;
try {
  const m = await import('./routes/sii.js');
  siiRoutes = m.default;
  console.log('✅ SII route cargado');
} catch(err) {
  console.warn('⚠️ SII route no disponible:', err.message);
}

const app    = express();
const PORT   = process.env.PORT || 4000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.set('trust proxy', 1);

app.use('/api/auth',         authRoutes);
app.use('/api/companies',    companyRoutes);
app.use('/api/tasks',        taskRoutes);
app.use('/api/trabajadores', trabajadorRoutes);
app.use('/api/rrhh',         rrhhRoutes);
app.use('/api/balance',      balanceRoutes);
app.use('/api/iva',          ivaRoutes);
if (siiRoutes) app.use('/api/sii', siiRoutes);

app.get('/api/health', (_req, res) =>
  res.json({ status: 'ok', sii: !!siiRoutes, timestamp: new Date().toISOString() })
);

app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));

app.use((err, _req, res, _next) => {
  console.error(err.message);
  res.status(err.status || 500).json({ error: err.message || 'Error interno.' });
});

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
