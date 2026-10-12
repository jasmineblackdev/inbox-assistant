import { isConfigured, missingConfig, SCHEDULE_LABEL, AI_MODELS, DEFAULT_MODEL } from '../lib/config.js';
import { readJson, send, sessionUid, sameOrigin } from '../lib/http.js';
import { store } from '../lib/db.js';
import { decrypt } from '../lib/crypto.js';
import { keyInfo } from '../lib/ai.js';

const view = (u, lastRun, usage) => ({
  email: u.email, name: u.name, scheduleEnabled: u.schedule_enabled, needsReconnect: u.needs_reconnect,
  lastSyncAt: u.last_sync_at, lastRun,
  ai: { connected: !!u.ai_key, provider: 'OpenRouter', model: AI_MODELS.some(m => m.id === u.ai_model) ? u.ai_model : DEFAULT_MODEL, usage },
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
      if (b.aiDisconnect === true) await store.setAiKey(user.id, null);
      user = await store.updateUser(user.id, {
        name: typeof b.name === 'string' && b.name.trim() ? b.name.trim().slice(0, 40) : undefined,
        scheduleEnabled: typeof b.scheduleEnabled === 'boolean' ? b.scheduleEnabled : undefined,
        aiModel: AI_MODELS.some(m => m.id === b.aiModel) ? b.aiModel : undefined,
      });
    } else if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });
    let usage = null;
    if (user?.ai_key && new URL(req.url, 'http://x').searchParams.get('usage') === '1') {
      try { usage = await keyInfo(decrypt(user.ai_key)); }
      catch (e) { if (e.code === 'revoked') { await store.setAiKey(user.id, null); user = await store.user(user.id); } }
    }
    send(res, 200, { configured: true, schedule: SCHEDULE_LABEL, models: AI_MODELS, user: user ? view(user, await store.lastRun(user.id), usage) : null });
  } catch (e) {
    console.error('[triageo] me', e.message);
    send(res, 500, { error: 'server', message: 'Couldn’t load your account.' });
  }
}
