// Triageo — wires state, routes and UI together. Nothing here sends email.
import { classify, editDraft, approve, canExport } from './logic.js';
import { state, load, persist, find, VIEWS, counts, listFor, reminders, demoItems, replyStarter, mergeGmail } from './store.js';
import { api, connectUrl } from './api.js';
import { sync, status, pillHTML, sidebarCardHTML, dialogBodyHTML } from './ui/connection.js';
import { current, go, href } from './router.js';
import { renderNav, renderSidebarFoot } from './ui/sidebar.js';
import { renderHeader, updateHeader } from './ui/header.js';
import { renderOverview } from './ui/overview.js';
import { listHeader, renderList } from './ui/threadList.js';
import { renderThread, renderNoSelection, insightsHTML, updateDraftStatus, placeholders } from './ui/threadView.js';
import { renderDialogs, openImport, openSettings, confirmDialog } from './ui/dialogs.js';
import { toast } from './ui/toast.js';

const $ = s => document.querySelector(s);
const mobile = matchMedia('(max-width: 767px)');
const REVIEW = `<div class="review" id="review">
  <section class="list-pane" aria-label="Conversations"><div id="listHead"></div><div id="threadList" class="list-scroll"></div></section>
  <section class="detail-pane" id="detail" aria-label="Selected conversation"></section></div>`;

let shown = { id: null, view: null };

function save() {
  if (!persist()) toast('Unable to save on this browser. Export drafts before leaving.', { tone: 'error' });
}

const currentThread = () => find($('.detail-inner')?.dataset.id);

function render({ force = false } = {}) {
  const now = Date.now(), r = current();
  renderNav($('#nav'), r.view, counts(now));
  updateHeader(reminders(now));
  $('#connPill').innerHTML = pillHTML();
  $('#connCard').innerHTML = sidebarCardHTML();
  document.title = `${VIEWS[r.view].label} · Triageo`;
  const main = $('#main');

  if (r.view === 'overview') {
    main.dataset.view = 'overview';
    shown = { id: null, view: null };
    renderOverview(main, now);
    return;
  }
  if (main.dataset.view !== 'review') { main.dataset.view = 'review'; main.innerHTML = REVIEW; shown = { id: null, view: null }; }

  const list = listFor(r.view, now);
  const routed = r.id ? find(r.id) : null;
  const sel = routed || (mobile.matches ? null : list[0] || null);
  // Pin an auto-selected thread in the URL so later actions can't silently switch it.
  if (sel && !routed) history.replaceState(null, '', href(r.view, sel.id));
  $('#listHead').innerHTML = listHeader(r.view, list.length);
  const focused = document.activeElement?.closest?.('.thread')?.dataset.thread;
  renderList($('#threadList'), r.view, list, sel?.id, now);
  if (focused) document.querySelector(`.thread[data-thread="${CSS.escape(focused)}"]`)?.focus();
  $('#review').classList.toggle('show-detail', !!routed);

  const detail = $('#detail');
  if (!sel) { renderNoSelection(detail, state.items.length > 0); shown = { id: null, view: r.view }; return; }
  if (force || shown.id !== sel.id || shown.view !== r.view) {
    renderThread(detail, sel, r.view, now);
    shown = { id: sel.id, view: r.view };
    detail.querySelector('.detail-scroll')?.scrollTo(0, 0);
  } else {
    // Same thread still open: refresh time-based facts only, never the editor.
    const ins = $('#insights'); if (ins) ins.innerHTML = insightsHTML(sel, now);
  }
}

/* ---------- navigation chrome ---------- */
function setNav(open) {
  document.body.classList.toggle('nav-open', open);
  $('.menu-btn')?.setAttribute('aria-expanded', String(open));
  if (open) $('#nav .nav-item')?.focus();
}
function closeMenus() {
  document.querySelectorAll('.menu').forEach(m => { m.hidden = true; });
  document.querySelectorAll('[data-menu]').forEach(b => b.setAttribute('aria-expanded', 'false'));
}
function toggleMenu(btn) {
  const menu = document.getElementById(btn.dataset.menu);
  const open = menu.hidden;
  closeMenus();
  if (open) { menu.hidden = false; btn.setAttribute('aria-expanded', 'true'); }
}

