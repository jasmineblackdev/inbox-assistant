// Google OAuth (server-side code flow) and the few Gmail calls Triageo makes.
import { env, SCOPES } from './config.js';
import { decrypt } from './crypto.js';

export class ReconnectError extends Error {
  constructor() { super('Google access was revoked or expired. Reconnect Gmail.'); this.name = 'ReconnectError'; }
}

export const redirectUri = origin => `${origin}/api/auth/google/callback`;

export function authUrl(origin, state) {
  const u = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  u.search = new URLSearchParams({
    client_id: env('GOOGLE_CLIENT_ID'), redirect_uri: redirectUri(origin), response_type: 'code',
    scope: SCOPES.join(' '), access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state,
  });
  return u.toString();
}

async function tokenRequest(params) {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env('GOOGLE_CLIENT_ID'), client_secret: env('GOOGLE_CLIENT_SECRET'), ...params }),
  });
  const j = await r.json().catch(() => ({}));
  if (j.error === 'invalid_grant') throw new ReconnectError();
  if (!r.ok) throw new Error(`Google token error: ${j.error_description || j.error || r.status}`);
  return j;
}

export async function exchangeCode(origin, code) {
  const t = await tokenRequest({ code, grant_type: 'authorization_code', redirect_uri: redirectUri(origin) });
  // The ID token came straight from Google over TLS, so its claims can be read without re-verifying the signature.
  const claims = JSON.parse(Buffer.from(t.id_token.split('.')[1], 'base64url').toString('utf8'));
  const granted = (t.scope || '').split(' ');
  return { tokens: t, sub: claims.sub, email: claims.email, emailVerified: claims.email_verified, name: claims.given_name || claims.name || '', granted };
}

export async function accessToken(user) {
  if (!user.refresh_token) throw new ReconnectError();
  return (await tokenRequest({ refresh_token: decrypt(user.refresh_token), grant_type: 'refresh_token' })).access_token;
}

export async function revoke(user) {
  if (!user.refresh_token) return;
  await fetch('https://oauth2.googleapis.com/revoke', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: decrypt(user.refresh_token) }) }).catch(() => {});
}

const API = 'https://gmail.googleapis.com/gmail/v1/users/me';
async function gmail(token, path, { method = 'GET', params, body } = {}) {
  const u = new URL(API + path);
  if (params) for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const r = await fetch(u, { method, headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  if (r.status === 401) throw new ReconnectError();
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    const e = new Error(j.error?.message || `Gmail error ${r.status}`); e.status = r.status; throw e;
  }
  return r.json();
}

export const listThreads = (token, q, max) => gmail(token, '/threads', { params: { q, maxResults: max } }).then(j => (j.threads || []).map(t => t.id));
export const getThread = (token, id) => gmail(token, `/threads/${id}`, { params: { format: 'full' } });

/** Create or update a Gmail draft. Never sends. */
export async function saveDraft(token, { draftId, threadId, raw }) {
  const message = { raw, threadId };
  if (draftId) {
    try { return await gmail(token, `/drafts/${draftId}`, { method: 'PUT', body: { id: draftId, message } }); }
    catch (e) { if (e.status !== 404) throw e; /* deleted in Gmail: fall through and create a new one */ }
  }
  return gmail(token, '/drafts', { method: 'POST', body: { message } });
}
