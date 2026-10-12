import { env, isConfigured } from '../lib/config.js';
import { send } from '../lib/http.js';
import { store } from '../lib/db.js';
import { deps } from '../lib/deps.js';
import { syncUser } from '../lib/pipeline.js';

export const config = { maxDuration: 300 };

// Called by Vercel Cron (see vercel.json). Vercel sends CRON_SECRET as a bearer token.
export default async function handler(req, res) {
  if (!env('CRON_SECRET') || req.headers.authorization !== `Bearer ${env('CRON_SECRET')}`) return send(res, 401, { error: 'unauthorized' });
  if (!isConfigured()) return send(res, 503, { error: 'not_configured' });
  const results = [];
  for (const user of await store.scheduledUsers()) {
    try { results.push({ ok: true, ...(await syncUser(user, 'scheduled', deps)) }); }
    catch (e) { results.push({ ok: false }); console.error('[triageo] scheduled sync failed', e.message); }
  }
  send(res, 200, { users: results.length, ok: results.filter(r => r.ok).length });
}
