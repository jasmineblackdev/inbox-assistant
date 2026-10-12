import { icon } from '../icons.js';
import { esc, fmtShort, preview } from '../format.js';
import { href } from '../router.js';
import { state, VIEWS } from '../store.js';
import { avatar, badge, draftChip, dueChip, button, emptyState } from './components.js';

const EMPTY = {
  queue: ['Your review queue is clear', 'Import an email you need to answer and Triageo will rank it for you.'],
  urgent: ['Nothing urgent', 'No deadlines in the next 48 hours, and no requests marked urgent.'],
  reply: ['No replies waiting', 'Conversations that need a response from you will appear here.'],
  follow: ['No follow-ups', 'Requests that have waited more than 48 hours will appear here.'],
  approved: ['No approved drafts yet', 'Approve a draft in the review queue and it will be ready to export here. Approved drafts are never sent.'],
  skipped: ['Nothing set aside', 'Skipped threads, and imports marked promotional or not needing a reply, appear here so you can restore them.'],
};

export function listHeader(view, n) {
  const sub = view === 'approved' ? 'Approved for export · never sent' : view === 'skipped' ? 'Not in your review queue' : 'Sorted by priority, then oldest first';
  return `<div class="list-head"><div><h1>${VIEWS[view].label} <span class="list-count">${n}</span></h1><p>${sub}</p></div>
    ${button('Import', { action: 'open-import', variant: 'secondary', ic: 'plus', size: 'btn-sm' })}</div>
    ${state.demo ? `<p class="mode-note">${icon('flask-conical', 14)}Demo workspace · fictional examples only</p>` : ''}`;
}

export function renderList(el, view, list, selectedId, now = Date.now()) {
  if (!list.length) {
    const q = state.query.trim();
    el.innerHTML = q
      ? emptyState({ title: `No matches for “${esc(q)}”`, body: 'Search looks at sender, subject, request and message text.', actions: button('Clear search', { action: 'clear-search', ic: 'x' }), art: false, compact: true })
      : emptyState({ title: EMPTY[view][0], body: EMPTY[view][1], compact: true,
          actions: ['queue', 'reply', 'urgent'].includes(view) || !state.items.length
            ? button('Import email', { action: 'open-import', variant: 'primary', ic: 'plus' }) + (state.items.length && !state.demo ? '' : button('Try the demo', { action: 'load-demo', ic: 'flask-conical' }))
            : '' });
    return;
  }
  el.innerHTML = `<ul class="threads" role="list">${list.map(t => `
    <li><a class="thread ${t.id === selectedId ? 'selected' : ''}" href="${href(view, t.id)}" data-thread="${esc(t.id)}" ${t.id === selectedId ? 'aria-current="true"' : ''}>
      ${avatar(t.sender, 36)}
      <span class="thread-main">
        <span class="thread-top"><strong class="thread-sender">${esc(t.sender)}</strong><time datetime="${esc(t.received)}">${esc(fmtShort(t.received, now))}</time></span>
        <span class="thread-subject">${esc(t.subject)}</span>
        <span class="thread-preview">${esc(preview(t.request || t.body))}</span>
        <span class="thread-meta">${badge(t)}${view === 'skipped' ? '' : draftChip(t)}${dueChip(t, now)}${t.important ? `<span class="chip" title="Important contact">${icon('user', 12)}Important</span>` : ''}</span>
      </span>
    </a></li>`).join('')}</ul>`;
}
