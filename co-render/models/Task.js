import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  title:      { type: String, required: true, trim: true },
  empresa_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
  cat:        String,
  subcat:     String,
  asignado:   String,
  prio:       { type: String, enum: ['baja','media','alta','urgente'], default: 'media' },
  status:     {
    type: String,
    enum: ['pendiente','en_progreso','en_revision','completada','cancelada'],
    default: 'pendiente',
  },
  due:        String,
  notes:      String,
  created_by: String,
}, { timestamps: true });

export default mongoose.model('Task', schema);
