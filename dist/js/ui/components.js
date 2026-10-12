// Small shared building blocks that return HTML strings.
import { icon } from '../icons.js';
import { esc, initials, until } from '../format.js';
import { classify, canExport, draftState } from '../logic.js';

const TINTS = [['#e0e7ff', '#3730a3'], ['#dbeafe', '#1e40af'], ['#ede9fe', '#5b21b6'], ['#e0f2fe', '#075985'], ['#fce7f3', '#9d174d'], ['#dcfce7', '#166534']];
export function avatar(name, size = 32) {
  let h = 0; for (const c of String(name)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const [bg, fg] = TINTS[h % TINTS.length];
  return `<span class="avatar" style="--av-bg:${bg};--av-fg:${fg};--av-size:${size}px" aria-hidden="true">${esc(initials(name))}</span>`;
}

const BADGES = {
  'Urgent': ['urgent', 'alarm-clock', 'Urgent'], 'Needs Reply': ['neutral', 'reply', 'Needs reply'], 'Follow-Up': ['warn', 'repeat', 'Follow-up'],
  approved: ['ok', 'check', 'Approved'], skipped: ['muted', 'eye-off', 'Skipped'], excluded: ['muted', 'archive', 'Excluded'],
};
export function badge(t) {
  const key = canExport(t) ? 'approved' : classify(t) || (t.skipped ? 'skipped' : 'excluded');
  const [cls, ic, label] = BADGES[key];
  return `<span class="badge badge-${cls}">${icon(ic, 12)}${label}</span>`;
}

export function draftChip(t) {
  const s = draftState(t);
  if (s === 'approved') return `<span class="chip chip-ok">${icon('shield-check', 12)}Approved · unsent</span>`;
  if (s === 'draft') return `<span class="chip chip-accent">${icon('pen-line', 12)}Draft · needs approval</span>`;
  return `<span class="chip">${icon('file-text', 12)}No draft yet</span>`;
}

export function dueChip(t, now) {
  if (!t.deadline) return '';
  const overdue = Date.parse(t.deadline) < now;
  return `<span class="chip ${overdue ? 'chip-urgent' : ''}">${icon('calendar-clock', 12)}Due ${esc(until(t.deadline, now))}</span>`;
}

/** The next concrete step for a thread. */
export function nextAction(t) {
  const s = draftState(t);
  if (s === 'approved') return { label: 'Export', icon: 'download' };
  if (s === 'draft') return { label: 'Review & approve', icon: 'shield-check' };
  return { label: 'Write reply', icon: 'pen-line' };
}

export function button(label, { action, variant = 'secondary', ic, attrs = '', size = '' } = {}) {
  return `<button type="button" class="btn btn-${variant} ${size}" ${action ? `data-action="${action}"` : ''} ${attrs}>${ic ? icon(ic, 16) : ''}<span>${label}</span></button>`;
}

const ART = `<svg class="empty-art" viewBox="0 0 160 112" aria-hidden="true">
  <rect x="22" y="30" width="96" height="68" rx="12" fill="var(--art-back)"/>
  <rect x="34" y="20" width="96" height="68" rx="12" fill="var(--surface)" stroke="var(--border-strong)"/>
  <path d="M46 40l30 21a4 4 0 0 0 4.6 0L118 40" fill="none" stroke="var(--art-line)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="46" y="68" width="40" height="5" rx="2.5" fill="var(--border)"/>
  <circle cx="126" cy="86" r="16" fill="var(--accent)"/>
  <path d="M119 86l5 5 9-10" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M139 17c.6 3 1.9 4.5 5.2 5.2-3.3.7-4.6 2.2-5.2 5.2-.6-3-1.9-4.5-5.2-5.2 3.3-.7 4.6-2.2 5.2-5.2z" fill="var(--peri)"/>
</svg>`;
export function emptyState({ title, body, actions = '', art = true, compact = false }) {
  return `<div class="empty ${compact ? 'empty-compact' : ''}">${art ? ART : ''}<h3>${title}</h3><p>${body}</p>${actions ? `<div class="empty-actions">${actions}</div>` : ''}</div>`;
}
