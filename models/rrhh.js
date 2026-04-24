import mongoose from 'mongoose';

const rrhhSchema = new mongoose.Schema({
  empresa_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  mes:        { type: String, required: true }, // "Enero", "Febrero", etc.
  anio:       { type: Number, required: true },

  // Liquidaciones
  liq_solicitud:   { type: Boolean, default: false },
  liq_procesada:   { type: Boolean, default: false },
  liq_vb:          { type: Boolean, default: false },
  liq_enviada:     { type: Boolean, default: false },

  // Imposiciones
  imp_previred:    { type: Boolean, default: false },
  imp_aviso:       { type: Boolean, default: false },
  imp_monto:       Number,

  // LRE
  lre_subido:      { type: Boolean, default: false },
  lre_aviso:       { type: Boolean, default: false },

  // Envíos registrados
  envios_liq:      [{ fecha: String, usuario: String, email: String }],
  envios_imp:      [{ fecha: String, usuario: String, monto: Number }],
  envios_lre:      [{ fecha: String, usuario: String }],
}, { timestamps: true });

// Índice único por empresa + mes + año
rrhhSchema.index({ empresa_id: 1, mes: 1, anio: 1 }, { unique: true });

export default mongoose.model('RRHH', rrhhSchema);
