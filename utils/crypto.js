import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGO    = 'aes-256-gcm';
const KEY_HEX = process.env.ENCRYPTION_KEY || '';

function getKey() {
  if (!KEY_HEX || KEY_HEX.length !== 64) {
    console.warn('ENCRYPTION_KEY no configurada — credenciales no encriptadas');
    return null;
  }
  return Buffer.from(KEY_HEX, 'hex');
}

export function encrypt(plaintext) {
  if (!plaintext) return plaintext;
  try {
    const key = getKey();
    if (!key) return plaintext; // sin encriptación si no hay KEY
    const iv     = randomBytes(12);
    const cipher = createCipheriv(ALGO, key, iv);
    const enc    = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag    = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
  } catch { return plaintext; }
}

export function decrypt(ciphertext) {
  if (!ciphertext) return ciphertext;
  if (!ciphertext.includes(':')) return ciphertext;
  try {
    const key = getKey();
    if (!key) return ciphertext;
    const [ivHex, tagHex, encHex] = ciphertext.split(':');
    const decipher = createDecipheriv(ALGO, key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return decipher.update(Buffer.from(encHex, 'hex'), undefined, 'utf8') + decipher.final('utf8');
  } catch { return null; }
}

export function isEncrypted(value) {
  return typeof value === 'string' && value.split(':').length === 3;
}
