import type { DB } from "./client";
import { NotFoundError } from "./errors";
import { parseId } from "./validation";
import { SUMMARY_COLUMNS, toSummary, type RecipeRow, type RecipeSummary } from "./recipes";

// Every function takes the user id from the logged-in session (never from the
// request body), so a user can only ever read or change their own favorites.

/** Star a recipe. Favoriting one that's already a favorite does nothing. */
export function addFavorite(db: DB, userId: unknown, recipeId: unknown): void {
  const user = parseId(userId, "userId");
  const recipe = parseId(recipeId, "recipeId");
  db.transaction(() => {
    if (!db.prepare("SELECT 1 FROM recipes WHERE id = ?").get(recipe)) {
      throw new NotFoundError("Recipe not found");
    }
    db.prepare("INSERT OR IGNORE INTO favorites (user_id, recipe_id) VALUES (?, ?)").run(user, recipe);
  }).immediate();
}

/** Un-star a recipe. Removing one that isn't a favorite does nothing. */
export function removeFavorite(db: DB, userId: unknown, recipeId: unknown): void {
  db.prepare("DELETE FROM favorites WHERE user_id = ? AND recipe_id = ?").run(
    parseId(userId, "userId"),
    parseId(recipeId, "recipeId"),
  );
}

export function isFavorite(db: DB, userId: unknown, recipeId: unknown): boolean {
  return !!db
    .prepare("SELECT 1 FROM favorites WHERE user_id = ? AND recipe_id = ?")
    .get(parseId(userId, "userId"), parseId(recipeId, "recipeId"));
}

/** Ids of every recipe this user has favorited, for marking stars on a list. */
export function getFavoriteIds(db: DB, userId: unknown): Set<number> {
  const ids = db
    .prepare("SELECT recipe_id FROM favorites WHERE user_id = ?")
    .pluck()
    .all(parseId(userId, "userId")) as number[];
  return new Set(ids);
}

/** This user's favorite recipes, most recently favorited first. */
export function listFavorites(db: DB, userId: unknown): RecipeSummary[] {
  const rows = db
    .prepare(
      `SELECT ${SUMMARY_COLUMNS}
       FROM favorites f
       JOIN recipes r ON r.id = f.recipe_id
       JOIN users u   ON u.id = r.author_id
       WHERE f.user_id = ?
       ORDER BY f.created_at DESC, r.id DESC`,
    )
    .all(parseId(userId, "userId")) as RecipeRow[];
  return rows.map(toSummary);
}