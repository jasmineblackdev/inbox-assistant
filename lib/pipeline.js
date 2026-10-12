// One sync: read recent inbox threads, store copies, and draft replies for new or changed threads.
import { QUERY, toItem } from './parse.js';
import { MAX_THREADS, MAX_DRAFTS_PER_RUN } from './config.js';

async function mapLimit(items, n, fn) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}

/**
 * deps: { google: { accessToken, listThreads, getThread }, ai: { draftReply }, store, ReconnectError, aiKey(user) }
 * Returns { found, drafted, failed, pending, aiConnected, aiProblem }.
 */
export async function syncUser(user, kind, deps) {
  const { google, ai, store, ReconnectError } = deps;
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

    // Drafting uses the user's own AI account. Without one, threads are still found and ranked by rules.
    const apiKey = deps.aiKey(user);
    let drafted = 0, failed = 0, aiProblem = null;
    if (apiKey) {
      await mapLimit(todo.slice(0, MAX_DRAFTS_PER_RUN), 3, async item => {
        if (aiProblem) return; // out of credits or disconnected: stop spending attempts
        try {
          const result = await ai.draftReply({ item, name: user.name || user.email.split('@')[0], apiKey, model: user.ai_model });
          await store.setAi(user.id, item.gmailThreadId, result, item.lastMessageId);
          drafted++;
        } catch (e) {
          failed++;
          if (e.code === 'no_credits' || e.code === 'revoked') aiProblem = { code: e.code, message: e.message };
        }
      });
      if (aiProblem?.code === 'revoked') await store.setAiKey(user.id, null);
    }

    await store.prune(user.id);
    await store.touchSync(user.id);
    const found = items.filter(i => i.needsReply && !i.automated).length;
    await store.finishRun(run, { found, drafted, failed, error: aiProblem?.message || null });
    return { found, drafted, failed, pending: apiKey ? Math.max(0, todo.length - MAX_DRAFTS_PER_RUN) : todo.length, aiConnected: !!apiKey && aiProblem?.code !== 'revoked', aiProblem };
  } catch (e) {
    await store.finishRun(run, { error: String(e.message || e).slice(0, 300) });
    throw e;
  }
}
