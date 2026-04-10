import mongoose from 'mongoose';
import bcrypt    from 'bcryptjs';

const schema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true },
  email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6 },
  role:     { type: String, enum: ['admin','user'], default: 'admin' },
  status:   { type: String, enum: ['activo','inactivo'], default: 'activo' },
}, { timestamps: true });

// Hash antes de guardar
schema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Comparar contraseña
schema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

// No exponer password en JSON
schema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

export default mongoose.model('User', schema);