/* ---------- Gmail (via Triageo's server) ---------- */
function openConnection() {
  $('#connBody').innerHTML = dialogBodyHTML();
  if (!$('#connectionDialog').open) $('#connectionDialog').showModal();
}
const refreshConnection = () => { if ($('#connectionDialog').open) $('#connBody').innerHTML = dialogBodyHTML(); };

async function loadServer() {
  try {
    const me = await api.me();
    state.server = { loaded: true, configured: !!me.configured, user: me.user || null, schedule: me.schedule || '' };
  } catch {
    state.server = { loaded: true, configured: false, user: null, schedule: '' }; // static hosting / offline: manual mode
  }
  if (state.server.user) {
    try { mergeGmail((await api.inbox()).threads); save(); }
    catch (e) { if (e.status === 409) state.server.user.needsReconnect = true; }
  }
  render(); refreshConnection();
}

async function gmailConnect() {
  if (state.demo) {
    if (!await confirmDialog({ title: 'Leave the demo?', text: 'Connecting Gmail clears the fictional demo examples and starts your personal workspace.', ok: 'Clear demo and continue' })) return;
    state.items = []; state.demo = false; save();
  }
  location.href = connectUrl; // Google's consent screen, then back to Triageo
}

async function gmailSync() {
  if (sync.busy) return;
  if (status() !== 'connected') return gmailConnect();
  sync.busy = true; render(); refreshConnection();
  try {
    const r = await api.sync();
    const { added } = mergeGmail((await api.inbox()).threads);
    save();
    state.server = { ...state.server, ...(await api.me()), loaded: true };
    toast(`Checked Gmail: ${r.found} need${r.found === 1 ? 's' : ''} a reply, ${r.drafted} new draft${r.drafted === 1 ? '' : 's'}${r.failed ? `, ${r.failed} couldn’t be drafted` : ''}${r.pending ? `, ${r.pending} more next time` : ''}.`, { tone: r.failed ? 'info' : 'ok', ms: 6000 });
    if (added && current().view === 'overview') go('queue');
  } catch (e) {
    if (e.status === 409 && state.server.user) state.server.user.needsReconnect = true;
    toast(e.message, { tone: 'error', ms: 7000 });
  } finally {
    sync.busy = false; render({ force: true }); refreshConnection();
  }
}

async function gmailDisconnect() {
  if (!await confirmDialog({ title: 'Disconnect Gmail?', text: 'Triageo will revoke its Google access, stop scheduled checks, and delete the thread copies and drafts stored on its server. Threads already in this browser stay until you clear the workspace.', ok: 'Disconnect and delete', danger: true })) return;
  try {
    await api.disconnect();
    state.server.user = null;
    render({ force: true }); refreshConnection();
    toast('Gmail disconnected and server data deleted.');
  } catch (e) { toast(e.message, { tone: 'error' }); }
}

/** Ends this browser's session and removes Gmail copies from this browser. Scheduled checks keep running. */
async function signOut() {
  closeMenus();
  if (!await confirmDialog({ title: 'Sign out of Triageo?', text: 'This removes your Gmail threads and drafts from this browser. Gmail stays connected, so weekday checks keep preparing drafts for next time. To stop them and delete server data, use Disconnect in Gmail connection instead.', ok: 'Sign out' })) return;
  try {
    await api.signOut();
    state.items = state.items.filter(t => t.source !== 'gmail');
    state.server.user = null;
    save(); go('overview'); render({ force: true }); refreshConnection();
    toast('Signed out.');
  } catch (e) { toast(e.message, { tone: 'error' }); }
}

