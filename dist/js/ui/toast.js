import { icon } from '../icons.js';
import { esc } from '../format.js';

/** toast('Saved', { tone: 'ok'|'error'|'info', action: { label, run } }) */
export function toast(message, { tone = 'ok', action, ms = 4500 } = {}) {
  const region = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast toast-${tone}`;
  el.innerHTML = `${icon(tone === 'error' ? 'triangle-alert' : tone === 'info' ? 'info' : 'circle-check', 16)}<span>${esc(message)}</span>${action ? `<button type="button" class="toast-action">${esc(action.label)}</button>` : ''}<button type="button" class="toast-close" aria-label="Dismiss">${icon('x', 14)}</button>`;
  const remove = () => { el.classList.add('leaving'); setTimeout(() => el.remove(), 200); };
  el.querySelector('.toast-close').onclick = remove;
  if (action) el.querySelector('.toast-action').onclick = () => { action.run(); remove(); };
  region.append(el);
  while (region.children.length > 3) region.firstElementChild.remove();
  setTimeout(remove, action ? ms + 2500 : ms);
}
