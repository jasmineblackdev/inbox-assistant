import { route, store } from '../lib/route.js';
import { readJson, send } from '../lib/http.js';
import { accessToken, saveDraft } from '../lib/google.js';
import { buildReply } from '../lib/parse.js';

// Saves your approved wording as a Gmail draft in the original thread. It is never sent.
export default route(['POST'], async (req, res, user) => {
  const b = await readJson(req);
  const text = typeof b.text === 'string' ? b.text : '';
  if (!text.trim() || text.length > 20000) return send(res, 400, { error: 'bad_text', message: 'The draft is empty or too long.' });
  const row = await store.thread(user.id, String(b.threadId || ''));
  if (!row) return send(res, 404, { error: 'not_found', message: 'That thread isn’t in your synced inbox anymore.' });
  const token = await accessToken(user);
  const d = await saveDraft(token, { draftId: typeof b.draftId === 'string' ? b.draftId : null, threadId: row.thread_id, raw: buildReply(row.data, text, user.email) });
  send(res, 200, { draftId: d.id });
});