async function regenerate() {
  const t = currentThread(); if (!t || t.source !== 'gmail') return;
  if (t.draft?.trim() && t.draft !== t.aiDraft && !await confirmDialog({ title: 'Replace your edits?', text: 'A new AI draft will replace the reply you’ve written or edited.', ok: 'Replace with new draft' })) return;
  const btn = $('#regenBtn'), editor = $('.editor');
  btn.disabled = true; btn.setAttribute('aria-busy', 'true'); btn.querySelector('span').textContent = 'Drafting…'; editor?.classList.add('is-busy');
  try {
    const { ai } = await api.regenerate({ threadId: t.gmailThreadId, tone: $('#aiTone')?.value, instructions: $('#aiInstructions')?.value || '' });
    mergeGmail([{ ...t, needsReply: t.ruleNeedsReply ?? true, ai, aiCurrent: true }]);
    if (ai.draft) { editDraft(t, ai.draft); t.aiDraft = ai.draft; }
    save(); render({ force: true });
    toast(ai.needsReply ? 'New AI draft ready. Review it before approving.' : `The AI thinks no reply is needed: ${ai.why}`, { tone: ai.needsReply ? 'ok' : 'info', ms: 6000 });
  } catch (e) {
    if (e.status === 409 && state.server.user) { state.server.user.needsReconnect = true; render({ force: true }); }
    toast(e.message, { tone: 'error', ms: 7000 });
  } finally { const b = $('#regenBtn'); if (b?.disabled) { b.disabled = false; b.removeAttribute('aria-busy'); } $('.editor')?.classList.remove('is-busy'); }
}

/** Save the approved wording to Gmail Drafts. Called right after approval, or as a retry. */
async function saveToGmail(t) {
  if (!canExport(t) || status() !== 'connected') return false;
  try {
    const { draftId } = await api.saveGmailDraft({ threadId: t.gmailThreadId, text: t.draft, draftId: t.gmailDraftId || null });
    t.gmailDraftId = draftId; t.savedText = t.draft;
    save();
    return true;
  } catch (e) {
    if (e.status === 409 && state.server.user) state.server.user.needsReconnect = true;
    toast(`Approved, but not saved to Gmail: ${e.message}`, { tone: 'error', ms: 8000 });
    return false;
  } finally { render(); updateDraftStatus(t); }
}

/* ---------- workflows ---------- */
async function loadDemo() {
  if (state.items.length && !state.demo) { toast('Clear your workspace in Settings before loading demo examples.', { tone: 'info' }); return; }
  state.demo = true;
  state.items = demoItems();
  save();
  go('queue');
  toast('Demo loaded with fictional examples.', { tone: 'info' });
}

async function clearWorkspace() {
  closeMenus();
  const linked = !!state.server.user;
  if (!await confirmDialog({ title: 'Clear this workspace?', text: `This deletes every conversation, draft and note saved in this browser. It can’t be undone.${linked ? ' Gmail stays connected, so recent threads will download again; disconnect Gmail to delete server copies too.' : ''}`, ok: 'Clear workspace', danger: true })) return;
  state.items = []; state.demo = false;
  save();
  $('#settingsDialog').close();
  go('overview');
  toast('Workspace cleared.');
}

async function insertStarter() {
  const t = currentThread(); if (!t) return;
  if (t.draft?.trim() && !await confirmDialog({ title: 'Replace your draft?', text: 'Your current draft will be replaced with the generic reply template.', ok: 'Replace draft' })) return;
  editDraft(t, replyStarter(t));
  save();
  $('#draft').value = t.draft;
  render(); updateDraftStatus(t);
  $('#draft').focus();
}

