import type { DB } from "./client";
import { ConflictError, NotFoundError, ValidationError } from "./errors";
import { hashPassword, verifyPassword } from "./passwords";
import { parseAccountInput, parseEmail, parseId, parseNewUserInput, parseUsername } from "./validation";

export interface User {
  id: number;
  username: string;
  email: string | null; // null only for users created before emails existed
  createdAt: string;
}

interface UserRow {
  id: number;
  username: string;
  email: string | null;
  created_at: string;
}

const toUser = (row: UserRow): User => ({
  id: row.id,
  username: row.username,
  email: row.email,
  createdAt: row.created_at,
});

/** Throws ConflictError if the username or email is already used (case-insensitive). */
function assertAvailable(db: DB, username: string, email: string): void {
  if (db.prepare("SELECT 1 FROM users WHERE username = ?").get(username)) {
    throw new ConflictError(`The username "${username}" is taken`);
  }
  if (db.prepare("SELECT 1 FROM users WHERE email = ?").get(email)) {
    throw new ConflictError("An account with that email already exists");
  }
}

/** Create an account: { username, email, password }. Validates, hashes, saves. Use this one. */
export async function registerUser(db: DB, data: unknown): Promise<User> {
  const input = parseAccountInput(data);
  assertAvailable(db, input.username, input.email); // fail fast, before the slow hash
  const passwordHash = await hashPassword(input.password);
  return createUser(db, { username: input.username, email: input.email, passwordHash });
}

/** Save a user + an ALREADY-HASHED password in one transaction. Prefer registerUser(). */
export function createUser(db: DB, data: unknown): User {
  const input = parseNewUserInput(data);
  return db.transaction(() => {
    assertAvailable(db, input.username, input.email); // re-check inside the lock
    const row = db
      .prepare("INSERT INTO users (username, email) VALUES (?, ?) RETURNING id, username, email, created_at")
      .get(input.username, input.email) as UserRow;
    db.prepare("INSERT INTO user_credentials (user_id, password_hash) VALUES (?, ?)").run(row.id, input.passwordHash);
    return toUser(row);
  }).immediate();
}

export function getUserById(db: DB, id: unknown): User {
  const row = db
    .prepare("SELECT id, username, email, created_at FROM users WHERE id = ?")
    .get(parseId(id)) as UserRow | undefined;
  if (!row) throw new NotFoundError("User not found");
  return toUser(row);
}

/** Case-insensitive: "Garf" and "garf" are the same user. */
export function getUserByUsername(db: DB, username: unknown): User {
  const row = db
    .prepare("SELECT id, username, email, created_at FROM users WHERE username = ?")
    .get(parseUsername(username)) as UserRow | undefined;
  if (!row) throw new NotFoundError("User not found");
  return toUser(row);
}

/** Case-insensitive. */
export function getUserByEmail(db: DB, email: unknown): User {
  const row = db
    .prepare("SELECT id, username, email, created_at FROM users WHERE email = ?")
    .get(parseEmail(email)) as UserRow | undefined;
  if (!row) throw new NotFoundError("User not found");
  return toUser(row);
}

// Checked when the user doesn't exist, so "no such user" takes as long as
// "wrong password" and timing doesn't reveal which accounts exist.
let dummyHash: Promise<string> | undefined;

/** Username OR email + password -> the user, or null if anything is wrong. */
export async function checkPassword(db: DB, login: unknown, password: unknown): Promise<User | null> {
  if (typeof password !== "string" || password.length === 0 || password.length > 512) return null;
  let row: (UserRow & { password_hash: string }) | undefined;
  try {
    // Usernames can't contain "@", so anything with one is an email.
    const byEmail = typeof login === "string" && login.includes("@");
    const value = byEmail ? parseEmail(login) : parseUsername(login);
    row = db
      .prepare(
        `SELECT u.id, u.username, u.email, u.created_at, c.password_hash
         FROM users u JOIN user_credentials c ON c.user_id = u.id
         WHERE ${byEmail ? "u.email" : "u.username"} = ?`,
      )
      .get(value) as typeof row;
  } catch (err) {
    if (!(err instanceof ValidationError)) throw err;
  }
  if (!row) {
    await verifyPassword(password, await (dummyHash ??= hashPassword("not-a-real-password")));
    return null;
  }
  return (await verifyPassword(password, row.password_hash)) ? toUser(row) : null;
}