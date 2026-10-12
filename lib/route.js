// Shared wrapper for API routes: config check, method check, CSRF check, session lookup, error mapping.
import { isConfigured } from './config.js';
import { send, sameOrigin, sessionUid } from './http.js';
import { store } from './db.js';
import { ReconnectError } from './google.js';

export function route(methods, handler, { auth = true } = {}) {
  return async (req, res) => {
    try {
      if (!methods.includes(req.method)) return send(res, 405, { error: 'Method not allowed' });
      if (!isConfigured()) return send(res, 503, { error: 'not_configured' });
      if (req.method !== 'GET' && !sameOrigin(req)) return send(res, 403, { error: 'Cross-site request blocked' });
      let user = null;
      if (auth) {
        const uid = sessionUid(req);
        user = uid && await store.user(uid);
        if (!user) return send(res, 401, { error: 'signed_out' });
      }
      return await handler(req, res, user);
    } catch (e) {
      if (e instanceof ReconnectError) return send(res, 409, { error: 'reconnect', message: e.message });
      console.error('[triageo]', req.url, e.message);
      return send(res, 500, { error: 'server', message: e.message?.startsWith('OpenAI') || e.message?.startsWith('Gmail') ? e.message : 'Something went wrong on the server.' });
    }
  };
}

export { store };
