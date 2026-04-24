// ContaOffice Backend v3.0 — modelos inline para evitar problemas de caché
import 'dotenv/config';
import express  from 'express';
import cors     from 'cors';
import mongoose from 'mongoose';

// ── Modelos inline ────────────────────────────────────
const trabajadorSchema = new mongoose.Schema({
  empresa_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
  name: { type: String, required: true, trim: true },
  rut:  { type: String, required: true },
  nacimiento: String, genero: String, nacionalidad: String,
  estado_civil: String, domicilio: String, region: String, comuna: String,
  email: String, telefono: String, cargo: String, contrato: String,
  jornada: String, sueldo: Number, ingreso: String, termino: String,
  causal: String, afp: String, cuenta_afp: String, isapre: String,
  plan_salud: String, plan_uf: Number, banco: String,
  tipo_cuenta: String, num_cuenta: String, notas: String,
  status: { type: String, enum: ['activo','inactivo'], default: 'activo' },
}, { timestamps: true });
const Trabajador = mongoose.model('Trabajador', trabajadorSchema);

const rrhhSchema = new mongoose.Schema({
  empresa_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  mes: { type: String, required: true },
  anio: { type: Number, required: true },
  liq_solicitud: { type: Boolean, default: false },
  liq_procesada: { type: Boolean, default: false },
  liq_vb: { type: Boolean, default: false },
  liq_enviada: { type: Boolean, default: false },
  imp_previred: { type: Boolean, default: false },
  imp_aviso: { type: Boolean, default: false },
  imp_monto: Number,
  lre_subido: { type: Boolean, default: false },
  lre_aviso: { type: Boolean, default: false },
  envios_liq: [{ fecha: String, usuario: String, email: String }],
  envios_imp: [{ fecha: String, usuario: String, monto: Number }],
  envios_lre: [{ fecha: String, usuario: String }],
}, { timestamps: true });
rrhhSchema.index({ empresa_id: 1, mes: 1, anio: 1 }, { unique: true });
const RRHH = mongoose.model('RRHH', rrhhSchema);

const balanceSchema = new mongoose.Schema({
  empresa_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  mes: { type: String, required: true },
  anio: { type: Number, required: true },
  compras: { type: Boolean, default: false },
  ventas: { type: Boolean, default: false },
  honorarios: { type: Boolean, default: false },
  rrhh: { type: Boolean, default: false },
  otros: { type: Boolean, default: false },
  procesado: { type: Boolean, default: false },
  vb: { type: Boolean, default: false },
  cerrado: { type: Boolean, default: false },
  envios: [{ fecha: String, usuario: String, email: String }],
}, { timestamps: true });
balanceSchema.index({ empresa_id: 1, mes: 1, anio: 1 }, { unique: true });
const Balance = mongoose.model('Balance', balanceSchema);

const ivaSchema = new mongoose.Schema({
  empresa_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  mes: { type: String, required: true },
  anio: { type: Number, required: true },
  f29: { type: Boolean, default: false },
  aviso: { type: Boolean, default: false },
  monto: Number,
  notif_enviada: { type: Boolean, default: false },
  notif_fecha: String,
  copia_enviada: { type: Boolean, default: false },
  copia_fecha: String,
}, { timestamps: true });
ivaSchema.index({ empresa_id: 1, mes: 1, anio: 1 }, { unique: true });
const IVA = mongoose.model('IVA', ivaSchema);

// ── App ───────────────────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.set('trust proxy', 1);

// ── Rutas externas ────────────────────────────────────
const loaded = [];
const routeFiles = [
  { path: '/api/auth',      file: './routes/auth.js' },
  { path: '/api/companies', file: './routes/companies.js' },
  { path: '/api/tasks',     file: './routes/tasks.js' },
];
for (const r of routeFiles) {
  try {
    const m = await import(r.file);
    app.use(r.path, m.default);
    loaded.push(r.path);
    console.log('✅ Ruta cargada:', r.path);
  } catch(err) {
    console.error('❌ Error cargando', r.file, ':', err.message);
  }
}

// ── Rutas inline (trabajadores, rrhh, balance, iva) ───
import { Router } from 'express';
import jwt from 'jsonwebtoken';

function protect(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'No autorizado.' });
  try {
    req.user = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
    next();
  } catch { res.status(401).json({ error: 'Token inválido.' }); }
}

// Trabajadores
const rTrab = Router();
rTrab.use(protect);
rTrab.get('/', async (req, res) => {
  try {
    const q = req.query.empresa_id ? { empresa_id: req.query.empresa_id } : {};
    res.json(await Trabajador.find(q).sort('-createdAt').lean());
  } catch(e) { res.status(500).json({ error: e.message }); }
});
rTrab.get('/:id', async (req, res) => {
  try {
    const doc = await Trabajador.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ error: 'No encontrado.' });
    res.json(doc);
  } catch(e) { res.status(500).json({ error: e.message }); }
});
rTrab.post('/', async (req, res) => {
  try { res.status(201).json(await Trabajador.create(req.body)); }
  catch(e) { res.status(400).json({ error: e.message }); }
});
rTrab.patch('/:id', async (req, res) => {
  try {
    const doc = await Trabajador.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!doc) return res.status(404).json({ error: 'No encontrado.' });
    res.json(doc);
  } catch(e) { res.status(400).json({ error: e.message }); }
});
app.use('/api/trabajadores', rTrab);
console.log('✅ Ruta cargada: /api/trabajadores');

