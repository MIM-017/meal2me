'use server'

// Relative import (like app/meals/page.tsx does) so vitest can load this file.
import { getRequestDb, searchRecipes, LIMITS } from "../../lib/db";

export type MealSearchResult = {
    id: number;
    name: string;
    author: string;
};

export type MealSearchResponse = {
    items: MealSearchResult[]; // at most LIMITS.pageSize (50)
    total: number;             // how many recipes matched in all
};

/**
 * Search recipes by NAME only. Called from the home page search bar on every
 * (debounced) keystroke. Each word matches the start of a word in the name,
 * so "c" finds "Carrot Cake" and "Garlic Butter Chicken", "ch" narrows it.
 *
 * Returns no recipes when the query is missing, empty, only spaces, or not
 * text at all. Server actions can be called by anyone with any input, so the
 * query is checked here, not just in the browser.
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

    // Only send what the search bar shows. Recipes from different authors can
    // share a name, so the id (unique) is the React key and the author tells them apart.
    return {
        items: results.items.map((recipe) => ({
            id: recipe.id,
            name: recipe.name,
            author: recipe.author.username,
        })),
        total: results.total,
    };
}