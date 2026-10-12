import { createHash } from 'node:crypto';
import { isConfigured } from '../lib/config.js';
import { cookies, origin, sessionUid, setCookie } from '../lib/http.js';
import { encrypt, randomToken, sign, verify } from '../lib/crypto.js';
import { exchangeOpenRouterCode } from '../lib/ai.js';
import { store } from '../lib/db.js';

// GET /api/ai          → send the signed-in user to OpenRouter to approve a key (OAuth PKCE)
// GET /api/ai?code=…   → OpenRouter sends them back here; exchange the code and store the key encrypted
const back = (res, status) => { res.writeHead(302, { Location: `/?ai=${status}#/overview` }); res.end(); };
const COOKIE = 'tg_ai';

export default async function handler(req, res) {
  if (req.method !== 'GET') { res.statusCode = 405; return res.end(); }
  if (!isConfigured()) return back(res, 'unconfigured');
  const uid = sessionUid(req);
  if (!uid || !(await store.user(uid))) return back(res, 'signed_out');
  const q = new URL(req.url, 'http://x').searchParams;

  if (!q.has('code')) {
    const verifier = randomToken(48), state = randomToken(16);
    setCookie(res, COOKIE, sign({ verifier, state, uid, exp: Date.now() + 600_000 }), { maxAge: 600, path: '/api/ai' });
    const u = new URL('https://openrouter.ai/auth');
    u.search = new URLSearchParams({
      callback_url: `${origin(req)}/api/ai`, code_challenge: createHash('sha256').update(verifier).digest('base64url'),
      code_challenge_method: 'S256', state, key_label: 'Triageo',
    });
    res.writeHead(302, { Location: u.toString() });
    return res.end();
  }

  const pending = verify(cookies(req)[COOKIE]);
  setCookie(res, COOKIE, '', { maxAge: 0, path: '/api/ai' });
  if (!pending || pending.uid !== uid || q.get('state') !== pending.state) return back(res, 'state');
  try {
    const key = await exchangeOpenRouterCode(q.get('code'), pending.verifier);
    await store.setAiKey(uid, encrypt(key));
    return back(res, 'connected');
  } catch (e) {
    console.error('[triageo] openrouter exchange', e.message);
    return back(res, 'error');
  }
}
