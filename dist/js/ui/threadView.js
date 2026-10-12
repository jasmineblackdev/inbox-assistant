import { icon } from '../icons.js';
import { esc, fmtDate, ago, until, firstName } from '../format.js';
import { state } from '../store.js';
import { canExport, draftState, reasonFor, isSetAside } from '../logic.js';
import { avatar, badge, button, emptyState } from './components.js';

export function renderNoSelection(el, hasItems) {
  el.innerHTML = `<div class="detail-empty">${hasItems
    ? emptyState({ title: 'Select a conversation', body: 'Choose a thread to read it, see why it was ranked, and prepare your reply.', art: true })
    : emptyState({ title: 'Make room for what matters', body: 'Import an email to see what the sender needs and prepare a reply you approve yourself.', actions: button('Import email', { action: 'open-import', variant: 'primary', ic: 'plus' }) })}</div>`;
}

export function insightsHTML(t, now = Date.now()) {
  const due = t.deadline ? `${esc(fmtDate(t.deadline))}<small class="${Date.parse(t.deadline) < now ? 'text-urgent' : ''}">${esc(until(t.deadline, now))}</small>` : '<span class="muted">None provided</span>';
  const ds = draftState(t);
  const status = { approved: ['ok', 'Approved · unsent', 'This exact wording is approved for export.'], draft: ['accent', 'Draft · not approved', 'Approve when the wording is final.'], empty: ['muted', 'No draft yet', 'Write a reply or insert the template.'] }[ds];
  return `<header class="insights-head"><h2>${icon('sparkles', 16)}Why this needs you</h2><span class="tag" title="These notes come from fixed rules and what you entered at import. No AI is involved.">Rule-based · not AI</span></header>
    <dl class="facts">
      <div><dt>Priority</dt><dd>${badge(t)}<span>${esc(reasonFor(t, now))}</span></dd></div>
      <div><dt>What they need</dt><dd>${t.request ? esc(t.request) : t.source === 'gmail' ? '<span class="muted">Not summarized — Triageo doesn’t use AI to read mail. Read the conversation, and add notes below.</span>' : '—'}</dd></div>
      <div><dt>Deadline</dt><dd class="stack">${due}</dd></div>
      <div><dt>Waiting</dt><dd>${esc(ago(t.received, now).replace(' ago', ''))} since received${t.important ? (t.source === 'gmail' ? ' · starred in Gmail' : ' · important contact') : ''}</dd></div>
      <div><dt>Reply status</dt><dd class="stack"><span class="chip chip-${status[0]}">${status[1]}</span><small>${status[2]}</small></dd></div>
    </dl>
    <p class="ai-note">${icon('info', 14)}<span>AI drafting isn’t connected, so there’s no regenerate or tone control yet. <button type="button" class="link" data-action="open-connection">Details</button></span></p>`;
}

function actionBarHTML(t) {
  if (isSetAside(t)) {
    return `<p class="action-hint">${icon('eye-off', 14)}This thread isn’t in your review queue.</p>
      ${t.skipped ? button('Restore to queue', { action: 'restore', variant: 'primary', ic: 'undo-2' }) : button('Add to review queue', { action: 'include', variant: 'primary', ic: 'mail-plus' })}`;
  }
  const ok = canExport(t);
  return `<p class="action-hint" id="actionHint">${icon('shield-check', 14)}<span>${ok ? 'Approved wording only. Exported as text — nothing is sent.' : 'Approval covers this exact wording. Any edit removes it.'}</span></p>
    <div class="action-buttons">
      ${button('Export', { action: 'export', ic: 'download', attrs: `id="exportBtn" ${ok ? '' : 'disabled'}` })}
      ${button(ok ? 'Approved' : 'Approve draft', { action: 'approve', variant: 'primary', ic: ok ? 'check-check' : 'check', attrs: `id="approveBtn" ${ok ? 'disabled' : ''}` })}
    </div>`;
}

