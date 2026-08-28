import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const file = process.env.REPS_DB || join(here, "data", "reps.db");

mkdirSync(dirname(file), { recursive: true });

export const db = new DatabaseSync(file);

db.exec(`
  pragma journal_mode = WAL;
  pragma foreign_keys = ON;

  create table if not exists users (
    id         text primary key,
    email      text not null unique,
    salt       text not null,
    hash       text not null,
    created_at integer not null
  );

  create table if not exists sessions (
    token_hash text primary key,
    user_id    text not null references users(id) on delete cascade,
    expires_at integer not null,
    created_at integer not null
  );

  create table if not exists states (
    user_id    text primary key references users(id) on delete cascade,
    state      text not null,
    updated_at integer not null
  );

  create index if not exists sessions_user_idx on sessions(user_id);
  create index if not exists sessions_expiry_idx on sessions(expires_at);
`);

const q = {
  userByEmail: db.prepare("select * from users where email = ?"),
  userById: db.prepare("select id, email, created_at from users where id = ?"),
  insertUser: db.prepare(
    "insert into users (id, email, salt, hash, created_at) values (?, ?, ?, ?, ?)",
  ),
  insertSession: db.prepare(
    "insert into sessions (token_hash, user_id, expires_at, created_at) values (?, ?, ?, ?)",
  ),
  sessionByHash: db.prepare("select * from sessions where token_hash = ?"),
  deleteSession: db.prepare("delete from sessions where token_hash = ?"),
  sweepSessions: db.prepare("delete from sessions where expires_at < ?"),
  getState: db.prepare("select state, updated_at from states where user_id = ?"),
  putState: db.prepare(`
    insert into states (user_id, state, updated_at) values (?, ?, ?)
    on conflict(user_id) do update set state = excluded.state, updated_at = excluded.updated_at
  `),
};

export const Users = {
  byEmail: (email) => q.userByEmail.get(email),
  byId: (id) => q.userById.get(id),
  create: (row) => q.insertUser.run(row.id, row.email, row.salt, row.hash, row.created_at),
};

export const Sessions = {
  create: (hash, userId, expiresAt) => q.insertSession.run(hash, userId, expiresAt, Date.now()),
  find: (hash) => q.sessionByHash.get(hash),
  drop: (hash) => q.deleteSession.run(hash),
  sweep: () => q.sweepSessions.run(Date.now()),
};

export const States = {
  get: (userId) => q.getState.get(userId),
  put: (userId, state) => q.putState.run(userId, state, Date.now()),
};