// RRHH
const rRRHH = Router();
rRRHH.use(protect);
rRRHH.get('/', async (req, res) => {
  try {
    const { empresa_id, mes, anio } = req.query;
    const q = {};
    if (empresa_id) q.empresa_id = empresa_id;
    if (mes) q.mes = mes;
    if (anio) q.anio = parseInt(anio);
    res.json(await RRHH.find(q).lean());
  } catch(e) { res.status(500).json({ error: e.message }); }
});
rRRHH.post('/', async (req, res) => {
  try {
    const { empresa_id, mes, anio, ...rest } = req.body;
    const doc = await RRHH.findOneAndUpdate(
      { empresa_id, mes, anio }, { empresa_id, mes, anio, ...rest },
      { new: true, upsert: true, runValidators: false }
    );
    res.status(201).json(doc);
  } catch(e) { res.status(400).json({ error: e.message }); }
});
rRRHH.patch('/:id', async (req, res) => {
  try {
    const doc = await RRHH.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!doc) return res.status(404).json({ error: 'No encontrado.' });
    res.json(doc);
  } catch(e) { res.status(400).json({ error: e.message }); }
});
app.use('/api/rrhh', rRRHH);
console.log('✅ Ruta cargada: /api/rrhh');

// Balance
const rBal = Router();
rBal.use(protect);
rBal.get('/', async (req, res) => {
  try {
    const { empresa_id, mes, anio } = req.query;
    const q = {};
    if (empresa_id) q.empresa_id = empresa_id;
    if (mes) q.mes = mes;
    if (anio) q.anio = parseInt(anio);
    res.json(await Balance.find(q).lean());
  } catch(e) { res.status(500).json({ error: e.message }); }
});
rBal.post('/', async (req, res) => {
  try {
    const { empresa_id, mes, anio, ...rest } = req.body;
    const doc = await Balance.findOneAndUpdate(
      { empresa_id, mes, anio }, { empresa_id, mes, anio, ...rest },
      { new: true, upsert: true, runValidators: false }
    );
    res.status(201).json(doc);
  } catch(e) { res.status(400).json({ error: e.message }); }
});
rBal.patch('/:id', async (req, res) => {
  try {
    const doc = await Balance.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!doc) return res.status(404).json({ error: 'No encontrado.' });
    res.json(doc);
  } catch(e) { res.status(400).json({ error: e.message }); }
});
app.use('/api/balance', rBal);
console.log('✅ Ruta cargada: /api/balance');

// IVA
const rIVA = Router();
rIVA.use(protect);
rIVA.get('/', async (req, res) => {
  try {
    const { empresa_id, mes, anio } = req.query;
    const q = {};
    if (empresa_id) q.empresa_id = empresa_id;
    if (mes) q.mes = mes;
    if (anio) q.anio = parseInt(anio);
    res.json(await IVA.find(q).lean());
  } catch(e) { res.status(500).json({ error: e.message }); }
});
rIVA.post('/', async (req, res) => {
  try {
    const { empresa_id, mes, anio, ...rest } = req.body;
    const doc = await IVA.findOneAndUpdate(
      { empresa_id, mes, anio }, { empresa_id, mes, anio, ...rest },
      { new: true, upsert: true, runValidators: false }
    );
    res.status(201).json(doc);
  } catch(e) { res.status(400).json({ error: e.message }); }
});
rIVA.patch('/:id', async (req, res) => {
  try {
    const doc = await IVA.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!doc) return res.status(404).json({ error: 'No encontrado.' });
    res.json(doc);
  } catch(e) { res.status(400).json({ error: e.message }); }
});
app.use('/api/iva', rIVA);
console.log('✅ Ruta cargada: /api/iva');

// SII
let siiRoutes = null;
try {
  const m = await import('./routes/sii.js');
  siiRoutes = m.default;
  console.log('✅ SII route cargado');
} catch(err) {
  console.warn('⚠️ SII route no disponible:', err.message);
}
if (siiRoutes) app.use('/api/sii', siiRoutes);

// ── Health ────────────────────────────────────────────
app.get('/api/health', (_req, res) =>
  res.json({ status: 'ok', sii: !!siiRoutes, timestamp: new Date().toISOString() })
);

app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));
app.use((err, _req, res, _next) => {
  console.error(err.message);
  res.status(500).json({ error: err.message });
});

// ── Start ─────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB conectado');
    app.listen(PORT, '0.0.0.0', () =>
      console.log('🚀 ContaOffice API en puerto', PORT)
    );
  })
  .catch(err => { console.error('❌ MongoDB error:', err.message); process.exit(1); });