async function approveCurrent() {
  const t = currentThread(); if (!t) return;
  if (!t.draft?.trim()) { toast('Write a draft before approving.', { tone: 'error' }); $('#draft')?.focus(); return; }
  const p = placeholders(t.draft);
  if (p.length && !await confirmDialog({ title: 'Approve with placeholders?', text: `Your draft still contains ${p.join(', ')}. Recipients would see these exactly as written.`, ok: 'Approve anyway' })) { $('#draft')?.focus(); return; }
  approve(t);
  save();
  render(); updateDraftStatus(t);
  if (t.source === 'gmail' && status() === 'connected') {
    if (await saveToGmail(t)) toast('Approved and saved to Gmail Drafts. It won’t be sent until you send it from Gmail.', { ms: 6000 });
    return;
  }
  $('#exportBtn')?.focus();
  toast(t.source === 'gmail' ? 'Approved. Reconnect Gmail to save it to Drafts, or export it.' : 'Draft approved. It stays unsent until you export it.', { tone: t.source === 'gmail' ? 'info' : 'ok', action: current().view === 'approved' ? null : { label: 'View approved', run: () => go('approved', t.id) } });
}

function exportCurrent() {
  const t = currentThread(); if (!t || !canExport(t)) return;
  const blob = new Blob([`To: ${t.email}\nSubject: Re: ${t.subject.replace(/^Re:\s*/i, '')}\n\n${t.draft}`], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (state.demo ? 'demo-' : '') + 'approved-reply.txt';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 500);
  toast('Draft exported. No email was sent.');
}

function skipCurrent() {
  const t = currentThread(); if (!t) return;
  const { view } = current();
  const before = { approved: t.approved, approvedText: t.approvedText };
  t.skipped = true; t.approved = false; t.approvedText = null;
  save();
  const next = listFor(view)[0];
  go(view, mobile.matches ? null : next?.id, { replace: true });
  toast('Thread skipped.', { tone: 'info', action: { label: 'Undo', run: () => { t.skipped = false; Object.assign(t, before); save(); go(view, t.id); } } });
}

function restoreCurrent(include) {
  const t = currentThread(); if (!t) return;
  t.skipped = false;
  if (include) { t.automated = false; t.needsReply = true; t.userIncluded = true; }
  save();
  go('queue', t.id);
  toast('Back in your review queue.');
}

const ACTIONS = {
  'open-import': () => { closeMenus(); setNav(false); openImport(); },
  'load-demo': loadDemo,
  'open-settings': () => { closeMenus(); setNav(false); openSettings(); },
  'open-connection': () => { closeMenus(); setNav(false); openConnection(); },
  'gmail-connect': gmailConnect,
  'gmail-sync': gmailSync,
  'gmail-disconnect': gmailDisconnect,
  'regenerate': regenerate,
  'sign-out': signOut,
  'save-gmail': async () => { const t = currentThread(); if (t && await saveToGmail(t)) toast('Saved to Gmail Drafts. Nothing was sent.'); },
  'open-nav': () => setNav(true),
  'close-nav': () => setNav(false),
  'toggle-menu': toggleMenu,
  'clear-workspace': clearWorkspace,
  'clear-search': () => { state.query = ''; $('#search').value = ''; render(); },
  'insert-starter': insertStarter,
  'approve': approveCurrent,
  'export': exportCurrent,
  'skip': skipCurrent,
  'restore': () => restoreCurrent(false),
  'include': () => restoreCurrent(true),
};

/* ---------- events ---------- */
document.addEventListener('click', e => {
  const closer = e.target.closest('[data-close]');
  if (closer) { closer.closest('dialog').close(); return; }
  if (e.target instanceof HTMLDialogElement) { e.target.close(); return; } // backdrop click
  if (!e.target.closest('.menu-wrap')) closeMenus();
  const el = e.target.closest('[data-action]');
  if (el && !el.disabled && ACTIONS[el.dataset.action]) ACTIONS[el.dataset.action](el);
});

