import { icon } from '../icons.js';
import { esc } from '../format.js';
import { state } from '../store.js';
import { status, lastCheck } from './connection.js';

const close = `<button type="button" class="icon-btn" data-close aria-label="Close">${icon('x', 18)}</button>`;

export function renderDialogs(el) {
  el.innerHTML = `
  <dialog id="importDialog" class="dialog" aria-labelledby="importTitle">
    <form id="importForm" class="dialog-body">
      <header class="dialog-head"><div><h2 id="importTitle">Import a conversation</h2><p>Paste an email you want to review. It’s saved only in this browser.</p></div>${close}</header>
      <div class="form-grid">
        <label class="field"><span>Sender name</span><input class="input" name="sender" required placeholder="Alex Morgan" autocomplete="off"></label>
        <label class="field"><span>Sender email</span><input class="input" name="email" type="email" required placeholder="alex@example.com" autocomplete="off"></label>
        <label class="field span-2"><span>Subject</span><input class="input" name="subject" required placeholder="Project feedback"></label>
        <label class="field"><span>Received</span><input class="input" name="received" type="datetime-local" required></label>
        <label class="field"><span>Deadline <em>optional</em></span><input class="input" name="deadline" type="datetime-local"></label>
        <label class="field span-2"><span>Conversation</span><textarea class="input" name="body" rows="6" required placeholder="Paste the message and relevant thread context…"></textarea></label>
        <label class="field span-2"><span>What response is needed?</span><input class="input" name="request" required placeholder="Confirm availability for a call"></label>
      </div>
      <fieldset class="checks"><legend class="sr-only">Options</legend>
        <label class="check"><input name="important" type="checkbox"><span><strong>Important contact or work request</strong><small>Keeps it in Needs reply instead of Follow-ups.</small></span></label>
        <label class="check"><input name="needsReply" type="checkbox" checked><span><strong>This conversation needs my reply</strong><small>Unchecked imports are set aside.</small></span></label>
        <label class="check"><input name="automated" type="checkbox"><span><strong>Promotional or automated message</strong><small>Excluded from review.</small></span></label>
      </fieldset>
      <footer class="dialog-foot"><button type="button" class="btn btn-secondary" data-close>Cancel</button><button type="submit" class="btn btn-primary">${icon('plus', 16)}<span>Add to review queue</span></button></footer>
    </form>
  </dialog>

  <dialog id="settingsDialog" class="dialog" aria-labelledby="settingsTitle">
    <form id="settingsForm" class="dialog-body">
      <header class="dialog-head"><div><h2 id="settingsTitle">Settings</h2><p>Saved in this browser only.</p></div>${close}</header>
      <section class="settings-section"><h3>Your name</h3>
        <label class="field"><span>Used in your greeting, the reply template, and AI draft sign-offs</span><input class="input" name="name" required maxlength="40" autocomplete="given-name"></label></section>
      <section class="settings-section" id="scheduleSection"></section>
      <section class="settings-section"><h3>How Triageo prioritizes</h3>
        <ol class="priority-list"><li>Urgent requests and deadlines within 48 hours</li><li>Important contacts requiring action</li><li>Requests waiting more than 48 hours</li><li>Routine messages needing a reply</li></ol>
        <p class="muted small">Promotions, automated messages and threads that don’t need a reply are set aside. Any edit to a draft removes its approval.</p></section>
      <section class="settings-section danger-zone"><h3>Privacy</h3>
        <div class="setting-row"><div><strong>Clear this browser’s workspace</strong><small>Deletes every saved conversation, draft and note on this device.</small></div><button type="button" class="btn btn-danger btn-sm" data-action="clear-workspace">${icon('trash-2', 16)}<span>Clear</span></button></div></section>
      <footer class="dialog-foot"><button type="button" class="btn btn-secondary" data-close>Cancel</button><button type="submit" class="btn btn-primary">Save</button></footer>
    </form>
  </dialog>

  <dialog id="connectionDialog" class="dialog" aria-labelledby="connTitle">
    <div class="dialog-body" id="connBody"></div>
  </dialog>

  <dialog id="confirmDialog" class="dialog dialog-sm" aria-labelledby="confirmTitle">
    <form method="dialog" class="dialog-body">
      <header class="dialog-head"><h2 id="confirmTitle"></h2></header>
      <p id="confirmText"></p>
      <footer class="dialog-foot"><button value="cancel" class="btn btn-secondary">Cancel</button><button value="ok" class="btn btn-primary" id="confirmOk"></button></footer>
    </form>
  </dialog>`;
}

export function openImport() {
  const form = document.getElementById('importForm');
  form.reset();
  const d = new Date();
  form.elements.received.value = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  document.getElementById('importDialog').showModal();
}

export function openSettings() {
  document.getElementById('settingsForm').elements.name.value = state.name;
  const u = state.server.user, live = status() === 'connected' || status() === 'expired';
  document.getElementById('scheduleSection').innerHTML = `<h3>Scheduled checks</h3>
    ${live ? `<label class="check toggle"><input type="checkbox" name="scheduleEnabled" ${u.scheduleEnabled ? 'checked' : ''}><span><strong>Check Gmail and prepare drafts automatically</strong><small>${esc(state.server.schedule)}. Drafts wait for your approval; nothing is sent.</small></span></label>
      <p class="muted small">${esc(lastCheck())}.${status() === 'expired' ? ' Paused until you reconnect Gmail.' : ''}</p>`
    : `<div class="setting-row"><div><strong>Weekday morning check</strong><small>Connect Gmail to have Triageo find emails that need a reply and draft them each weekday morning.</small></div><span class="chip chip-warn">Needs Gmail</span></div>`}`;
  document.getElementById('settingsDialog').showModal();
}

/** Styled replacement for window.confirm. Resolves true only on explicit confirmation. */
export function confirmDialog({ title, text, ok = 'Continue', danger = false }) {
  const dlg = document.getElementById('confirmDialog');
  dlg.querySelector('#confirmTitle').textContent = title;
  dlg.querySelector('#confirmText').innerHTML = esc(text);
  const btn = dlg.querySelector('#confirmOk');
  btn.textContent = ok;
  btn.className = `btn ${danger ? 'btn-danger' : 'btn-primary'}`;
  dlg.returnValue = 'cancel';
  dlg.showModal();
  btn.focus();
  return new Promise(res => dlg.addEventListener('close', () => res(dlg.returnValue === 'ok'), { once: true }));
}
