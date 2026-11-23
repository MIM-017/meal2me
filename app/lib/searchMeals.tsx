'use server'

// Relative import (like app/meals/page.tsx does) so vitest can load this file.
import { getRequestDb, searchRecipes, getFavoriteIds, LIMITS, SearchResult, SUMMARY_COLUMNS, toSummary, type DB, type RecipeRow } from "../../lib/db";
import { getCurrentUser } from "../../lib/auth";

export type MealSearchResult = {
    id: number;
    name: string;
    author: string;
    imageUrl: string | null; // e.g. /images/oatmeal.jpg, or null = no picture
    cookTime: number;        // minutes
    difficulty: "easy" | "medium" | "hard";
    cost: number;            // dollars, whole recipe
    favorited: boolean | null; // null = not logged in, so no star is shown
};
export type MealSearchResponse = {
    items: MealSearchResult[]; // 12 random meals for the initial home view; 20 per search page
    total: number;             // how many recipes matched in all
    page: number;
    totalPages: number;
};

const HOME_PAGE_SIZE = 20;
const INITIAL_HOME_MEALS = 12;

/**
 * Search recipes by NAME across system-curated and user-created recipes.
 *
 * Returns [] (no recipes) when the query is missing, empty, only spaces,
 * or not text at all. Server actions can be called by anyone with any
 * input, so the query is checked here, not just in the browser.
 */
export async function searchMeals(query: unknown, page: unknown = 1): Promise<MealSearchResponse> {
    if (typeof query !== "string") {
         return { items: [], total: 0, page: 1, totalPages: 0 };
    }

    // Trim spaces, and cap the length so a huge query can't throw a ValidationError.
    const q = query.trim().slice(0, LIMITS.queryLength);
    if (q === "") {
         return { items: [], total: 0, page: 1, totalPages: 0 };
    }

    const db = await getRequestDb();
    const safePage = typeof page === "number" && Number.isInteger(page) && page > 0 ? Math.min(page, 10000) : 1;
    const results = searchRecipes(db, { q, field: "name", page: safePage, pageSize: HOME_PAGE_SIZE });
    return toResponse(db, results);
}

export async function getRandomMeals(): Promise<MealSearchResponse> {
    const db = await getRequestDb();
    const items = db.prepare(`
      SELECT ${SUMMARY_COLUMNS}
      FROM recipes r JOIN users u ON u.id = r.author_id
      WHERE u.username = ?
      ORDER BY RANDOM()
      LIMIT ?
    `).all("meal2me-curated", INITIAL_HOME_MEALS) as RecipeRow[];
    const total = (db.prepare("SELECT COUNT(*) AS total FROM recipes r JOIN users u ON u.id = r.author_id WHERE u.username = ?")
      .get("meal2me-curated") as { total: number }).total;
    return toResponse(db, { items: items.map(toSummary), total, page: 1, pageSize: INITIAL_HOME_MEALS, totalPages: 1 });
}

export async function getRandomMealId(): Promise<number | null> {
    const db = await getRequestDb();
    const row = db.prepare(
        "SELECT r.id FROM recipes r JOIN users u ON u.id = r.author_id WHERE u.username = ? ORDER BY RANDOM() LIMIT 1",
    ).get("meal2me-curated") as { id: number } | undefined;
    return row?.id ?? null;
}

// Only send what the search bar shows. Recipes from different authors can
// share a name, so the id (unique) is the React key and the author tells them apart.
async function toResponse(db: DB, results: SearchResult): Promise<MealSearchResponse> {
    const user = await getCurrentUser();
    const favorites = user ? getFavoriteIds(db, user.id) : null;

    return {
        items: results.items.map((recipe) => ({
            id: recipe.id,
            name: recipe.name,
            author: recipe.author.username,
            imageUrl: recipe.imageUrl,
            cookTime: recipe.cookTime,
            difficulty: recipe.difficulty,
            cost: recipe.cost,
            favorited: favorites ? favorites.has(recipe.id) : null,
        })),
        total: results.total,
        page: results.page,
        totalPages: results.totalPages,
    };
}