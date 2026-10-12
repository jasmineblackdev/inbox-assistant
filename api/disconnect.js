import { route, store } from '../lib/route.js';
import { revoke } from '../lib/google.js';
import { endSession, send } from '../lib/http.js';

// Revokes Google access and deletes everything Triageo stored on the server for this account.
export default route(['POST'], async (req, res, user) => {
  await revoke(user);
  await store.deleteUser(user.id);
  endSession(res);
  send(res, 200, { ok: true });
});
