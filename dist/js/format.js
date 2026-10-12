import { HOUR } from './logic.js';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Absolute time, always Eastern to match the review schedule. */
export const fmtDate = s => new Date(s).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) + ' ET';

export function fmtShort(s, now = Date.now()) {
  const d = new Date(s), opts = { timeZone: 'America/New_York' };
  const sameDay = d.toLocaleDateString('en-US', opts) === new Date(now).toLocaleDateString('en-US', opts);
  return sameDay
    ? d.toLocaleTimeString('en-US', { ...opts, hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString('en-US', { ...opts, month: 'short', day: 'numeric' });
}

function span(ms) {
  const h = Math.round(ms / HOUR);
  if (h < 1) return `${Math.max(1, Math.round(ms / 60000))}m`;
  if (h < 48) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}
export const ago = (s, now = Date.now()) => `${span(now - Date.parse(s))} ago`;
export function until(s, now = Date.now()) {
  const ms = Date.parse(s) - now;
  return ms < 0 ? `${span(-ms)} overdue` : `in ${span(ms)}`;
}

export const firstName = s => String(s || '').trim().split(/\s+/)[0] || '';
export const initials = s => String(s || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('') || '?';
export const preview = (s, n = 110) => { const one = String(s || '').replace(/\s+/g, ' ').trim(); return one.length > n ? one.slice(0, n - 1) + '…' : one; };

export function greeting(now = new Date()) {
  const h = Number(now.toLocaleString('en-US', { hour: 'numeric', hour12: false }));
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}
