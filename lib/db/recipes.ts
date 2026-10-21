import type { DB } from "./client";
import { ConflictError, ForbiddenError, NotFoundError } from "./errors";
import {
  DIFFICULTIES,
  parseId,
  parseRecipeInput,
  parseSearchOptions,
  type Difficulty,
  type Macros,
  type RecipeInput,
  type SearchField,
  type SearchInput,
  type Sort,
} from "./validation";

// ---------------------------------------------------------------------------
// Shapes returned to the rest of the app (camelCase, JSON-ready)
// ---------------------------------------------------------------------------

export interface Author {
  id: number;
  username: string;
}

/** What search/list results contain: enough for a card on a results page. */
export interface RecipeSummary {
  id: number;
  name: string;
  author: Author;
  cookTime: number; // minutes
  difficulty: Difficulty;
  cost: number; // dollars, whole recipe
  macros: Macros | null;
  createdAt: string;
  updatedAt: string;
}

/** A full recipe, for the recipe's own page. */
export interface Recipe extends RecipeSummary {
  ingredients: string[];
  notes: string | null;
}

export interface SearchResult {
  items: RecipeSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Row mapping
// ---------------------------------------------------------------------------

interface RecipeRow {
  id: number;
  name: string;
  notes?: string | null; // only selected for a single recipe
  cook_time_minutes: number;
  difficulty: Difficulty;
  cost_cents: number;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  created_at: string;
  updated_at: string;
  author_id: number;
  author_username: string;
}

const SUMMARY_COLUMNS = `
  r.id, r.name, r.cook_time_minutes, r.difficulty, r.cost_cents,
  r.calories, r.protein_g, r.carbs_g, r.created_at, r.updated_at,
  u.id AS author_id, u.username AS author_username`;

function toSummary(row: RecipeRow): RecipeSummary {
  const hasMacros = row.calories !== null || row.protein_g !== null || row.carbs_g !== null;
  return {
    id: row.id,
    name: row.name,
    author: { id: row.author_id, username: row.author_username },
    cookTime: row.cook_time_minutes,
    difficulty: row.difficulty,
    cost: row.cost_cents / 100,
    macros: hasMacros
      ? { calories: row.calories, protein: row.protein_g, carbs: row.carbs_g }
      : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers (run inside a caller's transaction)
// ---------------------------------------------------------------------------

function insertIngredients(db: DB, recipeId: number, ingredients: string[]) {
  const insert = db.prepare(
    "INSERT INTO recipe_ingredients (recipe_id, position, ingredient) VALUES (?, ?, ?)",
  );
  ingredients.forEach((ingredient, position) => insert.run(recipeId, position, ingredient));
}

function assertNameFree(db: DB, authorId: number, name: string, exceptRecipeId: number | null) {
  const clash = db
    .prepare("SELECT 1 FROM recipes WHERE author_id = ? AND name = ? AND id IS NOT ?")
    .get(authorId, name, exceptRecipeId);
  if (clash) throw new ConflictError(`You already have a recipe named "${name}"`);
}

/** Load a recipe's author and check the actor owns it. */
function assertOwner(db: DB, recipeId: number, actorId: number) {
  const row = db.prepare("SELECT author_id FROM recipes WHERE id = ?").get(recipeId) as
    | { author_id: number }
    | undefined;
  if (!row) throw new NotFoundError("Recipe not found");
  if (row.author_id !== actorId) throw new ForbiddenError("Only the author can change this recipe");
}

/** Values shared by INSERT and UPDATE. */
function recipeParams(input: RecipeInput) {
  return {
    name: input.name,
    notes: input.notes,
    cook_time_minutes: input.cookTime,
    difficulty: input.difficulty,
    cost_cents: input.costCents,
    calories: input.macros?.calories ?? null,
    protein_g: input.macros?.protein ?? null,
    carbs_g: input.macros?.carbs ?? null,
  };
}

/**
 * Build a full-text MATCH expression from what the user typed. User text is
 * never passed to MATCH directly: FTS5 has its own query syntax, so input
 * like `"` or `AND (` would otherwise cause syntax errors or odd results.
 *
 * Each word becomes a quoted prefix search ("garl" matches "garlic"), and
 * all words must appear (implicit AND), in any of the searched columns.
 * Returns null if the text contains no searchable words.
 */
function buildMatchExpression(q: string, field: SearchField): string | null {
  const words = q.normalize("NFKC").match(/[\p{L}\p{N}]+/gu)?.slice(0, 10) ?? [];
  if (words.length === 0) return null;
  // Words contain only letters and digits, so they can't contain a `"`.
  const expr = words.map((w) => `"${w}"*`).join(" ");
  // `field` is one of a fixed set of column names, checked by validation.
  return field === "all" ? expr : `${field} : (${expr})`;
}

const ORDER_BY: Record<Exclude<Sort, "relevance">, string> = {
  newest: "r.created_at DESC, r.id DESC",
  name: "r.name COLLATE NOCASE ASC, r.id ASC",
  cookTime: "r.cook_time_minutes ASC, r.id ASC",
  cost: "r.cost_cents ASC, r.id ASC",
  calories: "r.calories IS NULL, r.calories ASC, r.id ASC", // unknown calories last
};

// ---------------------------------------------------------------------------
// Public API
//
// Every function validates its own input, so it's safe to pass request data
// straight in. Writes that change an existing recipe take an `actorId` (the
// logged-in user's id from your auth session) and refuse unless that user is
// the author.
// ---------------------------------------------------------------------------

export function getRecipe(db: DB, id: unknown): Recipe {
  const recipeId = parseId(id);
  return db.transaction(() => {
    const row = db
      .prepare(`SELECT ${SUMMARY_COLUMNS}, r.notes FROM recipes r JOIN users u ON u.id = r.author_id WHERE r.id = ?`)
      .get(recipeId) as RecipeRow | undefined;
    if (!row) throw new NotFoundError("Recipe not found");
    const ingredients = db
      .prepare("SELECT ingredient FROM recipe_ingredients WHERE recipe_id = ? ORDER BY position")
      .pluck()
      .all(recipeId) as string[];
    return { ...toSummary(row), ingredients, notes: row.notes ?? null };
  }).deferred();
}

export function createRecipe(db: DB, authorId: unknown, data: unknown): Recipe {
  const author = parseId(authorId, "authorId");
  const input = parseRecipeInput(data);

  const id = db.transaction(() => {
    if (!db.prepare("SELECT 1 FROM users WHERE id = ?").get(author)) {
      throw new NotFoundError("Author not found");
    }
    assertNameFree(db, author, input.name, null);
    const { id } = db
      .prepare(
        `INSERT INTO recipes
           (author_id, name, notes, cook_time_minutes, difficulty, cost_cents, calories, protein_g, carbs_g)
         VALUES
           (@author_id, @name, @notes, @cook_time_minutes, @difficulty, @cost_cents, @calories, @protein_g, @carbs_g)
         RETURNING id`,
      )
      .get({
        author_id: author,
        ...recipeParams(input),
      }) as { id: number };
    insertIngredients(db, id, input.ingredients);
    return id;
  }).immediate();

  return getRecipe(db, id);
}

/** Replace every field of a recipe (PUT semantics). Only the author may do this. */
export function updateRecipe(db: DB, id: unknown, actorId: unknown, data: unknown): Recipe {
  const recipeId = parseId(id);
  const actor = parseId(actorId, "actorId");
  const input = parseRecipeInput(data);

  db.transaction(() => {
    assertOwner(db, recipeId, actor);
    assertNameFree(db, actor, input.name, recipeId);
    db.prepare(
      `UPDATE recipes SET
         name = @name, notes = @notes, cook_time_minutes = @cook_time_minutes,
         difficulty = @difficulty, cost_cents = @cost_cents, calories = @calories, protein_g = @protein_g,
         carbs_g = @carbs_g, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = @id`,
    ).run({
      id: recipeId,
      ...recipeParams(input),
    });
    db.prepare("DELETE FROM recipe_ingredients WHERE recipe_id = ?").run(recipeId);
    insertIngredients(db, recipeId, input.ingredients);
  }).immediate();

  return getRecipe(db, recipeId);
}

/** Delete a recipe and its ingredients. Only the author may do this. */
export function deleteRecipe(db: DB, id: unknown, actorId: unknown): void {
  const recipeId = parseId(id);
  const actor = parseId(actorId, "actorId");
  db.transaction(() => {
    assertOwner(db, recipeId, actor);
    db.prepare("DELETE FROM recipes WHERE id = ?").run(recipeId);
  }).immediate();
}

/**
 * Search and/or filter recipes, one page at a time.
 *
 *   searchRecipes(db, { q: "garlic chicken" })            name OR ingredients
 *   searchRecipes(db, { q: "pancakes", field: "name" })   name only
 *   searchRecipes(db, { q: "egg", field: "ingredients" }) ingredients only
 *   searchRecipes(db, { difficulty: "easy", maxCookTime: 30, sort: "cookTime" })
 *   searchRecipes(db, { maxCalories: 600, maxCost: 10, maxDifficulty: "medium" })
 *   searchRecipes(db, { author: "garf" })                 one author's recipes
 */
export function searchRecipes(db: DB, options: SearchInput = {}): SearchResult {
  const opts = parseSearchOptions(options);
  const empty: SearchResult = {
    items: [],
    total: 0,
    page: opts.page,
    pageSize: opts.pageSize,
    totalPages: 0,
  };

  const where: string[] = [];
  const params: unknown[] = [];
  let from = "recipes r JOIN users u ON u.id = r.author_id";

  let match: string | null = null;
  if (opts.q) {
    match = buildMatchExpression(opts.q, opts.field);
    if (match === null) return empty; // e.g. q = "!!!": nothing searchable
    from = "recipe_search s JOIN recipes r ON r.id = s.rowid JOIN users u ON u.id = r.author_id";
    where.push("recipe_search MATCH ?");
    params.push(match);
  }
  if (opts.difficulty) {
    where.push("r.difficulty = ?");
    params.push(opts.difficulty);
  }
  if (opts.maxDifficulty) {
    // "At most medium" = easy or medium. DIFFICULTIES is ordered easiest first.
    const allowed = DIFFICULTIES.slice(0, DIFFICULTIES.indexOf(opts.maxDifficulty) + 1);
    where.push(`r.difficulty IN (${allowed.map(() => "?").join(", ")})`);
    params.push(...allowed);
  }
  if (opts.maxCalories !== null) {
    // Recipes with no calories entered are excluded: we can't say they fit.
    where.push("r.calories <= ?");
    params.push(opts.maxCalories);
  }
  if (opts.maxCostCents !== null) {
    where.push("r.cost_cents <= ?");
    params.push(opts.maxCostCents);
  }
  if (opts.maxCookTime !== null) {
    where.push("r.cook_time_minutes <= ?");
    params.push(opts.maxCookTime);
  }
  if (opts.author) {
    where.push("u.username = ?"); // case-insensitive via the column's NOCASE
    params.push(opts.author);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const orderSql =
    opts.sort === "relevance"
      ? match
        ? // bm25: lower is better. A hit in the name counts 5x a hit in ingredients.
          "bm25(recipe_search, 5.0, 1.0) ASC, r.id DESC"
        : ORDER_BY.newest
      : ORDER_BY[opts.sort];

  // One read transaction so the count and the page come from the same snapshot.
  return db.transaction((): SearchResult => {
    const total = db.prepare(`SELECT COUNT(*) FROM ${from} ${whereSql}`).pluck().get(...params) as number;
    if (total === 0) return empty;
    const rows = db
      .prepare(`SELECT ${SUMMARY_COLUMNS} FROM ${from} ${whereSql} ORDER BY ${orderSql} LIMIT ? OFFSET ?`)
      .all(...params, opts.pageSize, (opts.page - 1) * opts.pageSize) as RecipeRow[];
    return {
      items: rows.map(toSummary),
      total,
      page: opts.page,
      pageSize: opts.pageSize,
      totalPages: Math.ceil(total / opts.pageSize),
    };
  }).deferred();
}
