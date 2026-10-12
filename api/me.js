import { isConfigured, missingConfig, SCHEDULE_LABEL } from '../lib/config.js';
import { readJson, send, sessionUid, sameOrigin } from '../lib/http.js';
import { store } from '../lib/db.js';

const view = (u, lastRun) => ({
  email: u.email, name: u.name, scheduleEnabled: u.schedule_enabled, needsReconnect: u.needs_reconnect,
  lastSyncAt: u.last_sync_at, lastRun,
});

export default async function handler(req, res) {
  try {
    if (!isConfigured()) return send(res, 200, { configured: false, missing: missingConfig().length });
    const uid = sessionUid(req);
    let user = uid && await store.user(uid);
    if (req.method === 'PUT') {
      if (!user) return send(res, 401, { error: 'signed_out' });
      if (!sameOrigin(req)) return send(res, 403, { error: 'Cross-site request blocked' });
      const b = await readJson(req);
      user = await store.updateUser(user.id, {
        name: typeof b.name === 'string' && b.name.trim() ? b.name.trim().slice(0, 40) : undefined,
        scheduleEnabled: typeof b.scheduleEnabled === 'boolean' ? b.scheduleEnabled : undefined,
      });
    } else if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });
    send(res, 200, { configured: true, schedule: SCHEDULE_LABEL, user: user ? view(user, await store.lastRun(user.id)) : null });
  } catch (e) {
    console.error('[triageo] me', e.message);
    send(res, 500, { error: 'server', message: 'Couldn’t load your account.' });
  }
}
