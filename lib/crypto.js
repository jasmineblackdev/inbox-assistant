// Session signing and token encryption. Keys come from env and never leave the server.
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from './config.js';

const b64u = buf => Buffer.from(buf).toString('base64url');
export const randomToken = (n = 32) => b64u(randomBytes(n));

function key() {
  const k = Buffer.from(env('TOKEN_KEY'), 'base64');
  if (k.length !== 32) throw new Error('TOKEN_KEY must be 32 bytes, base64-encoded.');
  return k;
}

/** AES-256-GCM. Output: iv.tag.ciphertext (base64url). */
export function encrypt(text) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([c.update(text, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), data].map(b64u).join('.');
}
export function decrypt(packed) {
  const [iv, tag, data] = packed.split('.').map(s => Buffer.from(s, 'base64url'));
  const d = createDecipheriv('aes-256-gcm', key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(data), d.final()]).toString('utf8');
}

const hmac = s => createHmac('sha256', env('SESSION_SECRET')).update(s).digest();

export function sign(payload) {
  const body = b64u(JSON.stringify(payload));
  return `${body}.${b64u(hmac(body))}`;
}
export function verify(token) {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expected = hmac(body), given = Buffer.from(sig, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    return p.exp && p.exp > Date.now() ? p : null;
  } catch { return null; }
}
