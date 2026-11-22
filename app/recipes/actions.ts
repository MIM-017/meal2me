"use server"

import { getCurrentUser } from "@/lib/auth"
import { deleteRecipe, ForbiddenError, getRecipe, getRequestDb, NotFoundError, ValidationError } from "@/lib/db";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";

export type DeleteMealResult =
    { ok: true } |
    { ok: false; error: "login" | "invalid" | "ownership" | "not_found"}

export async function deleteMeal(recipeId: unknown, imageUrl: unknown): Promise<DeleteMealResult> {

    const user  = await getCurrentUser();
    const db = await getRequestDb();
    if (!user) return { ok: false, error: "login" };

    try {
        const meal = getRecipe(db, recipeId);
        deleteRecipe(db, recipeId, meal.author.id);

        if (typeof imageUrl === "string") await unlink(path.join(process.cwd(), "public", imageUrl)).catch(() => {});
    }
    catch (error) {
        if (error instanceof ForbiddenError) {
            return { ok: false, error: "ownership"}
        }

        if (error instanceof NotFoundError) {
            return { ok: false, error: "not_found" };
        }

        if (error instanceof ValidationError) {
            return { ok: false, error: "invalid" };
        }

        throw error;
    }

    revalidatePath("/");
    revalidatePath("/meals");
    revalidatePath("/favorites");
    revalidatePath("/filters");
    return { ok: true };
}