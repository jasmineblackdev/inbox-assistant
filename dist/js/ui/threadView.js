import { icon } from '../icons.js';
import { esc, fmtDate, ago, until, firstName } from '../format.js';
import { state } from '../store.js';
import { canExport, draftState, reasonFor, isSetAside } from '../logic.js';
import { avatar, badge, button, emptyState } from './components.js';
import { status } from './connection.js';

const PLACEHOLDER = /\[[^\]\n]{1,80}\]/g;
export const placeholders = text => [...new Set(String(text || '').match(PLACEHOLDER) || [])];

/** Gmail threads with a live connection can use AI drafting and Gmail Drafts. */
const gmailLive = t => t.source === 'gmail' && status() === 'connected';
const savedToGmail = t => canExport(t) && t.gmailDraftId && t.savedText === t.draft;
const isAiDraft = t => !!t.aiDraft && t.draft === t.aiDraft;

export function renderNoSelection(el, hasItems) {
  el.innerHTML = `<div class="detail-empty">${hasItems
    ? emptyState({ title: 'Select a conversation', body: 'Choose a thread to read it, see why it was ranked, and prepare your reply.', art: true })
    : emptyState({ title: 'Make room for what matters', body: 'Connect Gmail or import an email to see what the sender needs and prepare a reply you approve yourself.', actions: button('Import email', { action: 'open-import', variant: 'primary', ic: 'plus' }) })}</div>`;
}

const aiMark = '<span class="ai-mark" title="Suggested by AI — check it">AI</span>';

export function insightsHTML(t, now = Date.now()) {
  const fromAi = t.source === 'gmail' && !!t.ai;
  const due = t.deadline ? `<span>${esc(fmtDate(t.deadline))}${fromAi ? ` ${aiMark}` : ''}</span><small class="${Date.parse(t.deadline) < now ? 'text-urgent' : ''}">${esc(until(t.deadline, now))}</small>` : '<span class="muted">None found</span>';
  const ds = draftState(t);
  const st = savedToGmail(t) ? ['ok', 'Saved to Gmail Drafts', 'Unsent. Review and send it from Gmail.']
    : { approved: ['ok', 'Approved · unsent', t.source === 'gmail' ? 'Not saved to Gmail yet.' : 'This exact wording is approved for export.'], draft: ['accent', isAiDraft(t) ? 'AI draft · not approved' : 'Draft · not approved', 'Approve when the wording is final.'], empty: ['muted', 'No draft yet', 'Write a reply or insert the template.'] }[ds];
  const need = t.request ? `${esc(t.request)}${fromAi ? ` ${aiMark}` : ''}` : t.source === 'gmail' ? '<span class="muted">Not summarized yet. Read the conversation.</span>' : '—';
  const missing = fromAi && t.ai.missing?.length ? `<div><dt>You need to fill in ${aiMark}</dt><dd><ul class="missing">${t.ai.missing.map(m => `<li>${esc(m)}</li>`).join('')}</ul></dd></div>` : '';
  const note = fromAi
    ? `${icon('sparkles', 14)}<span>Items marked AI were suggested by ${esc(t.ai.model || 'OpenAI')}${t.ai.current ? '' : ' before the latest message arrived'}. Check facts, dates and tone before approving.</span>`
    : t.source === 'gmail'
      ? `${icon('info', 14)}<span>${status() === 'connected' ? 'No AI draft yet. Use “Draft with AI” to write one.' : 'Reconnect Gmail to draft with AI.'}</span>`
      : `${icon('info', 14)}<span>Manually imported threads use rules only. Connect Gmail for AI drafts. <button type="button" class="link" data-action="open-connection">Details</button></span>`;
  return `<header class="insights-head"><h2>${icon('sparkles', 16)}Why this needs you</h2><span class="tag" title="${fromAi ? 'Priority comes from fixed rules; items marked AI were suggested by the model.' : 'These notes come from fixed rules and what you entered at import.'}">${fromAi ? 'Rules + AI · check it' : 'Rule-based · not AI'}</span></header>
    <dl class="facts">
      <div><dt>Priority</dt><dd>${badge(t)}<span>${esc(reasonFor(t, now))}</span></dd></div>
      <div><dt>What they need</dt><dd>${need}</dd></div>
      <div><dt>Deadline</dt><dd class="stack">${due}</dd></div>
      ${missing}
      <div><dt>Waiting</dt><dd>${esc(ago(t.received, now).replace(' ago', ''))} since received${t.important ? (t.source === 'gmail' ? ' · starred in Gmail' : ' · important contact') : ''}</dd></div>
      <div><dt>Reply status</dt><dd class="stack"><span class="chip chip-${st[0]}">${st[1]}</span><small>${st[2]}</small></dd></div>
    </dl>
    <p class="ai-note">${note}</p>`;
}

