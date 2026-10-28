'use server'

import {
    getRequestDb,
    createRecipe,
    createUser,
    getUserByUsername,
    NotFoundError,
    DbError,
    DIFFICULTIES,
    LIMITS,
    type User,
} from "@/lib/db";
import { redirect } from "next/navigation";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export type AddMealState = { error: string } | null;

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function imageExtension(b: Buffer): "jpg" | "png" | "webp" | null {
    if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
    if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
    if (b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP") return "webp";
    return null;
}

/** Saves an uploaded photo. Returns its public path, null if none chosen, or { error }. */
async function saveImage(file: FormDataEntryValue | null): Promise<string | null | { error: string }> {
    if (!(file instanceof File) || file.size === 0) return null;
    if (file.size > MAX_IMAGE_BYTES) return { error: "Image must be 5 MB or smaller" };

    const bytes = Buffer.from(await file.arrayBuffer());
    const ext = imageExtension(bytes);
    if (!ext) return { error: "Image must be a JPG, PNG, or WebP file" };

    const dir = path.join(process.cwd(), "public", "images", "uploads");
    await mkdir(dir, { recursive: true });
    const filename = `${randomUUID()}.${ext}`; // never use the uploader's filename
    await writeFile(path.join(dir, filename), bytes);
    return `/images/uploads/${filename}`;
}

/** A number field: empty or non-numeric is an error, but 0 is allowed. */
function numberField(formData: FormData, key: string, label: string): number | { error: string } {
    const raw = formData.get(key)?.toString().trim() ?? "";
    const n = Number(raw);
    if (raw === "" || Number.isNaN(n) || n < 0) return { error: `${label} must be a number, 0 or higher` };
    return n;
}
/**
 * Ingredients textarea -> list, one ingredient per line.
 * Blank lines are dropped, and a leading "-", "*" or "•" bullet is removed.
 */
function ingredientsField(formData: FormData): string[] | { error: string } {
    const raw = formData.get("ingredients")?.toString() ?? "";
    const items = raw
        .split(/\r\n|\r|\n/)
        .map((line) => line.replace(/\t/g, " ").replace(/^\s*[-*•]\s*/, "").trim())
        .filter((line) => line !== "");

    if (items.length === 0) return { error: "Add at least one ingredient" };
    if (items.length > LIMITS.ingredientCount) {
        return { error: `A recipe can have at most ${LIMITS.ingredientCount} ingredients` };
    }
    const tooLong = items.find((item) => Array.from(item).length > LIMITS.ingredientLength);
    if (tooLong) {
        return { error: `Each ingredient must be at most ${LIMITS.ingredientLength} characters` };
    }
    return items;
}

/** Instructions textarea. Line breaks are kept; each line is shown as one step. */
function instructionsField(formData: FormData): string | { error: string } {
    const text = (formData.get("instructions")?.toString() ?? "").replace(/\r\n?/g, "\n").trim();
    if (text === "") return { error: "Instructions not specified" };
    if (Array.from(text).length > LIMITS.notesLength) {
        return { error: `Instructions must be at most ${LIMITS.notesLength} characters` };
    }
    return text;
}
export async function addMealSystem(
    _prev: AddMealState,
    formData: FormData,
): Promise<AddMealState> {
    const db = await getRequestDb();

    let user: User;
    try {
        user = getUserByUsername(db, "system");
    } catch (error) {
        if (error instanceof NotFoundError) {
            user = createUser(db, "system");
        } else {
            throw error;
        }
    }

    const name = formData.get("name")?.toString().trim();
    if (!name) return { error: "Meal name not specified" };

    const difficulty = formData.get("difficulty")?.toString();
    if (!difficulty || !(DIFFICULTIES as readonly string[]).includes(difficulty)) {
        return { error: "Incorrect meal difficulty value" };
    }

    const cookTime = numberField(formData, "cookTime", "Cook time");
    const cost = numberField(formData, "cost", "Cost");
    const proteins = numberField(formData, "proteins", "Proteins");
    const calories = numberField(formData, "calories", "Calories");
    const carbs = numberField(formData, "carbs", "Carbs");
    for (const v of [cookTime, cost, proteins, calories, carbs]) {
        if (typeof v === "object") return v;
    }
    const ingredients = ingredientsField(formData);
    if (!Array.isArray(ingredients)) return ingredients;

    const instructions = instructionsField(formData);
    if (typeof instructions === "object") return instructions;
    const image = await saveImage(formData.get("image"));
    if (image !== null && typeof image === "object") return image;
    const imageUrl = image;

    const recipe = {
        name,
        cookTime,
        difficulty,
        cost,
        macros: { protein: proteins, carbs, calories },
        ingredients,
        notes: instructions, // stored in the recipes.notes column
        imageUrl,
    };

    try {
        createRecipe(db, user.id, recipe);
    } catch (error) {
        // Don't leave an orphan photo behind if the save failed.
        if (imageUrl) {
            await unlink(path.join(process.cwd(), "public", imageUrl)).catch(() => {});
        }
        if (error instanceof DbError) return { error: error.message };
        throw error;
    }

    redirect("/meals"); // must stay outside the try/catch
}