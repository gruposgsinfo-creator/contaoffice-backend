import mongoose from 'mongoose';
import { encrypt, decrypt, isEncrypted } from '../utils/crypto.js';

// ── Sub-schemas ───────────────────────────────────────
const credencialSchema = new mongoose.Schema({
  institucion:    { type: String, enum: ['SII','TGR','Previred','DT','AFC','INP'] },
  usuario:        String,
  clave:          String,   // almacenada encriptada con AES-256-GCM
  regimen:        String,
  sii_verificado: { type: Boolean, default: false },
}, { _id: false });

const socioSchema = new mongoose.Schema({
  nombre:        String,
  rut:           String,
  participacion: Number,
  clave_sii:     String,
}, { _id: false });

const miCuentaSchema = new mongoose.Schema({
  inicio:    Date,
  ejecutivo: String,
  plan:      Number,
  moneda:    { type: String, enum: ['uf','pesos'], default: 'uf' },
  estado:    { type: String, enum: ['activo','suspendido','inactivo','moroso','en_proceso'], default: 'activo' },
  notas:     String,
}, { _id: false });

// ── Schema principal ──────────────────────────────────
const schema = new mongoose.Schema({
  name:          { type: String, required: true, trim: true },
  rut:           { type: String, trim: true },   // ✅ confirmado: existe
  clave_sii:     { type: String },               // ✅ nuevo: almacenada encriptada AES-256-GCM
  giro:          String,
  domicilio:     String,
  region:        String,
  comuna:        String,
  contact_name:  String,
  contact_email: String,
  contact_phone: String,
  has_rrhh:      { type: Boolean, default: true },
  status:        { type: String, enum: ['activo','suspendido','inactivo','moroso','en_proceso'], default: 'activo' },
  credenciales:  [credencialSchema],
  socios:        [socioSchema],
  mi_cuenta:     miCuentaSchema,
  notes:         String,
}, { timestamps: true });

// ── Hooks: encriptar clave_sii y credenciales antes de guardar ──
schema.pre('save', function (next) {
  // Encriptar clave_sii principal
  if (this.isModified('clave_sii') && this.clave_sii && !isEncrypted(this.clave_sii))
    this.clave_sii = encrypt(this.clave_sii);

  // Encriptar claves dentro de credenciales[]
  if (this.isModified('credenciales') && Array.isArray(this.credenciales)) {
    this.credenciales.forEach(c => {
      if (c.clave && !isEncrypted(c.clave)) c.clave = encrypt(c.clave);
    });
  }
  next();
});

// También encriptar en findOneAndUpdate / findByIdAndUpdate
schema.pre(['findOneAndUpdate','updateOne','updateMany'], function (next) {
  const update = this.getUpdate();
  if (update?.clave_sii && !isEncrypted(update.clave_sii))
    update.clave_sii = encrypt(update.clave_sii);
  if (Array.isArray(update?.credenciales)) {
    update.credenciales.forEach(c => {
      if (c.clave && !isEncrypted(c.clave)) c.clave = encrypt(c.clave);
    });
  }
  next();
});

// ── Método: obtener clave_sii desencriptada ───────────
schema.methods.getClavesSII = function () {
  return {
    rut:       this.rut,
    clave_sii: decrypt(this.clave_sii),
    credenciales: (this.credenciales || []).map(c => ({
      ...c.toObject(),
      clave: decrypt(c.clave),
    })),
  };
};

// ── toJSON: nunca exponer claves encriptadas al cliente ─
schema.methods.toJSON = function () {
  const obj = this.toObject();
  // Ocultar clave_sii en respuestas JSON
  delete obj.clave_sii;
  if (Array.isArray(obj.credenciales)) {
    obj.credenciales = obj.credenciales.map(c => ({ ...c, clave: undefined }));
  }
  return obj;
};

export default mongoose.model('Company', schema);
