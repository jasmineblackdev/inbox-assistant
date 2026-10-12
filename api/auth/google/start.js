import { isConfigured } from '../../../lib/config.js';
import { authUrl } from '../../../lib/google.js';
import { randomToken } from '../../../lib/crypto.js';
import { origin, setCookie } from '../../../lib/http.js';

export default function handler(req, res) {
  if (!isConfigured()) { res.writeHead(302, { Location: '/?gmail=unconfigured#/overview' }); return res.end(); }
  const state = randomToken(24);
  setCookie(res, 'tg_oauth', state, { maxAge: 600, path: '/api/auth' });
  res.writeHead(302, { Location: authUrl(origin(req), state) });
  res.end();
}
