import { route, store } from '../lib/route.js';
import { readJson, send } from '../lib/http.js';
import { draftReply, TONES } from '../lib/ai.js';

// Regenerate one AI draft, optionally with a tone and your own instructions.
export default route(['POST'], async (req, res, user) => {
  const b = await readJson(req);
  const row = await store.thread(user.id, String(b.threadId || ''));
  if (!row) return send(res, 404, { error: 'not_found', message: 'That thread isn’t in your synced inbox anymore.' });
  const tone = b.tone in TONES ? b.tone : 'friendly';
  const ai = await draftReply({ item: row.data, name: user.name || user.email.split('@')[0], tone, instructions: typeof b.instructions === 'string' ? b.instructions : '' });
  await store.setAi(user.id, row.thread_id, ai, row.content_hash);
  send(res, 200, { ai });
});
