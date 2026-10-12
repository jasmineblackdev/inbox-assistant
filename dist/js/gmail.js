// Read-only Gmail access from the browser via Google Identity Services.
// The access token lives in memory only and expires after about an hour; nothing is sent anywhere but Google.
import { GOOGLE_CLIENT_ID } from './config.js';

export const SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
export const QUERY = 'in:inbox newer_than:14d -category:promotions -category:social -category:forums -category:updates';
const API = 'https://gmail.googleapis.com/gmail/v1/users/me';

let token = null, expires = 0, gis = null;

export class AuthError extends Error {
  constructor() { super('Your Gmail session expired. Reconnect to continue.'); this.name = 'AuthError'; }
}

export const configured = () => !!GOOGLE_CLIENT_ID;
export const hasToken = () => !!token && Date.now() < expires - 60000;

function loadGis() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return gis ||= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = resolve;
    s.onerror = () => { gis = null; reject(new Error('Couldn’t load Google sign-in. Check your connection or any content blocker.')); };
    document.head.append(s);
  });
}

/** Load Google's script ahead of time so the sign-in popup opens straight from the click. */
export const prepare = () => loadGis().catch(() => {});

/** Opens Google's consent popup. Must be called from a click. */
export async function signIn(hint) {
  await loadGis();
  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPE,
      hint,
      callback: r => {
        if (r.error) return reject(new Error(r.error_description || 'Google sign-in was cancelled.'));
        if (!google.accounts.oauth2.hasGrantedAllScopes(r, SCOPE)) return reject(new Error('Gmail read access wasn’t granted, so nothing was imported.'));
        token = r.access_token;
        expires = Date.now() + Number(r.expires_in || 3600) * 1000;
        resolve();
      },
      error_callback: e => reject(new Error(
        e.type === 'popup_closed' ? 'The Google sign-in window was closed.'
          : e.type === 'popup_failed_to_open' ? 'Your browser blocked the Google sign-in window. Allow pop-ups for this site and try again.'
            : e.message || 'Google sign-in failed.')),
    });
    client.requestAccessToken({ prompt: '' });
  });
}

export function signOut() {
  if (token && window.google?.accounts?.oauth2) google.accounts.oauth2.revoke(token, () => {});
  token = null; expires = 0;
}

async function api(path, params = {}) {
  if (!hasToken()) throw new AuthError();
  const url = new URL(API + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (r.status === 401) { token = null; throw new AuthError(); }
  if (!r.ok) {
    let msg = `Gmail request failed (${r.status}).`;
    try { msg = (await r.json()).error.message || msg; } catch { /* keep generic message */ }
    throw new Error(msg);
  }
  return r.json();
}

export const profile = () => api('/profile');

/* ---------- message parsing ---------- */
const header = (m, name) => m.payload?.headers?.find(h => h.name.toLowerCase() === name)?.value || '';

export function parseAddress(v) {
  const m = String(v).match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  return m ? { name: m[1].trim() || m[2].trim(), email: m[2].trim() } : { name: String(v).trim(), email: String(v).trim() };
}

function decode(data) {
  const bin = atob(data.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
}

function findPart(p, type) {
  if (!p) return null;
  if (p.mimeType === type && p.body?.data) return p;
  for (const c of p.parts || []) { const f = findPart(c, type); if (f) return f; }
  return null;
}

export function messageText(m) {
  const plain = findPart(m.payload, 'text/plain');
  let text;
  if (plain) text = decode(plain.body.data);
  else {
    const html = findPart(m.payload, 'text/html');
    if (html) {
      // DOMParser never runs scripts or loads images; we only read the text.
      const doc = new DOMParser().parseFromString(decode(html.body.data), 'text/html');
      doc.querySelectorAll('style,script,head,title').forEach(n => n.remove());
      doc.querySelectorAll('br,p,div,li,tr,h1,h2,h3').forEach(n => n.append('\n'));
      text = doc.body?.textContent || '';
    } else text = m.snippet || '';
  }
  // Drop quoted history; earlier messages are shown separately.
  const lines = text.replace(/\r/g, '').split('\n');
  const cut = lines.findIndex(l => /^On .+wrote:\s*$/.test(l.trim()) || /^-{2,}\s*Original Message/i.test(l.trim()));
  return (cut > 0 ? lines.slice(0, cut) : lines).filter(l => !/^>/.test(l.trim()))
    .join('\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Convert a Gmail thread into a Triageo item, or null if it has no message from someone else. */
export function toItem(thread, me) {
  const msgs = thread.messages || [];
  const mine = m => (m.labelIds || []).includes('SENT') || parseAddress(header(m, 'from')).email.toLowerCase() === me.toLowerCase();
  const inbound = [...msgs].reverse().find(m => !mine(m));
  if (!inbound) return null;
  const from = parseAddress(header(inbound, 'from'));
  const when = m => new Date(Number(m.internalDate)).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });
  const body = msgs.slice(-5).map(m => `— ${mine(m) ? 'You' : parseAddress(header(m, 'from')).name} · ${when(m)} ET\n${messageText(m)}`).join('\n\n');
  const automated = !!header(inbound, 'list-unsubscribe') || /^(bulk|list|junk)$/i.test(header(inbound, 'precedence'))
    || /(no-?reply|do-?not-?reply|notifications?)@/i.test(from.email);
  return {
    id: 'gmail:' + thread.id, source: 'gmail', gmailThreadId: thread.id,
    sender: from.name, email: from.email,
    subject: header(msgs[0], 'subject') || '(no subject)',
    body: body.length > 8000 ? body.slice(0, 8000) + '\n\n[Shortened — open in Gmail for the full thread]' : body,
    snippet: messageText(inbound).slice(0, 240), request: '', received: new Date(Number(inbound.internalDate)).toISOString(), deadline: null,
    important: msgs.some(m => (m.labelIds || []).includes('STARRED')),
    needsReply: !mine(msgs[msgs.length - 1]),
    automated, draft: '', notes: '', approved: false,
  };
}

/** Fetch recent inbox threads. Requests run five at a time to stay well inside Gmail's rate limits. */
export async function fetchThreads(me, { max = 25 } = {}) {
  const list = await api('/threads', { q: QUERY, maxResults: max });
  const ids = (list.threads || []).map(t => t.id);
  const out = [];
  for (let i = 0; i < ids.length; i += 5) {
    out.push(...await Promise.all(ids.slice(i, i + 5).map(id => api(`/threads/${id}`, { format: 'full' }))));
  }
  return out.map(t => toItem(t, me)).filter(Boolean);
}
