// Core review rules. These decide what reaches the queue and guard approval/export.
// classify, editDraft, approve and canExport are unchanged from the original app.
export const KEY = 'inbox-studio-v1'; // kept from before the rebrand so existing workspaces still load
export const HOUR = 3600000;

export function classify(t, now = Date.now()) {
  if (t.automated || !t.needsReply || t.skipped) return null;
  const due = t.deadline ? Date.parse(t.deadline) : NaN;
  if ((Number.isFinite(due) && due <= now + 48 * HOUR) || /\b(urgent|asap|time-sensitive|by today|by tomorrow)\b/i.test(t.subject + ' ' + t.request)) return 'Urgent';
  if (t.important) return 'Needs Reply';
  if (now - Date.parse(t.received) > 48 * HOUR) return 'Follow-Up';
  return 'Needs Reply';
}
export function editDraft(t, value) { t.draft = value; t.approved = false; t.approvedText = null; }
export function approve(t) { if (!t.draft?.trim()) return false; t.approved = true; t.approvedText = t.draft; return true; }
export function canExport(t) { return !!(t.approved && t.draft && t.approvedText === t.draft); }

export const RANK = { 'Urgent': 0, 'Needs Reply': 1, 'Follow-Up': 2 };
export const isActive = (t, now = Date.now()) => !t.approved && !!classify(t, now);
export const isSetAside = (t, now = Date.now()) => !t.approved && !classify(t, now);

/** Plain-language, rule-based explanation of why a thread was ranked where it is. */
export function reasonFor(t, now = Date.now()) {
  if (t.skipped) return 'You skipped this thread. Restore it to bring it back into review.';
  if (t.automated) return t.source === 'gmail'
    ? 'Looks like a newsletter or automated message (unsubscribe header or no-reply sender), so it is excluded from review.'
    : 'Marked as promotional or automated when imported, so it is excluded from review.';
  if (!t.needsReply) {
    if (t.source !== 'gmail') return 'Marked as not needing a reply when imported, so it is excluded from review.';
    if (t.ruleNeedsReply === false) return 'You sent the latest message in this Gmail thread, so it isn’t waiting on you.';
    return `The AI judged that no reply is needed${t.ai?.why ? `: ${t.ai.why}` : '.'}`;
  }
  const c = classify(t, now);
  if (c === 'Urgent') {
    const due = t.deadline ? Date.parse(t.deadline) : NaN;
    if (Number.isFinite(due) && due < now) return 'The deadline has passed.';
    if (Number.isFinite(due) && due <= now + 48 * HOUR) return 'The deadline is within 48 hours.';
    return 'The subject or request uses urgent language.';
  }
  if (c === 'Follow-Up') return 'This request has been waiting more than 48 hours.';
  if (t.important) return t.source === 'gmail' ? 'You starred this thread in Gmail.' : 'An important contact is waiting for your action.';
  return 'The sender is waiting for a response.';
}

/** 'approved' | 'draft' | 'empty' */
export function draftState(t) {
  if (canExport(t)) return 'approved';
  return t.draft?.trim() ? 'draft' : 'empty';
}

export function sortActive(list) {
  return list.sort((a, b) => (RANK[classify(a)] - RANK[classify(b)]) || (Date.parse(a.received) - Date.parse(b.received)));
}
