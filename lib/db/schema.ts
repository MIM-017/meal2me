/**
 * Database schema, written as an ordered list of migrations.
 *
 * Rules:
 *  - Never edit a migration that has already run on a real database.
 *    To change the schema, append a new entry with the next version number.
 *  - The schema lives in TypeScript instead of a .sql file so that it is
 *    always bundled with the server code. Next.js output tracing (used by
 *    `output: "standalone"` and most hosts) does not copy loose .sql files.
 */

export interface Migration {
  version: number;
  sql: string;
}

// ISO-8601 UTC timestamp with milliseconds, e.g. 2026-10-20T23:01:00.123Z.
// JavaScript's `new Date(value)` parses this format directly.
const NOW = `(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    sql: `
      -- Authors. Holds only what the recipe data needs. Login details
      -- (password hashes, OAuth ids) belong to the auth system.
      CREATE TABLE users (
        id         INTEGER PRIMARY KEY,
        username   TEXT    NOT NULL UNIQUE COLLATE NOCASE
                   CHECK (length(username) BETWEEN 3 AND 30
                          AND username NOT GLOB '*[^A-Za-z0-9_.-]*'),
        created_at TEXT    NOT NULL DEFAULT ${NOW}
      ) STRICT;

      CREATE TABLE recipes (
        -- AUTOINCREMENT guarantees an id is never reused after a delete, so an
        -- old link like /recipes/42 can never point at a different recipe.
        id                INTEGER PRIMARY KEY AUTOINCREMENT,

        -- RESTRICT: a user who still has recipes cannot be deleted by accident.
        author_id         INTEGER NOT NULL REFERENCES users (id) ON DELETE RESTRICT,

        name              TEXT    NOT NULL COLLATE NOCASE
                          CHECK (name = trim(name) AND length(name) BETWEEN 1 AND 200),

        -- Free-form instructions / notes. NULL when the author left it blank.
        notes             TEXT
                          CHECK (notes IS NULL OR (length(trim(notes)) > 0 AND length(notes) <= 20000)),

        cook_time_minutes INTEGER NOT NULL CHECK (cook_time_minutes BETWEEN 1 AND 10080),
        difficulty        TEXT    NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),

        -- Cost of the whole recipe, in cents. Whole cents avoid floating-point
        -- rounding errors with money (0.1 + 0.2 != 0.3). Max $10,000.
        cost_cents        INTEGER NOT NULL CHECK (cost_cents BETWEEN 0 AND 1000000),

        -- Optional macros for the WHOLE recipe. Each one may be NULL on its own.
        calories          INTEGER CHECK (calories  BETWEEN 0 AND 100000),
        protein_g         REAL    CHECK (protein_g BETWEEN 0 AND 10000),
        carbs_g           REAL    CHECK (carbs_g   BETWEEN 0 AND 10000),

        created_at        TEXT    NOT NULL DEFAULT ${NOW},
        updated_at        TEXT    NOT NULL DEFAULT ${NOW},

        -- One author can't have two recipes with the same name;
        -- different authors can.
        UNIQUE (author_id, name)
      ) STRICT;

      -- Ingredient list: one row per plain-text ingredient, kept in order.
      CREATE TABLE recipe_ingredients (
        recipe_id  INTEGER NOT NULL REFERENCES recipes (id) ON DELETE CASCADE,
        position   INTEGER NOT NULL CHECK (position >= 0),
        ingredient TEXT    NOT NULL
                   CHECK (ingredient = trim(ingredient) AND length(ingredient) BETWEEN 1 AND 500),
        PRIMARY KEY (recipe_id, position)
      ) STRICT;

      CREATE INDEX idx_recipes_difficulty_cook_time ON recipes (difficulty, cook_time_minutes);
      CREATE INDEX idx_recipes_created_at          ON recipes (created_at);
      -- (author_id lookups use the UNIQUE (author_id, name) index.)

      -- Full-text search index over recipe names and ingredients.
      -- rowid = recipes.id. remove_diacritics 2 lets "creme" match "Crème".
      CREATE VIRTUAL TABLE recipe_search USING fts5 (
        name,
        ingredients,
        tokenize = 'unicode61 remove_diacritics 2'
      );

      -- Triggers keep the search index in sync automatically, including for
      -- any write that doesn't go through the TypeScript code.
      CREATE TRIGGER recipes_ai AFTER INSERT ON recipes BEGIN
        INSERT INTO recipe_search (rowid, name, ingredients) VALUES (new.id, new.name, '');
      END;

      CREATE TRIGGER recipes_au_name AFTER UPDATE OF name ON recipes BEGIN
        UPDATE recipe_search SET name = new.name WHERE rowid = new.id;
      END;

      CREATE TRIGGER recipes_ad AFTER DELETE ON recipes BEGIN
        DELETE FROM recipe_search WHERE rowid = old.id;
      END;

      CREATE TRIGGER recipe_ingredients_ai AFTER INSERT ON recipe_ingredients BEGIN
        UPDATE recipe_search
        SET ingredients = (SELECT group_concat(ingredient, char(10))
                           FROM recipe_ingredients WHERE recipe_id = new.recipe_id)
        WHERE rowid = new.recipe_id;
      END;

      CREATE TRIGGER recipe_ingredients_au AFTER UPDATE ON recipe_ingredients BEGIN
        UPDATE recipe_search
        SET ingredients = coalesce((SELECT group_concat(ingredient, char(10))
                                    FROM recipe_ingredients WHERE recipe_id = old.recipe_id), '')
        WHERE rowid = old.recipe_id;
        UPDATE recipe_search
        SET ingredients = (SELECT group_concat(ingredient, char(10))
                           FROM recipe_ingredients WHERE recipe_id = new.recipe_id)
        WHERE rowid = new.recipe_id;
      END;

      CREATE TRIGGER recipe_ingredients_ad AFTER DELETE ON recipe_ingredients BEGIN
        UPDATE recipe_search
        SET ingredients = coalesce((SELECT group_concat(ingredient, char(10))
                                    FROM recipe_ingredients WHERE recipe_id = old.recipe_id), '')
        WHERE rowid = old.recipe_id;
      END;
    `,
  },
];

export const LATEST_SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;
