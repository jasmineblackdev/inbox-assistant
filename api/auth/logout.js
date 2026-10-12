import { endSession, sameOrigin, send } from '../../lib/http.js';
export default function handler(req, res) {
  if (req.method !== 'POST' || !sameOrigin(req)) return send(res, 403, { error: 'forbidden' });
  endSession(res);
  send(res, 200, { ok: true });
}
