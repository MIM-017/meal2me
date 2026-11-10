"use server";

import { revalidatePath } from "next/cache";
import { addFavorite, DbError, getRequestDb, removeFavorite } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export type SetFavoriteResult =
  | { ok: true; favorited: boolean }
  | { ok: false; error: "login" | "invalid" };

/**
 * Star (favorited = true) or un-star (false) a recipe for the logged-in user.
 * Takes the wanted state instead of "toggle", so a double-click or a retry
 * can't flip it the wrong way.
 *
 * Server actions can be called by anyone with any input, so the session and
 * both arguments are checked here, not just in the browser.
 */
export async function setFavorite(recipeId: unknown, favorited: unknown): Promise<SetFavoriteResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "login" };
  if (typeof favorited !== "boolean") return { ok: false, error: "invalid" };

  try {
    const db = await getRequestDb();
    if (favorited) addFavorite(db, user.id, recipeId);
    else removeFavorite(db, user.id, recipeId);
  } catch (error) {
    // Bad id, or the recipe was deleted.
    if (error instanceof DbError) return { ok: false, error: "invalid" };
    throw error;
  }

  // If the user is on the favorites page, it re-renders right away
  // (an un-starred meal disappears from the list).
  revalidatePath("/favorites");
  return { ok: true, favorited };
}