// Browser-side merge of server threads: AI suggestions arrive, but your work is never overwritten.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { state, mergeGmail, listFor } from '../dist/js/store.js';
import { classify, editDraft, approve, canExport, reasonFor } from '../dist/js/logic.js';

const server = (o = {}) => ({ id: 'gmail:t1', gmailThreadId: 't1', source: 'gmail', sender: 'Alex', email: 'a@x.com', subject: 'Plan', body: 'b', snippet: 's', received: '2026-10-10T12:00:00.000Z', needsReply: true, automated: false, important: false, ai: null, aiCurrent: false, ...o });
const ai = (o = {}) => ({ needsReply: true, why: 'Asks a question', request: 'Confirm Tuesday', deadline: null, draft: 'Hi Alex, [confirm time] works.', missing: ['confirm time'], model: 'gpt-x', tone: 'friendly', at: 'now', ...o });

test('new thread arrives with AI draft as an unapproved draft', () => {
  state.items = [];
  assert.deepEqual(mergeGmail([server({ ai: ai(), aiCurrent: true })]), { added: 1, updated: 0 });
  const t = state.items[0];
  assert.equal(t.draft, 'Hi Alex, [confirm time] works.');
  assert.equal(t.aiDraft, t.draft);
  assert.equal(t.approved, false);
  assert.equal(t.request, 'Confirm Tuesday');
  assert.equal(classify(t) !== null, true);
});

test('a newer AI draft replaces an untouched AI draft, but never your edits or approval', () => {
  state.items = [];
  mergeGmail([server({ ai: ai() })]);
  const t = state.items[0];
  mergeGmail([server({ ai: ai({ draft: 'v2' }) })]);
  assert.equal(t.draft, 'v2', 'untouched AI draft updates');
  editDraft(t, 'my words');
  mergeGmail([server({ ai: ai({ draft: 'v3' }) })]);
  assert.equal(t.draft, 'my words', 'edits kept');
  assert.equal(t.aiDraft, 'v3');
  editDraft(t, 'v3'); approve(t);
  mergeGmail([server({ ai: ai({ draft: 'v4' }) })]);
  assert.equal(t.draft, 'v3'); assert.equal(canExport(t), true, 'approval kept');
});

test('AI “no reply needed” sets the thread aside with the reason; your include sticks', () => {
  state.items = [];
  mergeGmail([server({ ai: ai({ needsReply: false, why: 'Just an FYI', draft: '' }) })]);
  const t = state.items[0];
  assert.equal(classify(t), null);
  assert.match(reasonFor(t), /AI judged.*Just an FYI/);
  assert.equal(listFor('skipped').length, 1);
  Object.assign(t, { needsReply: true, automated: false, userIncluded: true });
  mergeGmail([server({ ai: ai({ needsReply: false, why: 'Just an FYI', draft: '' }) })]);
  assert.equal(classify(t) !== null, true, 'still in queue after re-sync');
});

test('replied-last threads explain themselves', () => {
  state.items = [];
  mergeGmail([server({ needsReply: false })]);
  assert.match(reasonFor(state.items[0]), /You sent the latest message/);
});

test('skips and notes survive re-sync; content updates count as updated', () => {
  state.items = [];
  mergeGmail([server()]);
  const t = state.items[0]; t.skipped = true; t.notes = 'n';
  assert.deepEqual(mergeGmail([server({ received: '2026-10-11T12:00:00.000Z', body: 'new' })]), { added: 0, updated: 1 });
  assert.equal(t.skipped, true); assert.equal(t.notes, 'n'); assert.equal(t.body, 'new');
});
