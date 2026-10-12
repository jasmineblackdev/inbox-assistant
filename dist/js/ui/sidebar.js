import { icon } from '../icons.js';
import { VIEWS } from '../store.js';
import { href } from '../router.js';

const GROUPS = [
  [null, ['overview', 'queue']],
  ['Filters', ['urgent', 'reply', 'follow']],
  ['Drafts', ['approved', 'skipped']],
];

export function renderNav(el, active, counts) {
  el.innerHTML = GROUPS.map(([label, views]) => `
    <div class="nav-group">${label ? `<p class="nav-label">${label}</p>` : ''}
      ${views.map(v => {
        const n = counts[v];
        const tone = v === 'urgent' && n ? 'nav-count-urgent' : '';
        return `<a class="nav-item ${active === v ? 'active' : ''}" href="${href(v)}" data-tip="${VIEWS[v].label}" ${active === v ? 'aria-current="page"' : ''}>
          ${icon(VIEWS[v].icon, 18)}<span class="nav-text">${VIEWS[v].label}</span>
          ${n ? `<span class="nav-count ${tone}" aria-label="${n} conversations">${n}</span>` : ''}
        </a>`;
      }).join('')}
    </div>`).join('');
}

export function renderSidebarFoot(el) {
  el.innerHTML = `
    <button type="button" class="nav-item" data-action="open-settings" data-tip="Settings">${icon('settings', 18)}<span class="nav-text">Settings</span></button>
    <button type="button" class="conn-card" data-action="open-connection" data-tip="Gmail not connected">
      <span class="conn-icon">${icon('plug-zap', 16)}</span>
      <span class="conn-text"><strong>Gmail not connected</strong><small>Manual import mode</small></span>
      <span class="conn-chevron">${icon('chevron-right', 16)}</span>
    </button>`;
}
