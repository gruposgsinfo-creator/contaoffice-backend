import mongoose from 'mongoose';

const credencialSchema = new mongoose.Schema({
  institucion:    { type: String, enum: ['SII','TGR','Previred','DT','AFC','INP'] },
  usuario:        String,
  clave:          String,
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
  credenciales:  [credencialSchema],
  socios:        [socioSchema],
  mi_cuenta:     miCuentaSchema,
  notes:         String,
}, { timestamps: true });

export default mongoose.model('Company', schema);
