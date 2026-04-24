import mongoose from 'mongoose';

const ivaSchema = new mongoose.Schema({
  empresa_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  mes:        { type: String, required: true },
  anio:       { type: Number, required: true },

  f29:        { type: Boolean, default: false },
  aviso:      { type: Boolean, default: false },
  monto:      Number,

  notif_enviada: { type: Boolean, default: false },
  notif_fecha:   String,
  copia_enviada: { type: Boolean, default: false },
  copia_fecha:   String,
}, { timestamps: true });

ivaSchema.index({ empresa_id: 1, mes: 1, anio: 1 }, { unique: true });

export default mongoose.model('IVA', ivaSchema);
