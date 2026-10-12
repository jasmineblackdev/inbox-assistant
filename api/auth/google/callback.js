import { allowedEmails, isConfigured, SCOPES } from '../../../lib/config.js';
import { exchangeCode } from '../../../lib/google.js';
import { encrypt } from '../../../lib/crypto.js';
import { cookies, origin, setCookie, startSession } from '../../../lib/http.js';
import { store } from '../../../lib/db.js';

const back = (res, status) => { res.writeHead(302, { Location: `/?gmail=${status}#/overview` }); res.end(); };

export default async function handler(req, res) {
  const q = new URL(req.url, 'http://x').searchParams;
  const expected = cookies(req).tg_oauth;
  setCookie(res, 'tg_oauth', '', { maxAge: 0, path: '/api/auth' });
  if (!isConfigured()) return back(res, 'unconfigured');
  if (q.get('error')) return back(res, 'cancelled');
  if (!expected || q.get('state') !== expected || !q.get('code')) return back(res, 'state');
  try {
    const g = await exchangeCode(origin(req), q.get('code'));
    if (!g.emailVerified || !allowedEmails().includes(String(g.email).toLowerCase())) return back(res, 'not_allowed');
    if (!SCOPES.filter(s => s.startsWith('https://')).every(s => g.granted.includes(s))) return back(res, 'scopes');
    const user = await store.upsertUser({ id: g.sub, email: g.email, name: g.name || null, refreshToken: g.tokens.refresh_token ? encrypt(g.tokens.refresh_token) : null });
    if (!user.refresh_token) return back(res, 'no_refresh');
    startSession(res, user.id);
    return back(res, 'connected');
  } catch (e) {
    console.error('[triageo] oauth callback', e.message);
    return back(res, 'error');
  }
}
