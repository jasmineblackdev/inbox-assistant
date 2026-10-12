// Everything that shows Gmail connection state, so every surface tells the same story.
import { icon } from '../icons.js';
import { esc, ago } from '../format.js';
import { state } from '../store.js';
import { button } from './components.js';

export const sync = { busy: false };

/** 'loading' | 'unconfigured' | 'disconnected' | 'expired' | 'connected' */
export function status() {
  const s = state.server;
  if (!s.loaded) return 'loading';
  if (!s.configured) return 'unconfigured';
  if (!s.user) return 'disconnected';
  return s.user.needsReconnect ? 'expired' : 'connected';
}
const linked = s => s === 'connected' || s === 'expired';

const COPY = {
  loading: ['Checking Gmail…', '', 'off'],
  unconfigured: ['Gmail not connected', 'Setup needed', 'off'],
  disconnected: ['Gmail not connected', 'Manual import mode', 'off'],
  expired: ['Reconnect Gmail', 'Google access expired', 'warn'],
  connected: ['Gmail connected', '', 'on'],
};

export function pillHTML() {
  const s = status();
  return `<span class="status-dot dot-${COPY[s][2]}"></span><span>${COPY[s][0]}</span>`;
}

export function sidebarCardHTML() {
  const s = status();
  return `<span class="conn-icon conn-${COPY[s][2]}">${icon(s === 'connected' ? 'mail' : 'plug-zap', 16)}</span>
    <span class="conn-text"><strong>${COPY[s][0]}</strong><small>${esc(linked(s) ? state.server.user.email : COPY[s][1])}</small></span>
    <span class="conn-chevron">${icon('chevron-right', 16)}</span>`;
}

export function lastCheck() {
  const r = state.server.user?.lastRun;
  if (!r) return 'Not checked yet';
  const when = `${r.kind === 'scheduled' ? 'Scheduled check' : 'Last check'} ${ago(r.finished_at)}`;
  if (r.error) return `${when} failed: ${r.error}`;
  return `${when}: ${r.found} need${r.found === 1 ? 's' : ''} a reply, ${r.drafted} drafted${r.failed ? `, ${r.failed} couldn’t be drafted` : ''}`;
}

export function scheduleLine() {
  const u = state.server.user;
  return u?.scheduleEnabled ? `Checks ${state.server.schedule}` : 'Scheduled checks are off';
}

/** Primary action for the current state, or '' when nothing can be done in-app. */
export function primaryButton({ size = '' } = {}) {
  const s = status();
  if (sync.busy) return button('Checking Gmail…', { variant: 'primary', ic: 'loader-circle', size, attrs: 'disabled aria-busy="true"' });
  if (s === 'disconnected') return button('Connect Gmail', { action: 'gmail-connect', variant: 'primary', ic: 'mail', size });
  if (s === 'expired') return button('Reconnect Gmail', { action: 'gmail-connect', variant: 'primary', ic: 'mail', size });
  if (s === 'connected') return button('Check now', { action: 'gmail-sync', variant: 'secondary', ic: 'download', size });
  return '';
}

const ticks = (items, off) => `<ul class="ticks ${off ? 'ticks-off' : ''}">${items.map(i => `<li>${icon(off ? 'x' : 'check', 14)}${i}</li>`).join('')}</ul>`;
const CAN = ['Find recent inbox threads that need a reply', 'Draft each reply with OpenAI for you to review', 'Save the wording you approve to Gmail Drafts', 'Check again on weekday mornings'];
const CANT = ['Send email — you send from Gmail', 'Delete, archive or label mail', 'Share your mail with anyone but OpenAI (for drafting)'];

export function overviewCardHTML({ compact = false } = {}) {
  const s = status();
  if (s === 'loading') return '';
  const head = {
    unconfigured: ['Gmail isn’t connected', 'Triageo is in manual mode until the server is set up.'],
    disconnected: ['Connect your Gmail', 'Triageo will find emails that need a reply and draft each one. Nothing is sent: approved drafts go to your Gmail Drafts folder.'],
    expired: ['Reconnect Gmail', `Google access for ${esc(state.server.user?.email)} expired or was revoked, so scheduled checks are paused.`],
    connected: ['Gmail connected', `${esc(state.server.user?.email)} · ${esc(scheduleLine())}. ${esc(lastCheck())}.`],
  }[s];
  return `<section class="card conn-panel ${compact ? 'conn-panel-compact' : ''}">
    <div class="conn-panel-head"><span class="conn-badge conn-${COPY[s][2]}">${icon(linked(s) ? 'mail' : 'plug-zap', 16)}</span><div><h2>${head[0]}</h2><p>${head[1]}</p></div></div>
    ${compact ? '' : `<div class="conn-cols"><div><h3>Triageo can</h3>${ticks(s === 'unconfigured' ? ['Manual import', 'Priority sorting', 'Draft editing and approval', 'Plain-text export'] : CAN)}</div><div><h3>It can’t</h3>${ticks(CANT, true)}</div></div>`}
    <div class="conn-actions">${primaryButton({ size: compact ? 'btn-sm' : '' })}<button type="button" class="link" data-action="open-connection">${s === 'unconfigured' ? 'What setup is needed' : 'Connection details'} ${icon('arrow-right', 14)}</button></div>
  </section>`;
}

export function dialogBodyHTML() {
  const s = status();
  const close = `<button type="button" class="icon-btn" data-close aria-label="Close">${icon('x', 18)}</button>`;
  const u = state.server.user;
  let body;
  if (s === 'unconfigured' || s === 'loading') {
    body = `<p>The Triageo server isn’t set up yet, so Gmail can’t be connected. The site owner needs to add Google, OpenAI and database settings in Vercel (see the README). Until then, import emails manually.</p>`;
  } else {
    body = `${linked(s) ? `<div class="setting-row"><div><strong>${esc(u.email)}</strong><small>${esc(lastCheck())}</small></div>${primaryButton({ size: 'btn-sm' })}</div>` : '<p>Sign in with Google. Google will show exactly what Triageo is asking for: reading mail and managing drafts.</p>'}
      <div class="conn-cols"><div><h3>Triageo can</h3>${ticks(CAN)}</div><div><h3>It can’t</h3>${ticks(CANT, true)}</div></div>
      <p class="muted small">Each check looks at up to 25 inbox threads from the last 14 days, skipping Gmail’s Promotions, Social, Updates and Forums tabs, and drafts up to 12 new replies. Your Google sign-in is stored encrypted on Triageo’s server so scheduled checks can run. Thread text and drafts are kept for 14 days. Threads that need a reply are sent to OpenAI to draft a response. OpenAI’s API doesn’t train on them, though it may keep them for up to 30 days for abuse monitoring. Disconnecting deletes everything Triageo stored on the server.</p>`;
  }
  return `<header class="dialog-head"><div><h2 id="connTitle">Gmail connection</h2><p><span class="status-pill static">${pillHTML()}</span></p></div>${close}</header>
    ${body}
    <div class="callout">${icon('shield-check', 16)}<p><strong>Nothing is sent.</strong> Replies you approve are saved to Gmail Drafts. You review and press Send in Gmail yourself.</p></div>
    <footer class="dialog-foot">${linked(s) ? button('Disconnect and delete server data', { action: 'gmail-disconnect', variant: 'ghost', ic: 'trash-2' }) + button('Sign out', { action: 'sign-out', variant: 'ghost', ic: 'log-out' }) : ''}<span class="spacer"></span>${s === 'disconnected' ? primaryButton() : ''}<button type="button" class="btn btn-secondary" data-close>Close</button></footer>`;
}
