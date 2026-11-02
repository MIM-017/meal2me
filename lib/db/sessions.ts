import { createHash, randomBytes } from "node:crypto";
import type { DB } from "./client";
import { parseId } from "./validation";
import type { User } from "./users";

/** How long a login lasts before the user has to sign in again. */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface NewSession {
  token: string; // goes in the cookie; never stored in the database
  expiresAt: Date;
}

// 32 random bytes = 256 bits: can't be guessed. base64url is cookie-safe.
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Start a session for `userId`. Also clears out expired sessions. */
export function createSession(db: DB, userId: unknown, now = new Date()): NewSession {
  const id = parseId(userId, "userId");
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  db.transaction(() => {
    db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(now.toISOString());
    db.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)").run(
      hashToken(token),
      id,
      expiresAt.toISOString(),
    );
  }).immediate();
  return { token, expiresAt };
}

/** The user a session token belongs to, or null if it's missing, malformed, unknown or expired. */
export function getSessionUser(db: DB, token: unknown, now = new Date()): User | null {
  if (typeof token !== "string" || !TOKEN_RE.test(token)) return null;
  const row = db
    .prepare(
      `SELECT u.id, u.username, u.email, u.created_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .get(hashToken(token), now.toISOString()) as
    | { id: number; username: string; email: string | null; created_at: string }
    | undefined;
  if (!row) return null;
  return { id: row.id, username: row.username, email: row.email, createdAt: row.created_at };
}

/** End one session (log out). Unknown or malformed tokens are ignored. */
export function deleteSession(db: DB, token: unknown): void {
  if (typeof token !== "string" || !TOKEN_RE.test(token)) return;
  db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
}

/** End every session a user has (e.g. "log out everywhere", or after a password change). */
export function deleteUserSessions(db: DB, userId: unknown): void {
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(parseId(userId, "userId"));
}
