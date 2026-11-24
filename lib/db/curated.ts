import curatedRecipes from "../../data/recipes.json";
import type { DB } from "./client";
import { createRecipe } from "./recipes";
import { parseRecipeInput } from "./validation";

const CURATED_USERNAME = "meal2me-curated";
const CURATED_EMAIL = "curated-recipes@meal2me.invalid";
const seededConnections = new WeakSet<DB>();

/** Validate the shipped recipe catalog, then seed any missing recipes once per database connection. */
export function ensureCuratedRecipes(db: DB): void {
  if (seededConnections.has(db)) return;

  const prepared = curatedRecipes.map((recipe, index) => {
    try {
      parseRecipeInput(recipe);
      return recipe;
    } catch (error) {
      throw new Error(`Curated recipe ${index + 1} is invalid: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  db.transaction(() => {
    let author = db.prepare("SELECT id FROM users WHERE username = ?").get(CURATED_USERNAME) as { id: number } | undefined;
    if (!author) {
      author = db.prepare("INSERT INTO users (username, email) VALUES (?, ?) RETURNING id")
        .get(CURATED_USERNAME, CURATED_EMAIL) as { id: number };
    }

    const exists = db.prepare("SELECT id, notes, difficulty FROM recipes WHERE author_id = ? AND name = ?");
    const refresh = db.prepare(`
      UPDATE recipes
      SET notes = ?, difficulty = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id = ?
    `);
    for (const recipe of prepared) {
      const current = exists.get(author.id, recipe.name) as { id: number; notes: string | null; difficulty: string } | undefined;
      if (current) {
        // Refresh curated directions and ratings while leaving nutrition fields
        // untouched so the owner can maintain macros directly in SQLite.
        if (current.notes !== (recipe.notes ?? null) || current.difficulty !== recipe.difficulty) {
          refresh.run(recipe.notes ?? null, recipe.difficulty, current.id);
        }
        continue;
      }
      createRecipe(db, author.id, recipe);
    }
  }).immediate();

  seededConnections.add(db);
}
