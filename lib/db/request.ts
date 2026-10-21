import { connection } from "next/server";
import { getDb, type DB } from "./client";

/**
 * Use this, not getDb(), in route handlers, server actions and server components.
 *
 * This project has `cacheComponents: true` in next.config.ts. With that on,
 * Next.js prerenders every route at build time unless the route does something
 * that marks it as request-time. better-sqlite3 is synchronous, so a plain
 * database read does NOT mark it: the query runs once during `next build` and
 * its result is frozen into the page or API response until the next deploy.
 *
 * `await connection()` tells Next.js "this needs a live request", so the query
 * runs fresh every time. In a server component, also wrap the part of the
 * page that reads the database in <Suspense>.
 */
export async function getRequestDb(): Promise<DB> {
  await connection();
  return getDb();
}
