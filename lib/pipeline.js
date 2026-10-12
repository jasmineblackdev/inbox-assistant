// One sync: read recent inbox threads, store copies, and draft replies for new or changed threads.
import { QUERY, toItem } from './parse.js';
import { MAX_THREADS, MAX_DRAFTS_PER_RUN } from './config.js';

async function mapLimit(items, n, fn) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}

/**
 * deps: { google: { accessToken, listThreads, getThread }, ai: { draftReply }, store, ReconnectError }
 * Returns { found, drafted, failed }.
 */
export async function syncUser(user, kind, { google, ai, store, ReconnectError }) {
  const run = await store.startRun(user.id, kind);
  try {
    let token;
    try { token = await google.accessToken(user); }
    catch (e) { if (e instanceof ReconnectError) await store.markReconnect(user.id); throw e; }

    const ids = await google.listThreads(token, QUERY, MAX_THREADS);
    const threads = await mapLimit(ids, 5, id => google.getThread(token, id));
    const items = threads.map(t => toItem(t, user.email)).filter(Boolean);
    const known = new Map((await store.threads(user.id)).map(r => [r.thread_id, r]));

    const todo = [];
    for (const item of items) {
      await store.upsertThread(user.id, item.gmailThreadId, item, item.lastMessageId);
      const prev = known.get(item.gmailThreadId);
      if (item.needsReply && !item.automated && prev?.ai_hash !== item.lastMessageId) todo.push(item);
    }

    let drafted = 0, failed = 0;
    await mapLimit(todo.slice(0, MAX_DRAFTS_PER_RUN), 3, async item => {
      try {
        const result = await ai.draftReply({ item, name: user.name || user.email.split('@')[0] });
        await store.setAi(user.id, item.gmailThreadId, result, item.lastMessageId);
        drafted++;
      } catch { failed++; }
    });

    await store.prune(user.id);
    await store.touchSync(user.id);
    const found = items.filter(i => i.needsReply && !i.automated).length;
    await store.finishRun(run, { found, drafted, failed });
    return { found, drafted, failed, pending: Math.max(0, todo.length - MAX_DRAFTS_PER_RUN) };
  } catch (e) {
    await store.finishRun(run, { error: String(e.message || e).slice(0, 300) });
    throw e;
  }
}
