import type { DB } from "./client";
import { ConflictError, NotFoundError } from "./errors";
import { parseId, parseUsername } from "./validation";

export interface User {
  id: number;
  username: string;
  createdAt: string;
}

interface UserRow {
  id: number;
  username: string;
  created_at: string;
}

const toUser = (row: UserRow): User => ({
  id: row.id,
  username: row.username,
  createdAt: row.created_at,
});

export function createUser(db: DB, username: unknown): User {
  const name = parseUsername(username);
  return db.transaction(() => {
    const taken = db.prepare("SELECT 1 FROM users WHERE username = ?").get(name);
    if (taken) throw new ConflictError(`The username "${name}" is taken`);
    const row = db
      .prepare("INSERT INTO users (username) VALUES (?) RETURNING id, username, created_at")
      .get(name) as UserRow;
    return toUser(row);
  }).immediate();
}

export function getUserById(db: DB, id: unknown): User {
  const row = db
    .prepare("SELECT id, username, created_at FROM users WHERE id = ?")
    .get(parseId(id)) as UserRow | undefined;
  if (!row) throw new NotFoundError("User not found");
  return toUser(row);
}

/** Case-insensitive: "Garf" and "garf" are the same user. */
export function getUserByUsername(db: DB, username: unknown): User {
  const row = db
    .prepare("SELECT id, username, created_at FROM users WHERE username = ?")
    .get(parseUsername(username)) as UserRow | undefined;
  if (!row) throw new NotFoundError("User not found");
  return toUser(row);
}
