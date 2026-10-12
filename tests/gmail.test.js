// Gmail threads → Triageo items, and re-fetch merging that never discards your work.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toItem, parseAddress } from '../dist/js/gmail.js';
import { state, mergeGmail } from '../dist/js/store.js';
import { classify, editDraft, approve, canExport } from '../dist/js/logic.js';

const b64 = s => Buffer.from(s, 'utf8').toString('base64url');
const msg = ({ from, to = 'me@example.com', subject = 'Hello', text, at, labels = ['INBOX'], headers = [] }) => ({
  internalDate: String(Date.parse(at)), labelIds: labels, snippet: text.slice(0, 50),
  payload: { mimeType: 'multipart/alternative', headers: [{ name: 'From', value: from }, { name: 'To', value: to }, { name: 'Subject', value: subject }, ...headers],
    parts: [{ mimeType: 'text/plain', body: { data: b64(text) } }] },
});
const ME = 'me@example.com';

test('parseAddress handles display names and bare addresses', () => {
  assert.deepEqual(parseAddress('"Alex Morgan" <alex@x.com>'), { name: 'Alex Morgan', email: 'alex@x.com' });
  assert.deepEqual(parseAddress('alex@x.com'), { name: 'alex@x.com', email: 'alex@x.com' });
});

test('inbound thread needs a reply; text is decoded and quoted history dropped', () => {
  const t = toItem({ id: 't1', messages: [msg({ from: 'Alex <alex@x.com>', subject: 'Launch copy — ünïcode', text: 'Can you review?\n\nOn Mon, Bob wrote:\n> old stuff', at: '2026-10-10T12:00:00Z' })] }, ME);
  assert.equal(t.id, 'gmail:t1'); assert.equal(t.source, 'gmail');
  assert.equal(t.sender, 'Alex'); assert.equal(t.email, 'alex@x.com');
  assert.equal(t.subject, 'Launch copy — ünïcode');
  assert.equal(t.needsReply, true); assert.equal(t.automated, false);
  assert.match(t.body, /Can you review\?/); assert.doesNotMatch(t.body, /old stuff/);
  assert.equal(t.received, '2026-10-10T12:00:00.000Z');
  assert.equal(t.request, '');
});

test('thread where I replied last is not waiting on me', () => {
  const t = toItem({ id: 't2', messages: [
    msg({ from: 'Alex <alex@x.com>', text: 'Question?', at: '2026-10-10T12:00:00Z' }),
    msg({ from: 'Me <me@example.com>', text: 'Answer.', at: '2026-10-10T13:00:00Z', labels: ['SENT'] }),
  ] }, ME);
  assert.equal(t.needsReply, false);
  assert.equal(classify(t), null);
  assert.equal(t.received, '2026-10-10T12:00:00.000Z', 'received = latest inbound message');
});

test('threads with only my messages are skipped entirely', () => {
  assert.equal(toItem({ id: 't3', messages: [msg({ from: 'me@example.com', text: 'note to self', at: '2026-10-10T12:00:00Z', labels: ['SENT'] })] }, ME), null);
});

test('newsletters and no-reply senders are marked automated', () => {
  const news = toItem({ id: 'n', messages: [msg({ from: 'News <hi@news.com>', text: 'Weekly', at: '2026-10-10T12:00:00Z', headers: [{ name: 'List-Unsubscribe', value: '<mailto:u@news.com>' }] })] }, ME);
  const bot = toItem({ id: 'b', messages: [msg({ from: 'Svc <no-reply@svc.com>', text: 'Receipt', at: '2026-10-10T12:00:00Z' })] }, ME);
  assert.equal(news.automated, true); assert.equal(bot.automated, true);
  assert.equal(classify(news), null);
});

test('starred threads count as important', () => {
  const t = toItem({ id: 's', messages: [msg({ from: 'A <a@x.com>', text: 'hi', at: '2026-10-10T12:00:00Z', labels: ['INBOX', 'STARRED'] })] }, ME);
  assert.equal(t.important, true);
});

test('re-fetching updates content but keeps drafts, approval, notes and skips', () => {
  const first = toItem({ id: 'm', messages: [msg({ from: 'A <a@x.com>', text: 'v1', at: '2026-10-10T12:00:00Z' })] }, ME);
  const other = toItem({ id: 'o', messages: [msg({ from: 'B <b@x.com>', text: 'x', at: '2026-10-10T12:00:00Z' })] }, ME);
  state.items = [];
  assert.deepEqual(mergeGmail([first, other]), { added: 2, updated: 0 });
  const t = state.items[0];
  editDraft(t, 'My reply'); approve(t); t.notes = 'n';
  state.items[1].skipped = true;
  const again = toItem({ id: 'm', messages: [msg({ from: 'A <a@x.com>', text: 'v1', at: '2026-10-10T12:00:00Z' }), msg({ from: 'A <a@x.com>', text: 'v2', at: '2026-10-11T12:00:00Z' })] }, ME);
  const otherAgain = toItem({ id: 'o', messages: [msg({ from: 'B <b@x.com>', text: 'x', at: '2026-10-10T12:00:00Z' })] }, ME);
  assert.deepEqual(mergeGmail([again, otherAgain]), { added: 0, updated: 1 });
  assert.equal(state.items.length, 2);
  assert.match(t.body, /v2/);
  assert.equal(t.draft, 'My reply'); assert.equal(canExport(t), true); assert.equal(t.notes, 'n');
  assert.equal(state.items[1].skipped, true);
});