document.addEventListener('input', e => {
  const t = currentThread();
  if (e.target.id === 'draft' && t) {
    editDraft(t, e.target.value);
    save(); render(); updateDraftStatus(t);
    $('#saveState').textContent = 'Saved in this browser';
  } else if (e.target.id === 'notes' && t) {
    t.notes = e.target.value; save();
  } else if (e.target.id === 'search') {
    state.query = e.target.value;
    if (current().view === 'overview' && state.query.trim()) go('queue'); else render();
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeMenus(); setNav(false); }
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName);
  if (e.key === '/' && !typing && !document.querySelector('dialog[open]')) { e.preventDefault(); $('#search').focus(); }
});

window.addEventListener('hashchange', () => { setNav(false); closeMenus(); render(); });
window.addEventListener('pageshow', e => { if (e.persisted) loadServer(); });
mobile.addEventListener('change', () => render());

/* ---------- forms ---------- */
function bindForms() {
  $('#importForm').addEventListener('submit', async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    if (state.demo) {
      if (!await confirmDialog({ title: 'Leave the demo?', text: 'Adding your own email clears the fictional demo examples and starts your personal workspace.', ok: 'Clear demo and add' })) return;
      state.items = []; state.demo = false;
    }
    const t = { id: crypto.randomUUID(), sender: f.get('sender').trim(), email: f.get('email').trim(), subject: f.get('subject').trim(), body: f.get('body').trim(), received: new Date(f.get('received')).toISOString(), deadline: f.get('deadline') ? new Date(f.get('deadline')).toISOString() : null, request: f.get('request').trim(), important: f.has('important'), needsReply: f.has('needsReply'), automated: f.has('automated'), draft: '', notes: '', approved: false };
    state.items.push(t);
    save();
    $('#importDialog').close();
    const queued = !!classify(t);
    go(queued ? 'queue' : 'skipped', t.id);
    toast(queued ? 'Conversation added for review.' : 'Added and set aside — it doesn’t need a reply.', { tone: queued ? 'ok' : 'info' });
  });
  $('#settingsForm').addEventListener('submit', async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const name = f.get('name').trim().slice(0, 40);
    if (name) state.name = name;
    save();
    $('#settingsDialog').close();
    if (state.server.user) {
      try {
        const me = await api.saveMe({ name: state.name, scheduleEnabled: e.target.elements.scheduleEnabled ? f.has('scheduleEnabled') : undefined });
        state.server.user = me.user;
      } catch (err) { toast(`Saved here, but not on the server: ${err.message}`, { tone: 'error' }); }
    }
    render({ force: true });
    toast('Settings saved.');
  });
}

/* ---------- boot ---------- */
load();
renderHeader($('#topbar'));
renderSidebarFoot($('#sidebarFoot'));
renderDialogs($('#dialogs'));
bindForms();
const RETURN = {
  connected: ['Gmail connected. Checking your inbox…', 'ok'], cancelled: ['Gmail connection cancelled.', 'info'],
  not_allowed: ['That Google account isn’t on this Triageo’s allowed list.', 'error'], scopes: ['Triageo needs both “read” and “manage drafts” access. Nothing was connected.', 'error'],
  state: ['The sign-in link expired. Try connecting again.', 'error'], no_refresh: ['Google didn’t grant offline access. Remove Triageo at myaccount.google.com/permissions, then connect again.', 'error'],
  unconfigured: ['The Triageo server isn’t set up yet.', 'error'], error: ['Couldn’t finish connecting Gmail. Try again.', 'error'],
};
const returned = new URLSearchParams(location.search).get('gmail');
if (returned) history.replaceState(null, '', location.pathname + (location.hash || '#/overview'));
if (!location.hash) history.replaceState(null, '', '#/overview');
render();
loadServer().then(() => {
  if (!returned) return;
  const [msg, tone] = RETURN[returned] || RETURN.error;
  toast(msg, { tone, ms: 7000 });
  if (returned === 'connected' && status() === 'connected') gmailSync();
});
setInterval(() => { if (!document.querySelector('dialog[open]')) render(); }, 60000);
