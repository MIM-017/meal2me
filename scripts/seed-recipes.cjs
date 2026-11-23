#!/usr/bin/env node
// Validate the entire curated JSON before inserting any recipe.
/* eslint-disable @typescript-eslint/no-require-imports */
require("./register-ts.cjs");
const fs = require("node:fs");
const path = require("node:path");
const { getDb, createRecipe, parseRecipeInput, ValidationError } = require("../lib/db/index.ts");

const inputPath = path.resolve(process.argv[2] || "data/recipes.json");
if (!fs.existsSync(inputPath)) {
  console.error(`Recipe file not found: ${inputPath}\nCopy the prepared recipe list to data/recipes.json first.`);
  process.exitCode = 1;
} else {
  const raw = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  if (!Array.isArray(raw)) throw new Error("Recipe file must contain a JSON array.");
  const issues = [];
  const seen = new Set();
  const prepared = raw.map((recipe, index) => {
    try {
      const parsed = parseRecipeInput(recipe);
      const key = parsed.name.toLocaleLowerCase("en-US");
      if (seen.has(key)) issues.push(`Recipe ${index + 1} (${parsed.name}): duplicate name in this file.`);
      seen.add(key);
      return recipe;
    } catch (error) {
      if (error instanceof ValidationError) {
        for (const issue of error.issues) issues.push(`Recipe ${index + 1}: ${issue.field} ${issue.message}.`);
      } else throw error;
    }
  });

  if (issues.length) {
    console.error(`Found ${issues.length} issue(s); no recipes were saved:\n- ${issues.join("\n- ")}`);
    process.exitCode = 1;
  } else {
    const db = getDb();
    try {
      const result = db.transaction(() => {
        const email = "curated-recipes@meal2me.invalid";
        let author = db.prepare("SELECT id FROM users WHERE username = ?").get("meal2me-curated");
        if (!author) author = db.prepare("INSERT INTO users (username, email) VALUES (?, ?) RETURNING id")
          .get("meal2me-curated", email);
        let added = 0;
        let skipped = 0;
        let updated = 0;
        for (const recipe of prepared) {
          const exists = db.prepare("SELECT id, notes, difficulty FROM recipes WHERE author_id = ? AND name = ?")
            .get(author.id, recipe.name);
          if (exists) {
            if (exists.notes !== (recipe.notes ?? null) || exists.difficulty !== recipe.difficulty) {
              db.prepare(`UPDATE recipes SET notes = ?, difficulty = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`)
                .run(recipe.notes ?? null, recipe.difficulty, exists.id);
              updated++;
            } else skipped++;
            continue;
          }
          createRecipe(db, author.id, recipe);
          added++;
        }
        return { added, updated, skipped };
      }).immediate();
      console.log(`Imported ${result.added} recipes, updated ${result.updated}, skipped ${result.skipped} unchanged duplicates.`);
    } finally {
      db.close();
    }
  }
}
