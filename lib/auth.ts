// Server-only: reads/writes the session cookie and the database.
// Never import this from a file marked "use client".

import { cookies } from "next/headers";
import { createSession, deleteSession, getRequestDb, getSessionUser, type User } from "@/lib/db";

/** Name of the httpOnly cookie that holds the session token. proxy.ts checks for it too. */
export const SESSION_COOKIE = "meal2me_session";

/** The logged-in user for this request, or null. Re-checks the database every time. */
export async function getCurrentUser(): Promise<User | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return getSessionUser(await getRequestDb(), token);
}

/** Start a new session and put its token in the browser. Server Actions / Route Handlers only. */
export async function startSession(userId: number): Promise<void> {
  const db = await getRequestDb();
  const jar = await cookies();
  // A fresh token on every login (no session fixation); drop the old one.
  deleteSession(db, jar.get(SESSION_COOKIE)?.value);
  const { token, expiresAt } = createSession(db, userId);
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true, // page JavaScript can't read it (limits XSS damage)
          secure: process.env.NODE_ENV === "production", // HTTPS only once deployed
    sameSite: "lax", // not sent on cross-site POSTs (CSRF)
    path: "/",
    expires: expiresAt,
  });
}

/** Log out: delete the session row and the cookie. Server Actions / Route Handlers only. */
export async function endSession(): Promise<void> {
  const jar = await cookies();
  deleteSession(await getRequestDb(), jar.get(SESSION_COOKIE)?.value);
  jar.delete(SESSION_COOKIE);
}

/**
 * Where to go after logging in. Only same-site paths are allowed, so a link
 * like /login?next=https://evil.example can't bounce users off the site.
 */
export function safeNextPath(value: unknown): string {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  if (/[\u0000-\u001f\u007f]/.test(value)) return "/";
  return value;
}
