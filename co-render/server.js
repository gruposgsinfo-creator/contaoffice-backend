import 'dotenv/config';
import express  from 'express';
import cors     from 'cors';
import mongoose from 'mongoose';

import authRoutes      from './routes/auth.js';
import companyRoutes   from './routes/companies.js';
import taskRoutes      from './routes/tasks.js';
import siiRoutes       from './routes/sii.js';

const app  = express();
const PORT = process.env.PORT || 3000;

const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:5173',
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) cb(null, true);
    else cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.set('trust proxy', 1);

app.use('/api/auth',      authRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/tasks',     taskRoutes);
app.use('/api/sii',       siiRoutes);

app.get('/api/health', (_req, res) =>
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
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
  .catch(err => { console.error(err); process.exit(1); });
