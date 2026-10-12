import { route, store } from '../lib/route.js';
import { send } from '../lib/http.js';

export default route(['GET'], async (req, res, user) => {
  const rows = await store.threads(user.id);
  send(res, 200, { threads: rows.map(r => ({ ...r.data, ai: r.ai, aiCurrent: !!r.ai && r.ai_hash === r.content_hash })) });
});
