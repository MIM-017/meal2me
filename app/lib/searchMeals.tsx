'use server'

// Relative import (like app/meals/page.tsx does) so vitest can load this file.
import { getRequestDb, searchRecipes, getFavoriteIds, LIMITS, SearchResult, type DB } from "../../lib/db";
import { getCurrentUser } from "../../lib/auth";

export type MealSearchResult = {
    id: number;
    name: string;
    author: string;
    imageUrl: string | null; // e.g. /images/oatmeal.jpg, or null = no picture
    favorited: boolean | null; // null = not logged in, so no star is shown
};
export type MealSearchResponse = {
    items: MealSearchResult[]; // at most LIMITS.pageSize (50)
    total: number;             // how many recipes matched in all
};

/**
 * Search recipes by NAME only. Called from the home page search bar.
 *
 * Returns [] (no recipes) when the query is missing, empty, only spaces,
 * or not text at all. Server actions can be called by anyone with any
 * input, so the query is checked here, not just in the browser.
 */
export async function searchMeals(query: unknown): Promise<MealSearchResponse> {
    if (typeof query !== "string") {
         return { items: [], total: 0 };
    }

    // Trim spaces, and cap the length so a huge query can't throw a ValidationError.
    const q = query.trim().slice(0, LIMITS.queryLength);
    if (q === "") {
         return { items: [], total: 0 };
    }

    const db = await getRequestDb();
    const results = searchRecipes(db, { q, field: "name", pageSize: LIMITS.pageSize });
    return toResponse(db, results);
}

export async function getAllMeals(): Promise<MealSearchResponse> {
    const db = await getRequestDb();
    const results = searchRecipes(db);
    return toResponse(db, results);
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
            favorited: favorites ? favorites.has(recipe.id) : null,
        })),
        total: results.total,
    };
}