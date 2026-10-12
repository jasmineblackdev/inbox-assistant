// Triageo — wires state, routes and UI together. Nothing here sends email.
import { classify, editDraft, approve, canExport } from './logic.js';
import { state, load, persist, find, VIEWS, counts, listFor, reminders, demoItems, replyStarter } from './store.js';
import { current, go, href } from './router.js';
import { renderNav, renderSidebarFoot } from './ui/sidebar.js';
import { renderHeader, updateHeader } from './ui/header.js';
import { renderOverview } from './ui/overview.js';
import { listHeader, renderList } from './ui/threadList.js';
import { renderThread, renderNoSelection, insightsHTML, updateDraftStatus } from './ui/threadView.js';
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
  if (!await confirmDialog({ title: 'Clear this workspace?', text: 'This deletes every conversation, draft and note saved in this browser. It can’t be undone.', ok: 'Clear workspace', danger: true })) return;
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

function approveCurrent() {
  const t = currentThread(); if (!t) return;
  if (!approve(t)) { toast('Write a draft before approving.', { tone: 'error' }); $('#draft')?.focus(); return; }
  save();
  render(); updateDraftStatus(t);
  $('#exportBtn')?.focus();
  toast('Draft approved. It stays unsent until you export it.', { action: current().view === 'approved' ? null : { label: 'View approved', run: () => go('approved', t.id) } });
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
  if (include) { t.automated = false; t.needsReply = true; }
  save();
  go('queue', t.id);
  toast('Back in your review queue.');
}

const ACTIONS = {
  'open-import': () => { closeMenus(); setNav(false); openImport(); },
  'load-demo': loadDemo,
  'open-settings': () => { closeMenus(); setNav(false); openSettings(); },
  'open-connection': () => { closeMenus(); setNav(false); $('#connectionDialog').showModal(); },
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
  $('#settingsForm').addEventListener('submit', e => {
    e.preventDefault();
    const name = new FormData(e.target).get('name').trim().slice(0, 40);
    if (name) state.name = name;
    save();
    $('#settingsDialog').close();
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
if (!location.hash) history.replaceState(null, '', '#/overview');
render();
setInterval(() => { if (!document.querySelector('dialog[open]')) render(); }, 60000);