function actionBarHTML(t) {
  if (isSetAside(t)) {
    return `<p class="action-hint">${icon('eye-off', 14)}This thread isn’t in your review queue.</p>
      ${t.skipped ? button('Restore to queue', { action: 'restore', variant: 'primary', ic: 'undo-2' }) : button('Add to review queue', { action: 'include', variant: 'primary', ic: 'mail-plus' })}`;
  }
  const ok = canExport(t), gmail = t.source === 'gmail';
  const exportBtn = button('Export', { action: 'export', ic: 'download', attrs: `id="exportBtn" ${ok ? '' : 'disabled'}` });
  if (gmail && savedToGmail(t)) {
    return `<p class="action-hint">${icon('shield-check', 14)}<span>Saved to Gmail Drafts, unsent. Send it from Gmail when you’re ready.</span></p>
      <div class="action-buttons">${exportBtn}<a class="btn btn-primary" href="https://mail.google.com/mail/?authuser=${encodeURIComponent(state.server.user?.email || '')}#drafts" target="_blank" rel="noopener noreferrer">${icon('mail', 16)}<span>Open Gmail Drafts</span></a></div>`;
  }
  if (gmail && ok) {
    return `<p class="action-hint">${icon('triangle-alert', 14)}<span>Approved but not saved to Gmail yet.</span></p>
      <div class="action-buttons">${exportBtn}${button('Save to Gmail Drafts', { action: 'save-gmail', variant: 'primary', ic: 'mail', attrs: `id="approveBtn" ${gmailLive(t) ? '' : 'disabled title="Reconnect Gmail first"'}` })}</div>`;
  }
  const label = ok ? 'Approved' : gmailLive(t) ? 'Approve & save to Gmail' : 'Approve draft';
  const hint = gmail && t.gmailDraftId && !ok ? 'Gmail Drafts still has your earlier approved version. Approve again to update it.'
    : gmail ? 'Approval saves this exact wording to Gmail Drafts. Nothing is sent.'
      : ok ? 'Approved wording only. Exported as text — nothing is sent.' : 'Approval covers this exact wording. Any edit removes it.';
  return `<p class="action-hint" id="actionHint">${icon('shield-check', 14)}<span>${hint}</span></p>
    <div class="action-buttons">${exportBtn}${button(label, { action: 'approve', variant: 'primary', ic: ok ? 'check-check' : 'check', attrs: `id="approveBtn" ${ok ? 'disabled' : ''}` })}</div>`;
}

function aiTools(t) {
  if (!gmailLive(t)) return '';
  const tone = t.ai?.tone || 'friendly';
  return `<div class="ai-tools" role="group" aria-label="AI draft">
    <select id="aiTone" class="input input-sm" aria-label="Tone">${[['friendly', 'Friendly'], ['concise', 'Concise'], ['formal', 'Formal']].map(([v, l]) => `<option value="${v}" ${v === tone ? 'selected' : ''}>${l}</option>`).join('')}</select>
    <input id="aiInstructions" class="input input-sm" maxlength="500" placeholder="Tell the AI what to say, e.g. “yes, Tuesday works”" aria-label="Instructions for the AI draft">
    ${button(t.aiDraft ? 'Regenerate' : 'Draft with AI', { action: 'regenerate', variant: 'secondary', ic: 'sparkles', size: 'btn-sm', attrs: 'id="regenBtn"' })}
  </div>`;
}

export function renderThread(el, t, view, now = Date.now()) {
  const setAside = isSetAside(t, now);
  el.innerHTML = `<div class="detail-inner" data-id="${esc(t.id)}">
    <div class="detail-bar">
      <a class="btn btn-ghost btn-sm back-btn" href="#/${view}">${icon('chevron-left', 16)}<span>Back</span></a>
      <span class="detail-bar-spacer"></span>
      ${state.demo ? `<span class="chip">${icon('flask-conical', 12)}Demo example</span>` : ''}
      ${t.source === 'gmail' ? `<a class="btn btn-ghost btn-sm" href="https://mail.google.com/mail/?authuser=${encodeURIComponent(state.server.user?.email || '')}#all/${encodeURIComponent(t.gmailThreadId)}" target="_blank" rel="noopener noreferrer">${icon('mail', 16)}<span>Open in Gmail</span></a>` : ''}
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
            <p class="editor-to">To ${esc(t.replyTo || t.email)} · Re: ${esc(t.subject.replace(/^Re:\s*/i, ''))}</p>
            ${aiTools(t)}
            <textarea id="draft" class="input editor-text" rows="10" aria-label="Reply draft" placeholder="Hi ${esc(firstName(t.sender))},&#10;&#10;Write your reply here…">${esc(t.draft || '')}</textarea>
            <p class="placeholder-warn" id="placeholderWarn" hidden></p>
            <div class="editor-tools">
              ${button('Insert reply template', { action: 'insert-starter', variant: 'ghost', ic: 'file-text', size: 'btn-sm' })}
              <span class="save-state" id="saveState" aria-live="polite"></span>
            </div>
            <p class="editor-hint">${t.source === 'gmail' ? 'AI drafts are suggestions. Replace every [bracketed placeholder], and check facts, dates and commitments before approving.' : 'The template is generic, not AI-written. Check facts, dates and commitments before approving.'}</p>
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
    s.innerHTML = savedToGmail(t) ? `<span class="chip chip-ok">${icon('mail', 12)}In Gmail Drafts</span>`
      : ds === 'approved' ? `<span class="chip chip-ok">${icon('shield-check', 12)}Approved · unsent</span>`
        : ds === 'draft' ? `<span class="chip chip-accent">${icon(isAiDraft(t) ? 'sparkles' : 'pen-line', 12)}${isAiDraft(t) ? 'AI draft · not approved' : 'Not approved'}</span>` : '<span class="chip">Empty</span>';
  }
  const warn = document.getElementById('placeholderWarn');
  if (warn) {
    const p = placeholders(t.draft);
    warn.hidden = !p.length;
    warn.innerHTML = p.length ? `${icon('triangle-alert', 14)}<span>Fill in ${p.length === 1 ? 'this placeholder' : `these ${p.length} placeholders`} before approving: ${p.map(x => `<code>${esc(x)}</code>`).join(' ')}</span>` : '';
  }
  const bar = document.getElementById('actionBar');
  if (bar) bar.innerHTML = actionBarHTML(t);
  const ins = document.getElementById('insights');
  if (ins) ins.innerHTML = insightsHTML(t);
}
