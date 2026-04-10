import jwt from 'jsonwebtoken';

export function protect(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer '))
    return res.status(401).json({ error: 'No autorizado. Token requerido.' });

  try {
    const token   = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, name }
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado.' });
  }
}
