import mongoose from 'mongoose';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ENCRYPTION_KEY = (process.env.ENCRYPTION_KEY || 'ContaOfficeSII2026SecureKey32Cha').slice(0, 32);
const IV_LENGTH = 16;

function encrypt(text) {
  if (!text) return null;
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text) {
  if (!text) return null;
  try {
    const [ivHex, encrypted] = text.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (e) {
    return null;
  }
}

const credencialSchema = new mongoose.Schema({
  institucion: { type: String, enum: ['SII','TGR','Previred','DT','AFC','INP'] },
  usuario:     String,
  clave:       String,
  regimen:     String,
  sii_verificado: { type: Boolean, default: false },
}, { _id: false });

const socioSchema = new mongoose.Schema({
  nombre:       String,
  rut:          String,
  participacion: Number,
  clave_sii:    String,
}, { _id: false });

const miCuentaSchema = new mongoose.Schema({
  inicio:    Date,
  ejecutivo: String,
  plan:      Number,
  moneda:    { type: String, enum: ['uf','pesos'], default: 'uf' },
  estado:    { type: String, enum: ['activo','suspendido','inactivo','moroso','en_proceso'], default: 'activo' },
  notas:     String,
}, { _id: false });

const schema = new mongoose.Schema({
  name:          { type: String, required: true, trim: true },
  rut:           String,
  giro:          String,
  domicilio:     String,
  region:        String,
  comuna:        String,
  contact_name:  String,
  contact_email: String,
  contact_phone: String,
  has_rrhh:      { type: Boolean, default: true },
  status:        { type: String, enum: ['activo','suspendido','inactivo','moroso','en_proceso'], default: 'activo' },
  clave_sii:     String,
  credenciales:  [credencialSchema],
  socios:        [socioSchema],
  mi_cuenta:     miCuentaSchema,
  notes:         String,
}, { timestamps: true });

// Guardar clave SII encriptada
schema.methods.setClaveSII = function(clave) {
  this.clave_sii = encrypt(clave);
};

// Obtener credenciales SII desencriptadas
schema.methods.getClaveSII = function() {
  // Primero busca en el campo directo clave_sii
  if (this.clave_sii) {
    return { rut: this.rut, clave_sii: decrypt(this.clave_sii) };
  }
  // Si no, busca en el array de credenciales
  const cred = this.credenciales?.find(c => c.institucion === 'SII');
  if (cred && cred.usuario && cred.clave) {
    return { rut: cred.usuario, clave_sii: cred.clave };
  }
  return null;
};

// Ocultar clave_sii en respuestas JSON
schema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.clave_sii;
  if (obj.credenciales) {
    obj.credenciales = obj.credenciales.map(c => {
      const copy = { ...c };
      delete copy.clave;
      return copy;
    });
  }
  return obj;
};

export default mongoose.model('Company', schema);
