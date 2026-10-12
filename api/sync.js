import { route, store } from '../lib/route.js';
import { send } from '../lib/http.js';
import { deps } from '../lib/deps.js';
import { syncUser } from '../lib/pipeline.js';

export const config = { maxDuration: 300 };

export default route(['POST'], async (req, res, user) => {
  if (user.last_sync_at && Date.now() - Date.parse(user.last_sync_at) < 60_000) return send(res, 429, { error: 'too_soon', message: 'Gmail was just checked. Try again in a minute.' });
  const result = await syncUser(user, 'manual', deps);
  send(res, 200, result);
});
