import { route, store } from '../lib/route.js';
import { readJson, send } from '../lib/http.js';
import { draftReply, TONES, AiError } from '../lib/ai.js';
import { decrypt } from '../lib/crypto.js';

// Regenerate one AI draft with the user's own AI account, optionally with a tone and instructions.
export default route(['POST'], async (req, res, user) => {
  if (!user.ai_key) return send(res, 424, { error: 'ai_revoked', message: 'Connect an AI account in Settings to draft replies.' });
  const b = await readJson(req);
  const row = await store.thread(user.id, String(b.threadId || ''));
  if (!row) return send(res, 404, { error: 'not_found', message: 'That thread isn’t in your synced inbox anymore.' });
  const tone = b.tone in TONES ? b.tone : 'friendly';
  try {
    const ai = await draftReply({ item: row.data, name: user.name || user.email.split('@')[0], apiKey: decrypt(user.ai_key), model: user.ai_model, tone, instructions: typeof b.instructions === 'string' ? b.instructions : '' });
    await store.setAi(user.id, row.thread_id, ai, row.content_hash);
    send(res, 200, { ai });
  } catch (e) {
    if (e instanceof AiError && e.code === 'revoked') await store.setAiKey(user.id, null);
    throw e;
  }
});
