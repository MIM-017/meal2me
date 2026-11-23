#!/usr/bin/env node
// Fetch a local review draft from TheMealDB's official V1 API. This script
// does not connect to or modify the Meal2Me database.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "data", "themealdb-draft.json");
const limit = Math.max(1, Math.min(500, Number(process.argv[2] ?? 150)));
const base = "https://www.themealdb.com/api/json/v1/1";
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(url) {
  const response = await fetch(url, { headers: { "user-agent": "Meal2Me recipe review importer" } });
  if (!response.ok) throw new Error(`TheMealDB returned HTTP ${response.status} for ${url}`);
  return response.json();
}

const ids = new Map();
for (const letter of "abcdefghijklmnopqrstuvwxyz") {
  const result = await request(`${base}/search.php?f=${letter}`);
  for (const meal of result.meals ?? []) if (!ids.has(meal.idMeal)) ids.set(meal.idMeal, meal);
  await pause(250);
}

const drafts = [];
// Stable shuffle: choose a catalog-wide cross-section instead of the first
// 150 alphabetical meals every time this is run.
const candidates = [...ids.values()]
  .filter((meal) => !/\b(sauce|oil|dressing|dip|marinade|seasoning|stock|spice mix)\b/i.test(meal.strMeal))
  .sort((a, b) => createHash("sha256").update(a.idMeal).digest("hex").localeCompare(createHash("sha256").update(b.idMeal).digest("hex")));
for (const mealStub of candidates.slice(0, limit)) {
  const id = mealStub.idMeal;
  const result = await request(`${base}/lookup.php?i=${encodeURIComponent(id)}`);
  const meal = result.meals?.[0];
  if (meal) {
    const ingredients = [];
    for (let i = 1; i <= 20; i++) {
      const ingredient = meal[`strIngredient${i}`]?.trim();
      if (ingredient) ingredients.push([meal[`strMeasure${i}`]?.trim(), ingredient].filter(Boolean).join(" "));
    }
    drafts.push({
      apiId: meal.idMeal,
      name: meal.strMeal,
      category: meal.strCategory || mealStub.strCategory || "",
      area: meal.strArea || mealStub.strArea || "",
      ingredients,
      // Rewrite these instructions in your own words before importing.
      notes: meal.strInstructions?.trim() ?? "",
      imageUrl: meal.strMealThumb || null,
      sourceName: "TheMealDB",
      sourceUrl: `https://www.themealdb.com/meal/${meal.idMeal}`,
      cookTime: null,
      difficulty: null,
      cost: null,
      macros: null,
    });
  }
  await pause(250);
}

await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(drafts, null, 2)}\n`, { flag: "w" });
console.log(`Wrote ${drafts.length} API drafts to ${path.relative(root, output)}. Run npm run prepare:recipes to generate the catalog with labeled estimates.`);
