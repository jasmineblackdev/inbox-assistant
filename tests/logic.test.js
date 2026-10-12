// Safety rules: approval is tied to exact wording, edits revoke it, and set-aside threads stay out of review.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, editDraft, approve, canExport, reasonFor, draftState, HOUR } from '../dist/js/logic.js';
import { state, counts, listFor, reminders, replyStarter } from '../dist/js/store.js';

const NOW = Date.parse('2026-10-12T12:00:00Z');
const base = (o = {}) => ({ id: Math.random().toString(36).slice(2), sender: 'Alex Morgan', email: 'a@example.com', subject: 'Hello', body: 'Body', request: 'Reply please', received: new Date(NOW - HOUR).toISOString(), needsReply: true, draft: '', approved: false, ...o });

test('classify: excluded, skipped and no-reply threads are null', () => {
  assert.equal(classify(base({ automated: true }), NOW), null);
  assert.equal(classify(base({ needsReply: false }), NOW), null);
  assert.equal(classify(base({ skipped: true }), NOW), null);
});
test('classify: deadline within 48h or urgent wording is Urgent', () => {
  assert.equal(classify(base({ deadline: new Date(NOW + 47 * HOUR).toISOString() }), NOW), 'Urgent');
  assert.equal(classify(base({ deadline: new Date(NOW + 49 * HOUR).toISOString() }), NOW), 'Needs Reply');
  assert.equal(classify(base({ subject: 'Need this ASAP' }), NOW), 'Urgent');
});
test('classify: important contacts never age into Follow-Up; others do after 48h', () => {
  const old = new Date(NOW - 72 * HOUR).toISOString();
  assert.equal(classify(base({ received: old, important: true }), NOW), 'Needs Reply');
  assert.equal(classify(base({ received: old }), NOW), 'Follow-Up');
});
test('approve requires a non-empty draft', () => {
  const t = base({ draft: '   ' });
  assert.equal(approve(t), false);
  assert.equal(canExport(t), false);
});
test('approval covers the exact wording; any edit revokes it', () => {
  const t = base();
  editDraft(t, 'Hi Alex');
  assert.equal(approve(t), true);
  assert.equal(canExport(t), true);
  assert.equal(draftState(t), 'approved');
  editDraft(t, 'Hi Alex!');
  assert.equal(t.approved, false);
  assert.equal(canExport(t), false);
  assert.equal(draftState(t), 'draft');
});
test('canExport rejects a tampered draft that no longer matches approved text', () => {
  const t = base({ draft: 'A', approved: true, approvedText: 'B' });
  assert.equal(canExport(t), false);
});
test('reasonFor explains each rule', () => {
  assert.match(reasonFor(base({ deadline: new Date(NOW - HOUR).toISOString() }), NOW), /passed/);
  assert.match(reasonFor(base({ skipped: true }), NOW), /skipped/);
  assert.match(reasonFor(base({ automated: true }), NOW), /promotional/);
});
test('views: approved and set-aside threads leave the queue; sort is priority then oldest', () => {
  const urgent = base({ subject: 'urgent thing', received: new Date(NOW - 2 * HOUR).toISOString() });
  const older = base({ received: new Date(NOW - 10 * HOUR).toISOString() });
  const newer = base({ received: new Date(NOW - 1 * HOUR).toISOString() });
  const done = base({ draft: 'x', approved: true, approvedText: 'x' });
  const skipped = base({ skipped: true });
  const promo = base({ automated: true });
  state.items = [newer, done, promo, older, skipped, urgent]; state.query = '';
  assert.deepEqual(listFor('queue', NOW).map(t => t.id), [urgent.id, older.id, newer.id]);
  assert.deepEqual(listFor('approved', NOW).map(t => t.id), [done.id]);
  assert.equal(listFor('skipped', NOW).length, 2);
  const c = counts(NOW);
  assert.deepEqual([c.queue, c.urgent, c.approved, c.skipped], [3, 1, 1, 2]);
  state.query = 'urgent';
  assert.deepEqual(listFor('queue', NOW).map(t => t.id), [urgent.id]);
  state.query = '';
});
test('reminders only come from saved active threads', () => {
  state.items = [base({ deadline: new Date(NOW + 5 * HOUR).toISOString() }), base({ deadline: new Date(NOW - HOUR).toISOString() }), base({ received: new Date(NOW - 72 * HOUR).toISOString() }), base({ automated: true, deadline: new Date(NOW + HOUR).toISOString() })];
  assert.deepEqual(reminders(NOW).map(r => r.kind).sort(), ['due', 'overdue', 'waiting']);
});
test('reply template signs off with the saved name', () => {
  state.name = 'Sam';
  assert.match(replyStarter(base()), /Hi Alex,[\s\S]*Thank you,\nSam$/);
});
