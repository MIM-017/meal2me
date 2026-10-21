import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { LATEST_SCHEMA_VERSION, MIGRATIONS } from "./schema";

export type DB = Database.Database;

/**
 * Open a database file, configure it, and bring its schema up to date.
 * Use ":memory:" for a throwaway database (tests).
 */
export function openDatabase(filename: string): DB {
  if (filename !== ":memory:") {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
  }
  // timeout: wait up to 5 s for another writer's lock instead of failing.
  const db = new Database(filename, { timeout: 5000 });
  try {
    db.pragma("journal_mode = WAL"); // readers don't block the writer
    db.pragma("synchronous = NORMAL"); // safe with WAL, much faster writes
    db.pragma("foreign_keys = ON"); // off by default in SQLite
    migrate(db);
  } catch (err) {
    db.close();
    throw err;
  }
  return db;
}

/** Apply any migrations this database hasn't run yet. Safe to call repeatedly. */
export function migrate(db: DB): void {
  const current = () => db.pragma("user_version", { simple: true }) as number;

  if (current() > LATEST_SCHEMA_VERSION) {
    throw new Error(
      `Database schema is version ${current()} but this code only knows up to ` +
        `${LATEST_SCHEMA_VERSION}. Deploy the newer code, or restore a backup.`,
    );
  }

  for (const migration of MIGRATIONS) {
    // .immediate() takes the write lock first, then re-checks the version, so
    // two processes starting at the same moment can't both run a migration.
    db.transaction(() => {
      if (current() >= migration.version) return;
      db.exec(migration.sql);
      // `version` is a constant from schema.ts, never user input.
      db.pragma(`user_version = ${migration.version}`);
    }).immediate();
  }
}

// ---------------------------------------------------------------------------
// Shared connection for the Next.js server.
//
// better-sqlite3 is synchronous and is designed for one long-lived connection
// per process, so there's no connection pool. The connection is cached on
// globalThis because `next dev` re-runs modules on every hot reload, which
// would otherwise open a new connection (and leak the old one) on every edit.
// ---------------------------------------------------------------------------

const globalForDb = globalThis as typeof globalThis & { __recipeDb?: DB };

export function getDb(): DB {
  if (!globalForDb.__recipeDb) {
    const file =
      process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "recipes.db");
    globalForDb.__recipeDb = openDatabase(file);
  }
  return globalForDb.__recipeDb;
}
