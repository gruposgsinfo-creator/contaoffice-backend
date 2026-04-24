import mongoose from 'mongoose';
import bcrypt    from 'bcryptjs';

const schema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true },
  email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6 },
  role:     { type: String, enum: ['admin','user'], default: 'admin' },
  status:   { type: String, enum: ['activo','inactivo'], default: 'activo' },
}, { timestamps: true });

schema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

schema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

schema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

export default mongoose.model('User', schema);
