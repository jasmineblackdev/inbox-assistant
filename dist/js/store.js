// Browser-local workspace. Same storage key and item shape as the original app;
// `name` is an optional extra field that older versions simply ignore.
import { KEY, HOUR, classify, canExport, isActive, isSetAside, sortActive } from './logic.js';

// `server` mirrors /api/me and is never persisted locally.
export const state = { items: [], demo: false, name: 'Jasmine', query: '', server: { loaded: false, configured: false, user: null, schedule: '' } };

const valid = t => t && typeof t.id === 'string' && typeof t.subject === 'string' && typeof t.body === 'string';

export function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved && Array.isArray(saved.items)) { state.items = saved.items.filter(valid); state.demo = !!saved.demo; }
    if (saved && typeof saved.name === 'string' && saved.name.trim()) state.name = saved.name.trim().slice(0, 40);
  } catch { /* unreadable storage: start empty */ }
}

/** Returns false when the browser refuses to store data. */
export function persist() {
  try { localStorage.setItem(KEY, JSON.stringify({ items: state.items, demo: state.demo, name: state.name })); return true; }
  catch { return false; }
}

export const find = id => state.items.find(t => t.id === id) || null;

export const VIEWS = {
  overview: { label: 'Overview', icon: 'layout-dashboard' },
  queue: { label: 'Review queue', icon: 'inbox' },
  urgent: { label: 'Urgent', icon: 'alarm-clock', cls: 'Urgent' },
  reply: { label: 'Needs reply', icon: 'reply', cls: 'Needs Reply' },
  follow: { label: 'Follow-ups', icon: 'repeat', cls: 'Follow-Up' },
  approved: { label: 'Approved drafts', icon: 'check-check' },
  skipped: { label: 'Skipped', icon: 'eye-off' },
};

export function counts(now = Date.now()) {
  const active = state.items.filter(t => isActive(t, now));
  const by = c => active.filter(t => classify(t, now) === c).length;
  return {
    queue: active.length, urgent: by('Urgent'), reply: by('Needs Reply'), follow: by('Follow-Up'),
    approved: state.items.filter(canExport).length,
    skipped: state.items.filter(t => isSetAside(t, now)).length,
    drafts: active.filter(t => t.draft?.trim()).length,
  };
}

function matches(t, q) {
  if (!q) return true;
  return [t.sender, t.email, t.subject, t.body, t.request].join(' ').toLowerCase().includes(q);
}

export function listFor(view, now = Date.now()) {
  const q = state.query.trim().toLowerCase();
  let list;
  if (view === 'approved') list = state.items.filter(canExport);
  else if (view === 'skipped') list = state.items.filter(t => isSetAside(t, now));
  else {
    const cls = VIEWS[view]?.cls;
    list = state.items.filter(t => isActive(t, now) && (!cls || classify(t, now) === cls));
  }
  list = list.filter(t => matches(t, q));
  return view === 'approved' || view === 'skipped'
    ? list.sort((a, b) => Date.parse(b.received) - Date.parse(a.received))
    : sortActive(list);
}

/** Reminders derived only from conversations saved in this browser. */
export function reminders(now = Date.now()) {
  const out = [];
  for (const t of sortActive(state.items.filter(t => isActive(t, now)))) {
    const due = t.deadline ? Date.parse(t.deadline) : NaN;
    if (Number.isFinite(due) && due < now) out.push({ t, kind: 'overdue' });
    else if (Number.isFinite(due) && due <= now + 24 * HOUR) out.push({ t, kind: 'due' });
    else if (classify(t, now) === 'Follow-Up') out.push({ t, kind: 'waiting' });
  }
  return out;
}

export function demoItems(now = Date.now()) {
  const n = state.name;
  return [
    { sender: 'Alex Morgan', email: 'alex@example.com', subject: 'A quick review before tomorrow’s launch', request: 'Review the copy and flag any changes before launch.', body: `Hi ${n},\nCould you review the launch copy and let me know if anything needs adjusting? We’re aiming to wrap up tomorrow.\nThanks, Alex`, deadline: new Date(now + 20 * HOUR).toISOString(), received: new Date(now - 2 * HOUR).toISOString(), important: true },
    { sender: 'Jordan Lee', email: 'jordan@example.com', subject: 'Availability for our project check-in', request: 'Share your availability for a project check-in.', body: `Hi ${n},\nWhat times work for you for a project check-in next week?\nThanks, Jordan`, received: new Date(now - 24 * HOUR).toISOString(), important: true },
    { sender: 'Taylor Brooks', email: 'taylor@example.com', subject: 'Following up on the design direction', request: 'Give feedback on the proposed design direction.', body: `Hi ${n},\nJust checking whether you have feedback on the design direction. Let me know if you need anything else.\nThanks, Taylor`, received: new Date(now - 72 * HOUR).toISOString() },
  ].map(t => ({ ...t, id: crypto.randomUUID(), needsReply: true, draft: '', notes: 'Confirm the details needed for your reply.', approved: false }));
}

/**
 * Merge threads from the server. Content and AI suggestions update; your edits, approval,
 * notes, skips and "add to queue" choices are kept. An AI draft only replaces the editor
 * text if you haven't changed what the AI wrote before.
 */
export function mergeGmail(threads) {
  let added = 0, updated = 0;
  for (const s of threads) {
    const ai = s.ai || null;
    const fields = {
      source: 'gmail', gmailThreadId: s.gmailThreadId, sender: s.sender, email: s.email, subject: s.subject,
      body: s.body, snippet: s.snippet, received: s.received,
      ruleNeedsReply: s.needsReply, needsReply: s.needsReply && (ai ? ai.needsReply : true), automated: s.automated,
      request: ai?.request || '', deadline: ai?.deadline || null,
      ai: ai ? { why: ai.why, missing: ai.missing || [], model: ai.model, at: ai.at, tone: ai.tone, current: !!s.aiCurrent } : null,
    };
    const t = find(s.id);
    if (!t) {
      state.items.push({ id: s.id, ...fields, important: s.important, draft: ai?.draft || '', aiDraft: ai?.draft || '', notes: '', approved: false });
      added++; continue;
    }
    if (s.received !== t.received) updated++;
    if (t.userIncluded) { fields.needsReply = true; fields.automated = false; }
    Object.assign(t, fields, { important: t.important || s.important });
    if (ai?.draft && ai.draft !== t.aiDraft) {
      if (!t.draft?.trim() || (t.draft === t.aiDraft && !t.approved)) { t.draft = ai.draft; t.approved = false; t.approvedText = null; }
      t.aiDraft = ai.draft;
    }
  }
  return { added, updated };
}

export const replyStarter = t => `Hi ${t.sender.split(' ')[0]},\n\nThanks for reaching out. Could you share a little more detail about what you need from me?\n\nThank you,\n${state.name}`;
