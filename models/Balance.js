import mongoose from 'mongoose';

const balanceSchema = new mongoose.Schema({
  empresa_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  mes:        { type: String, required: true },
  anio:       { type: Number, required: true },

  compras:    { type: Boolean, default: false },
  ventas:     { type: Boolean, default: false },
  honorarios: { type: Boolean, default: false },
  rrhh:       { type: Boolean, default: false },
  otros:      { type: Boolean, default: false },
  procesado:  { type: Boolean, default: false },
  vb:         { type: Boolean, default: false },
  cerrado:    { type: Boolean, default: false },

  envios: [{ fecha: String, usuario: String, email: String }],
}, { timestamps: true });

balanceSchema.index({ empresa_id: 1, mes: 1, anio: 1 }, { unique: true });

export default mongoose.model('Balance', balanceSchema);
