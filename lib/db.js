// Neon Postgres. Stores the encrypted Google refresh token, recent thread copies and AI drafts.
import { neon } from '@neondatabase/serverless';
import { env, RETENTION_DAYS } from './config.js';

let sql, ready;
const db = () => (sql ||= neon(env('DATABASE_URL')));

async function ensureSchema() {
  return ready ||= (async () => {
    const q = db();
    await q`create table if not exists users (
      id text primary key, email text unique not null, name text,
      refresh_token text, needs_reconnect boolean not null default false,
      schedule_enabled boolean not null default true, last_sync_at timestamptz,
      created_at timestamptz not null default now())`;
    await q`create table if not exists threads (
      user_id text not null references users(id) on delete cascade, thread_id text not null,
      data jsonb not null, content_hash text not null, ai jsonb, ai_hash text,
      updated_at timestamptz not null default now(), primary key (user_id, thread_id))`;
    await q`alter table users add column if not exists ai_key text`;
    await q`alter table users add column if not exists ai_model text`;
    await q`create table if not exists runs (
      id bigserial primary key, user_id text not null references users(id) on delete cascade,
      kind text not null, started_at timestamptz not null default now(), finished_at timestamptz,
      found int, drafted int, failed int, error text)`;
  })();
}

export const store = {
  async upsertUser({ id, email, name, refreshToken }) {
    await ensureSchema();
    // Google only returns a refresh token on consent; keep the old one if this login didn't include it.
    const [u] = await db()`insert into users (id, email, name, refresh_token, needs_reconnect)
      values (${id}, ${email}, ${name}, ${refreshToken}, false)
      on conflict (id) do update set email = excluded.email,
        name = coalesce(users.name, excluded.name),
        refresh_token = coalesce(excluded.refresh_token, users.refresh_token),
        needs_reconnect = case when excluded.refresh_token is null then users.needs_reconnect else false end
      returning *`;
    return u;
  },
  async user(id) { await ensureSchema(); return (await db()`select * from users where id = ${id}`)[0] || null; },
  async scheduledUsers() { await ensureSchema(); return db()`select * from users where schedule_enabled and not needs_reconnect and refresh_token is not null`; },
  async updateUser(id, { name, scheduleEnabled, aiModel }) {
    await ensureSchema();
    return (await db()`update users set name = coalesce(${name ?? null}, name), schedule_enabled = coalesce(${scheduleEnabled ?? null}, schedule_enabled), ai_model = coalesce(${aiModel ?? null}, ai_model) where id = ${id} returning *`)[0];
  },
  async setAiKey(id, encryptedKey) { await ensureSchema(); await db()`update users set ai_key = ${encryptedKey} where id = ${id}`; },
  async markReconnect(id) { await db()`update users set needs_reconnect = true where id = ${id}`; },
  async touchSync(id) { await db()`update users set last_sync_at = now() where id = ${id}`; },
  async deleteUser(id) { await ensureSchema(); await db()`delete from users where id = ${id}`; },

  async threads(userId) { await ensureSchema(); return db()`select thread_id, data, content_hash, ai, ai_hash, updated_at from threads where user_id = ${userId} order by updated_at desc`; },
  async thread(userId, threadId) { return (await db()`select * from threads where user_id = ${userId} and thread_id = ${threadId}`)[0] || null; },
  async upsertThread(userId, threadId, data, hash) {
    await db()`insert into threads (user_id, thread_id, data, content_hash) values (${userId}, ${threadId}, ${JSON.stringify(data)}, ${hash})
      on conflict (user_id, thread_id) do update set data = excluded.data, content_hash = excluded.content_hash, updated_at = now()`;
  },
  async setAi(userId, threadId, ai, hash) {
    await db()`update threads set ai = ${JSON.stringify(ai)}, ai_hash = ${hash} where user_id = ${userId} and thread_id = ${threadId}`;
  },
  async prune(userId) {
    await db()`delete from threads where user_id = ${userId} and updated_at < now() - make_interval(days => ${RETENTION_DAYS})`;
  },

  async startRun(userId, kind) { return (await db()`insert into runs (user_id, kind) values (${userId}, ${kind}) returning id`)[0].id; },
  async finishRun(id, { found = null, drafted = null, failed = null, error = null }) {
    await db()`update runs set finished_at = now(), found = ${found}, drafted = ${drafted}, failed = ${failed}, error = ${error} where id = ${id}`;
  },
  async lastRun(userId) { await ensureSchema(); return (await db()`select kind, started_at, finished_at, found, drafted, failed, error from runs where user_id = ${userId} and finished_at is not null order by id desc limit 1`)[0] || null; },
};