export function renderThread(el, t, view, now = Date.now()) {
  const setAside = isSetAside(t, now);
  el.innerHTML = `<div class="detail-inner" data-id="${esc(t.id)}">
    <div class="detail-bar">
      <a class="btn btn-ghost btn-sm back-btn" href="#/${view}">${icon('chevron-left', 16)}<span>Back</span></a>
      <span class="detail-bar-spacer"></span>
      ${state.demo ? `<span class="chip">${icon('flask-conical', 12)}Demo example</span>` : ''}
      ${t.source === 'gmail' ? `<a class="btn btn-ghost btn-sm" href="https://mail.google.com/mail/?authuser=${encodeURIComponent(state.gmail.email || '')}#all/${encodeURIComponent(t.gmailThreadId)}" target="_blank" rel="noopener noreferrer">${icon('mail', 16)}<span>Open in Gmail</span></a>` : ''}
      ${setAside ? '' : button('Skip', { action: 'skip', variant: 'ghost', ic: 'eye-off', size: 'btn-sm', attrs: 'title="Remove from review queue (you can undo)"' })}
    </div>
    <div class="detail-scroll">
      <header class="thread-head">
        <h2>${esc(t.subject)}</h2>
        <div class="thread-from">${avatar(t.sender, 36)}<div><strong>${esc(t.sender)}</strong> <span class="muted">&lt;${esc(t.email)}&gt;</span><small>Received ${esc(fmtDate(t.received))} · ${esc(ago(t.received, now))}</small></div></div>
      </header>
      <div class="detail-grid">
        <div class="detail-primary">
          <section class="card message" aria-label="Conversation"><header class="card-head"><h3>${icon('mail', 16)}Conversation</h3></header><div class="message-body">${esc(t.body)}</div></section>
          ${setAside ? '' : `<section class="card editor" aria-label="Your reply">
            <header class="card-head"><h3>${icon('pen-line', 16)}Your reply</h3><span id="draftStatus"></span></header>
            <p class="editor-to">To ${esc(t.email)} · Re: ${esc(t.subject.replace(/^Re:\s*/i, ''))}</p>
            <textarea id="draft" class="input editor-text" rows="9" aria-label="Reply draft" placeholder="Hi ${esc(firstName(t.sender))},&#10;&#10;Write your reply here…">${esc(t.draft || '')}</textarea>
            <div class="editor-tools">
              ${button('Insert reply template', { action: 'insert-starter', variant: 'ghost', ic: 'file-text', size: 'btn-sm' })}
              <span class="save-state" id="saveState" aria-live="polite"></span>
            </div>
            <p class="editor-hint">The template is generic, not AI-written. Check facts, dates and commitments before approving.</p>
            <label class="field"><span>Missing information / notes</span><textarea id="notes" class="input" rows="2" placeholder="Facts you need to confirm before replying">${esc(t.notes || '')}</textarea></label>
          </section>`}
        </div>
        <aside class="card insights" id="insights" aria-label="Why this needs you">${insightsHTML(t, now)}</aside>
      </div>
    </div>
    <div class="action-bar" id="actionBar">${actionBarHTML(t)}</div>
  </div>`;
  updateDraftStatus(t);
}

/** Refresh only the bits that depend on draft/approval state, leaving the textarea alone. */
export function updateDraftStatus(t) {
  if (document.querySelector('.detail-inner')?.dataset.id !== t.id) return;
  const s = document.getElementById('draftStatus');
  if (s) {
    const ds = draftState(t);
    s.innerHTML = ds === 'approved' ? `<span class="chip chip-ok">${icon('shield-check', 12)}Approved · unsent</span>`
      : ds === 'draft' ? `<span class="chip chip-accent">${icon('pen-line', 12)}Not approved</span>` : '<span class="chip">Empty</span>';
  }
  const bar = document.getElementById('actionBar');
  if (bar) bar.innerHTML = actionBarHTML(t);
  const ins = document.getElementById('insights');
  if (ins) ins.innerHTML = insightsHTML(t);
}

