// Request helpers: cookies, sessions and same-origin checks for state-changing requests.
import { sign, verify } from './crypto.js';

export const SESSION = 'tg_session';
const SESSION_DAYS = 30;

export function cookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').map(c => c.trim().split('=')).filter(([k]) => k).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));
}

export function setCookie(res, name, value, { maxAge, path = '/' } = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${path}`, 'HttpOnly', 'Secure', 'SameSite=Lax'];
  if (maxAge != null) parts.push(`Max-Age=${maxAge}`);
  const prev = res.getHeader('Set-Cookie');
  res.setHeader('Set-Cookie', [...(Array.isArray(prev) ? prev : prev ? [prev] : []), parts.join('; ')]);
}

export const startSession = (res, uid) => setCookie(res, SESSION, sign({ uid, exp: Date.now() + SESSION_DAYS * 864e5 }), { maxAge: SESSION_DAYS * 86400 });
export const endSession = res => setCookie(res, SESSION, '', { maxAge: 0 });
export const sessionUid = req => verify(cookies(req)[SESSION])?.uid || null;

export const origin = req => `https://${req.headers['x-forwarded-host'] || req.headers.host}`;

/** Blocks cross-site form posts: POST/PUT must come from this origin with our custom header. */
export function sameOrigin(req) {
  return req.headers['x-triageo'] === '1' && (!req.headers.origin || req.headers.origin === origin(req));
}

export function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = '';
  for await (const chunk of req) { raw += chunk; if (raw.length > 100_000) throw new Error('Request too large'); }
  return raw ? JSON.parse(raw) : {};
}
