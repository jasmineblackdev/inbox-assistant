// Everything that shows Gmail connection state, in one place so every surface tells the same story.
import { icon } from '../icons.js';
import { esc, ago } from '../format.js';
import { state } from '../store.js';
import { configured, hasToken, QUERY } from '../gmail.js';
import { button } from './components.js';

export const sync = { busy: false };

/** 'unconfigured' | 'disconnected' | 'expired' | 'connected' */
export function status() {
  if (!configured()) return 'unconfigured';
  if (!state.gmail.email) return 'disconnected';
  return hasToken() ? 'connected' : 'expired';
}

const COPY = {
  unconfigured: ['Gmail not connected', 'Setup needed', 'off'],
  disconnected: ['Gmail not connected', 'Manual import mode', 'off'],
  expired: ['Gmail signed out', 'Reconnect to fetch mail', 'warn'],
  connected: ['Gmail connected', '', 'on'],
};
const label = s => COPY[s][0];
const sub = s => s === 'connected' || s === 'expired' ? state.gmail.email : COPY[s][1];

export function pillHTML() {
  const s = status();
  return `<span class="status-dot dot-${COPY[s][2]}"></span><span>${label(s)}</span>`;
}

export function sidebarCardHTML() {
  const s = status();
  return `<span class="conn-icon conn-${COPY[s][2]}">${icon(s === 'connected' ? 'mail' : 'plug-zap', 16)}</span>
    <span class="conn-text"><strong>${label(s)}</strong><small>${esc(sub(s))}</small></span>
    <span class="conn-chevron">${icon('chevron-right', 16)}</span>`;
}

const lastSync = () => state.gmail.lastSync ? `Last fetched ${ago(state.gmail.lastSync)}` : 'Not fetched yet';

/** Primary action for the current state, or '' when nothing can be done in-app. */
export function primaryButton({ size = '' } = {}) {
  const s = status();
  if (sync.busy) return button('Fetching…', { variant: 'primary', ic: 'loader-circle', size, attrs: 'disabled aria-busy="true"' });
  if (s === 'disconnected') return button('Connect Gmail', { action: 'gmail-connect', variant: 'primary', ic: 'mail', size });
  if (s === 'expired') return button('Reconnect Gmail', { action: 'gmail-sync', variant: 'primary', ic: 'mail', size });
  if (s === 'connected') return button('Fetch new mail', { action: 'gmail-sync', variant: 'secondary', ic: 'download', size });
  return '';
}

const AVAILABLE = ['Manual import', 'Priority sorting', 'Draft editing and notes', 'Individual approval', 'Plain-text export'];
const UNAVAILABLE = ['AI draft generation', 'Scheduled weekday reviews', 'Sending — never automatic'];
const ticks = (items, off) => `<ul class="ticks ${off ? 'ticks-off' : ''}">${items.map(i => `<li>${icon(off ? 'x' : 'check', 14)}${i}</li>`).join('')}</ul>`;

export function overviewCardHTML({ compact = false } = {}) {
  const s = status();
  const head = {
    unconfigured: ['Gmail isn’t connected', 'Triageo is in manual mode. Gmail sign-in needs a one-time setup by the site owner.'],
    disconnected: ['Connect your Gmail', 'Import recent inbox threads with read-only access. Triageo can’t send, delete or change anything.'],
    expired: ['Reconnect to fetch new mail', `Signed in as ${esc(state.gmail.email)}. Google sessions last about an hour. ${lastSync()}.`],
    connected: ['Gmail connected', `${esc(state.gmail.email)} · read-only · ${lastSync()}.`],
  }[s];
  const gmailOk = s === 'connected' || s === 'expired';
  return `<section class="card conn-panel ${compact ? 'conn-panel-compact' : ''}">
    <div class="conn-panel-head"><span class="conn-badge conn-${COPY[s][2]}">${icon(gmailOk ? 'mail' : 'plug-zap', 16)}</span><div><h2>${head[0]}</h2><p>${head[1]}</p></div></div>
    ${compact ? '' : `<div class="conn-cols">
      <div><h3>Available now</h3>${ticks(s === 'unconfigured' ? AVAILABLE : ['Read-only Gmail import', ...AVAILABLE], false)}</div>
      <div><h3>Not available</h3>${ticks(s === 'unconfigured' ? ['Gmail sign-in and import', ...UNAVAILABLE] : UNAVAILABLE, true)}</div>
    </div>`}
    <div class="conn-actions">${primaryButton({ size: compact ? 'btn-sm' : '' })}<button type="button" class="link" data-action="open-connection">${s === 'unconfigured' ? 'What setup is needed' : 'Connection details'} ${icon('arrow-right', 14)}</button></div>
  </section>`;
}

export function dialogBodyHTML() {
  const s = status();
  const pill = `<span class="status-pill static">${pillHTML()}</span>`;
  const close = `<button type="button" class="icon-btn" data-close aria-label="Close">${icon('x', 18)}</button>`;
  let body;
  if (s === 'unconfigured') {
    body = `<p>Gmail sign-in isn’t set up on this site yet. The site owner needs to create a Google OAuth client ID (read-only Gmail access) and add it to <code>js/config.js</code>. Until then, import emails manually.</p>
      <div class="conn-cols"><div><h3>Available now</h3>${ticks(AVAILABLE)}</div><div><h3>Not available</h3>${ticks(['Gmail sign-in and import', ...UNAVAILABLE], true)}</div></div>`;
  } else {
    body = `${gmailOk(s) ? `<div class="setting-row"><div><strong>${esc(state.gmail.email)}</strong><small>${lastSync()}</small></div>${primaryButton({ size: 'btn-sm' })}</div>` : `<p>Sign in with Google to import your recent inbox threads. Google will show you exactly what Triageo can access.</p>`}
      <div class="conn-cols"><div><h3>What Triageo can do</h3>${ticks(['Read recent inbox threads', 'Copy them into this browser for review'])}</div><div><h3>What it can’t do</h3>${ticks(['Send, delete or label mail', 'Read mail while this tab is closed', 'Store your Google password or token'], true)}</div></div>
      <p class="muted small">Fetches up to 25 threads from the last 14 days, skipping Gmail’s Promotions, Social, Updates and Forums tabs. Newsletters and threads where you replied last are set aside. Copies are kept in this browser like manual imports; your access token is kept in memory only and ends when you close the tab. <span class="mono">${esc(QUERY)}</span></p>`;
  }
  return `<header class="dialog-head"><div><h2 id="connTitle">Gmail connection</h2><p>${pill}</p></div>${close}</header>
    ${body}
    <div class="callout">${icon('shield-check', 16)}<p><strong>Sending is disabled.</strong> Triageo has read-only access. Approved replies are exported as text for you to send yourself.</p></div>
    <footer class="dialog-foot">${gmailOk(s) ? button('Disconnect', { action: 'gmail-disconnect', variant: 'ghost', ic: 'log-out' }) : ''}<span class="spacer"></span>${s === 'disconnected' ? primaryButton() : ''}<button type="button" class="btn btn-secondary" data-close>Close</button></footer>`;
}
const gmailOk = s => s === 'connected' || s === 'expired';
