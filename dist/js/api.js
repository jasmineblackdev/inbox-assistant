// Calls to Triageo's own server (Vercel Functions). Same-origin cookies; nothing here talks to Google or the AI provider directly.
const MESSAGES = { 401: 'You’re signed out of Gmail. Connect again to continue.', 409: 'Google access expired or was revoked. Reconnect Gmail.', 429: 'Gmail was just checked. Try again in a minute.', 503: 'The Triageo server isn’t set up yet.' };

async function call(method, path, body) {
  const r = await fetch(path, {
    method, credentials: 'same-origin',
    headers: method === 'GET' ? {} : { 'Content-Type': 'application/json', 'X-Triageo': '1' },
    body: method === 'GET' ? undefined : JSON.stringify(body || {}),
  });
  let j = {};
  try { j = await r.json(); } catch { /* non-JSON, e.g. a static host with no API */ }
  if (!r.ok) {
    const e = new Error(j.message || MESSAGES[r.status] || `Request failed (${r.status}).`);
    e.status = r.status; e.code = j.error;
    throw e;
  }
  return j;
}

export const api = {
  me: (usage = false) => call('GET', usage ? '/api/me?usage=1' : '/api/me'),
  saveMe: body => call('PUT', '/api/me', body),
  inbox: () => call('GET', '/api/inbox'),
  sync: () => call('POST', '/api/sync'),
  regenerate: body => call('POST', '/api/draft', body),
  saveGmailDraft: body => call('POST', '/api/gmail-draft', body),
  disconnect: () => call('POST', '/api/disconnect'),
  signOut: () => call('POST', '/api/auth/logout'),
};

export const connectUrl = '/api/auth/google/start';
