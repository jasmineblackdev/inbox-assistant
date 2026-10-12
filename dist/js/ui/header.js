import { icon } from '../icons.js';
import { esc, greeting, until, ago, initials } from '../format.js';
import { href } from '../router.js';
import { state } from '../store.js';

export function renderHeader(el) {
  el.innerHTML = `
    <button type="button" class="icon-btn menu-btn" data-action="open-nav" aria-label="Open navigation" aria-controls="sidebar" aria-expanded="false">${icon('menu', 20)}</button>
    <a class="topbar-mark" href="${href('overview')}" aria-label="Triageo overview"><img src="brand/triageo-mark.svg" alt="" width="28" height="28"></a>
    <div class="greeting"><p class="greeting-title" id="greeting"></p><p class="greeting-sub" id="today"></p></div>
    <label class="search">${icon('search', 16)}<input id="search" type="search" placeholder="Search conversations" aria-label="Search conversations" autocomplete="off"><kbd aria-hidden="true">/</kbd></label>
    <button type="button" class="status-pill" id="connPill" data-action="open-connection"></button>
    <div class="menu-wrap bell-wrap">
      <button type="button" class="icon-btn" id="bellBtn" data-action="toggle-menu" data-menu="bellMenu" aria-haspopup="true" aria-expanded="false" aria-label="Reminders">${icon('bell', 18)}<span class="bell-dot" hidden></span></button>
      <div class="menu menu-wide" id="bellMenu" hidden></div>
    </div>
    <div class="menu-wrap account-wrap">
      <button type="button" class="account-btn" data-action="toggle-menu" data-menu="accountMenu" aria-haspopup="true" aria-expanded="false" aria-label="Account menu"><span class="account-avatar" id="accountInitials"></span>${icon('chevron-right', 14, 'rot90')}</button>
      <div class="menu" id="accountMenu" hidden></div>
    </div>`;
}

export function updateHeader(reminders) {
  const now = new Date();
  document.getElementById('greeting').textContent = `${greeting(now)}, ${state.name}`;
  document.getElementById('today').textContent = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  document.getElementById('accountInitials').textContent = initials(state.name);
  const n = reminders.length;
  const bell = document.getElementById('bellBtn');
  bell.querySelector('.bell-dot').hidden = !n;
  bell.setAttribute('aria-label', n ? `Reminders, ${n}` : 'Reminders');

  const LABEL = { overdue: ['urgent', 'Deadline passed', t => until(t.deadline)], due: ['warn', 'Due soon', t => `Due ${until(t.deadline)}`], waiting: ['warn', 'Waiting on you', t => `Received ${ago(t.received)}`] };
  document.getElementById('bellMenu').innerHTML = `
    <div class="menu-head"><strong>Reminders</strong><span>${n || 'None'}</span></div>
    ${n ? reminders.slice(0, 6).map(({ t, kind }) => {
      const [tone, title, sub] = LABEL[kind];
      return `<a class="menu-item reminder" role="menuitem" href="${href('queue', t.id)}"><span class="rem-dot rem-${tone}"></span><span><strong>${title}</strong><span class="rem-subject">${esc(t.subject)}</span><small>${esc(sub(t))}</small></span></a>`;
    }).join('') : `<p class="menu-empty">${icon('circle-check', 16)} Nothing time-sensitive right now.</p>`}
    <p class="menu-foot">Calculated from conversations saved in this browser. No email is checked in the background.</p>`;

  document.getElementById('accountMenu').innerHTML = `
    <div class="menu-head menu-account">${'<span class="account-avatar">' + esc(initials(state.name)) + '</span>'}<span><strong>${esc(state.name)}</strong><small>Local workspace · this browser only</small></span></div>
    <button type="button" class="menu-item" role="menuitem" data-action="open-settings">${icon('settings', 16)}Settings</button>
    <a class="menu-item" role="menuitem" href="${href('approved')}">${icon('check-check', 16)}Approved drafts</a>
    <button type="button" class="menu-item" role="menuitem" data-action="open-connection">${icon('plug-zap', 16)}Gmail connection details</button>
    <div class="menu-sep"></div>
    <button type="button" class="menu-item menu-danger" role="menuitem" data-action="clear-workspace">${icon('trash-2', 16)}Clear this browser’s workspace</button>`;
}
