import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ConflictError,
  createRecipe,
  createUser,
  deleteRecipe,
  ForbiddenError,
  getRecipe,
  getUserByUsername,
  migrate,
  NotFoundError,
  openDatabase,
  parseSearchParams,
  searchRecipes,
  updateRecipe,
  ValidationError,
  type DB,
} from "./index";

let db: DB;
let garf: number;
let kaz: number;

const pancakes = {
  name: "Pancakes",
  ingredients: ["1 cup flour", "1 egg", "1 cup milk"],
  cookTime: 20,
  difficulty: "easy",
  cost: 4.5,
};

/** Expect fn to throw a ValidationError mentioning `field`. */
function expectInvalid(fn: () => unknown, field: string) {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).issues.map((i) => i.field)).toContain(field);
    return;
  }
  throw new Error(`expected a ValidationError for ${field}`);
}

const names = (opts: Parameters<typeof searchRecipes>[1]) =>
  searchRecipes(db, opts).items.map((r) => r.name);

beforeEach(() => {
  db = openDatabase(":memory:");
  garf = createUser(db, "garf").id;
  kaz = createUser(db, "kaz").id;
});
afterEach(() => db.close());

describe("schema", () => {
  it("sets pragmas and version, and migrate() is repeatable", () => {
    expect(db.pragma("foreign_keys", { simple: true })).toBe(1);
    expect(db.pragma("user_version", { simple: true })).toBe(1);
    migrate(db);
    migrate(db);
    expect(db.pragma("user_version", { simple: true })).toBe(1);
  });

  it("refuses a database from newer code", () => {
    db.pragma("user_version = 99");
    expect(() => migrate(db)).toThrow(/version 99/);
  });

  it("works on a real file in WAL mode, and reopening keeps the data", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "recipes-"));
    const file = path.join(dir, "nested", "recipes.db");
    try {
      const a = openDatabase(file);
      expect(a.pragma("journal_mode", { simple: true })).toBe("wal");
      const u = createUser(a, "author1");
      createRecipe(a, u.id, pancakes);
      a.close();
      const b = openDatabase(file);
      expect(searchRecipes(b).total).toBe(1);
      b.close();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("users", () => {
  it("usernames are unique case-insensitively", () => {
    expect(() => createUser(db, "GARF")).toThrow(ConflictError);
    expect(getUserByUsername(db, "Garf").id).toBe(garf);
  });

  it("rejects bad usernames", () => {
    for (const bad of ["ab", "has space", "x".repeat(31), "ta\tb", "née", 5, null]) {
      expect(() => createUser(db, bad)).toThrow(ValidationError);
    }
  });

  it("a user with recipes can't be deleted (RESTRICT)", () => {
    createRecipe(db, garf, pancakes);
    expect(() => db.prepare("DELETE FROM users WHERE id = ?").run(garf)).toThrow(/FOREIGN KEY/);
  });
});

describe("create / get", () => {
  it("round-trips every field", () => {
    const created = createRecipe(db, garf, {
      ...pancakes,
      name: "  Pancakes ",
      difficulty: " EASY ",
      cost: 0.1 + 0.2, // 0.30000000000000004 in floating point; must store as 30 cents
      notes: "Line one\r\nLine two  ",
      macros: { calories: 900, protein: 30.5, carbs: 120 },
    });
    expect(created).toMatchObject({
      name: "Pancakes",
      author: { id: garf, username: "garf" },
      ingredients: pancakes.ingredients,
      cookTime: 20,
      difficulty: "easy",
      notes: "Line one\nLine two",
      cost: 0.3,
      macros: { calories: 900, protein: 30.5, carbs: 120 },
    });
    expect(Number.isNaN(Date.parse(created.createdAt))).toBe(false);
    expect(getRecipe(db, created.id)).toEqual(created);
    expect(getRecipe(db, String(created.id))).toEqual(created); // URL param form
  });

  it("macros and notes are optional; partial macros allowed", () => {
    const a = createRecipe(db, garf, pancakes);
    expect(a.macros).toBeNull();
    expect(a.notes).toBeNull();
    const b = createRecipe(db, garf, { ...pancakes, name: "B", notes: "   ", macros: { protein: 12 } });
    expect(b.macros).toEqual({ calories: null, protein: 12, carbs: null });
    expect(b.notes).toBeNull();
    const c = createRecipe(db, garf, { ...pancakes, name: "C", macros: { calories: null } });
    expect(c.macros).toBeNull();
  });

  it("keeps ingredient order, including duplicates", () => {
    const ingredients = ["z", "a", "m", "a"];
    const r = createRecipe(db, garf, { ...pancakes, ingredients });
    expect(getRecipe(db, r.id).ingredients).toEqual(ingredients);
  });

  it("names are unique per author (case-insensitive), not globally", () => {
    createRecipe(db, garf, pancakes);
    expect(() => createRecipe(db, garf, { ...pancakes, name: "PANCAKES" })).toThrow(ConflictError);
    expect(() => createRecipe(db, kaz, pancakes)).not.toThrow();
  });

  it("unknown author / unknown recipe", () => {
    expect(() => createRecipe(db, 999, pancakes)).toThrow(NotFoundError);
    expect(() => getRecipe(db, 999)).toThrow(NotFoundError);
    for (const bad of ["abc", "0", "-1", "1.5", 0, null]) expectInvalid(() => getRecipe(db, bad), "id");
  });

  it("validation reports every bad field at once", () => {
    try {
      createRecipe(db, garf, { name: "", ingredients: "flour", cookTime: 0, difficulty: "x" });
      throw new Error("should have thrown");
    } catch (err) {
      expect((err as ValidationError).issues.map((i) => i.field).sort()).toEqual(
        ["cookTime", "cost", "difficulty", "ingredients", "name"],
      );
    }
  });

  it.each([
    [{ name: "x".repeat(201) }, "name"],
    [{ name: "two\nlines" }, "name"],
    [{ name: 5 }, "name"],
    [{ ingredients: [] }, "ingredients"],
    [{ ingredients: ["ok", "  "] }, "ingredients[1]"],
    [{ ingredients: ["ok", 3] }, "ingredients[1]"],
    [{ ingredients: Array(101).fill("x") }, "ingredients"],
    [{ cookTime: 1.5 }, "cookTime"],
    [{ cookTime: "20" }, "cookTime"],
    [{ cookTime: 10081 }, "cookTime"],
    [{ difficulty: "extreme" }, "difficulty"],
    [{ cost: undefined }, "cost"],
    [{ cost: -1 }, "cost"],
    [{ cost: 1.234 }, "cost"],
    [{ cost: "4.50" }, "cost"],
    [{ cost: 10000.01 }, "cost"],
    [{ notes: 12 }, "notes"],
    [{ notes: "x".repeat(20001) }, "notes"],
    [{ macros: { calories: -1 } }, "macros.calories"],
    [{ macros: { calories: 10.5 } }, "macros.calories"],
    [{ macros: { protein: Number.NaN } }, "macros.protein"],
    [{ macros: { carbs: "10" } }, "macros.carbs"],
    [{ macros: { fat: 10 } }, "macros.fat"],
    [{ macros: [1, 2] }, "macros"],
    [{ cooktime: 20 }, "cooktime"],
  ])("rejects %j", (override, field) => {
    expectInvalid(() => createRecipe(db, garf, { ...pancakes, ...override }), field);
  });

  it("emoji count as one character, matching SQLite", () => {
    expect(() => createRecipe(db, garf, { ...pancakes, name: "🥞".repeat(200) })).not.toThrow();
  });

  it("a failure halfway through leaves nothing behind", () => {
    // Make the 2nd ingredient insert fail inside the database.
    db.exec(`CREATE TRIGGER boom BEFORE INSERT ON recipe_ingredients WHEN new.position = 1
             BEGIN SELECT RAISE(ABORT, 'boom'); END`);
    expect(() => createRecipe(db, garf, pancakes)).toThrow(/boom/);
    expect(db.prepare("SELECT COUNT(*) FROM recipes").pluck().get()).toBe(0);
    expect(db.prepare("SELECT COUNT(*) FROM recipe_ingredients").pluck().get()).toBe(0);
    expect(db.prepare("SELECT COUNT(*) FROM recipe_search").pluck().get()).toBe(0);
  });
});

describe("update / delete", () => {
  it("author can replace everything", () => {
    const r = createRecipe(db, garf, { ...pancakes, notes: "old", macros: { calories: 1 } });
    const updated = updateRecipe(db, r.id, garf, {
      name: "Crepes",
      ingredients: ["flour", "egg"],
      cookTime: 15,
      difficulty: "medium",
      cost: 3.1,
    });
    expect(updated).toMatchObject({ id: r.id, name: "Crepes", cost: 3.1, ingredients: ["flour", "egg"], notes: null, macros: null });
    expect(updated.updatedAt >= r.updatedAt).toBe(true);
    expect(updated.createdAt).toBe(r.createdAt);
  });

  it("only the author can update or delete", () => {
    const r = createRecipe(db, garf, pancakes);
    expect(() => updateRecipe(db, r.id, kaz, pancakes)).toThrow(ForbiddenError);
    expect(() => deleteRecipe(db, r.id, kaz)).toThrow(ForbiddenError);
    expect(getRecipe(db, r.id).name).toBe("Pancakes");
  });

  it("rename clash and case-only rename", () => {
    const a = createRecipe(db, garf, pancakes);
    createRecipe(db, garf, { ...pancakes, name: "Waffles" });
    expect(() => updateRecipe(db, a.id, garf, { ...pancakes, name: "waffles" })).toThrow(ConflictError);
    expect(updateRecipe(db, a.id, garf, { ...pancakes, name: "PANCAKES" }).name).toBe("PANCAKES");
  });

  it("update/delete of a missing recipe", () => {
    expect(() => updateRecipe(db, 999, garf, pancakes)).toThrow(NotFoundError);
    expect(() => deleteRecipe(db, 999, garf)).toThrow(NotFoundError);
  });

  it("delete removes ingredients and the search entry", () => {
    const r = createRecipe(db, garf, pancakes);
    deleteRecipe(db, r.id, garf);
    expect(() => getRecipe(db, r.id)).toThrow(NotFoundError);
    expect(db.prepare("SELECT COUNT(*) FROM recipe_ingredients").pluck().get()).toBe(0);
    expect(searchRecipes(db, { q: "flour" }).total).toBe(0);
  });

  it("ids are never reused after a delete", () => {
    const a = createRecipe(db, garf, pancakes);
    deleteRecipe(db, a.id, garf);
    expect(createRecipe(db, garf, pancakes).id).toBeGreaterThan(a.id);
  });
});

describe("search", () => {
  beforeEach(() => {
    createRecipe(db, garf, { name: "Garlic Butter Chicken", ingredients: ["2 chicken breasts", "4 cloves garlic", "butter"], cookTime: 35, difficulty: "medium", cost: 12, macros: { calories: 1100 } });
    createRecipe(db, garf, { name: "Crème Brûlée", ingredients: ["cream", "4 egg yolks", "sugar"], cookTime: 60, difficulty: "hard", cost: 8.25, macros: { calories: 1800 } });
    createRecipe(db, kaz, { name: "Egg Fried Rice", ingredients: ["rice", "2 eggs", "garlic"], cookTime: 15, difficulty: "easy", cost: 3, macros: { calories: 600 } });
    createRecipe(db, kaz, { name: "Toast", ingredients: ["bread", "butter"], cookTime: 3, difficulty: "easy", cost: 0.5 });
  });

  it("searches names and ingredients together", () => {
    expect(names({ q: "garlic" }).sort()).toEqual(["Egg Fried Rice", "Garlic Butter Chicken"]);
    // Name match ranks above an ingredient-only match.
    expect(names({ q: "garlic" })[0]).toBe("Garlic Butter Chicken");
    // Words can match different columns: "rice" (name) + "garlic" (ingredient).
    expect(names({ q: "rice garlic" })).toEqual(["Egg Fried Rice"]);
  });

  it("restricts to one column", () => {
    expect(names({ q: "egg", field: "name" })).toEqual(["Egg Fried Rice"]);
    expect(names({ q: "egg", field: "ingredients" }).sort()).toEqual(["Crème Brûlée", "Egg Fried Rice"]);
    expect(names({ q: "garlic rice", field: "name" })).toEqual([]);
  });

  it("prefix, case and accent insensitive", () => {
    expect(names({ q: "CHICK" })).toEqual(["Garlic Butter Chicken"]);
    expect(names({ q: "creme brulee" })).toEqual(["Crème Brûlée"]);
  });

  it("search index follows updates", () => {
    const toast = searchRecipes(db, { q: "toast" }).items[0];
    updateRecipe(db, toast.id, kaz, { name: "Avocado Toast", ingredients: ["bread", "avocado"], cookTime: 5, difficulty: "easy", cost: 2 });
    expect(names({ q: "avocado", field: "ingredients" })).toEqual(["Avocado Toast"]);
    expect(names({ q: "butter", field: "ingredients" })).toEqual(["Garlic Butter Chicken"]);
  });

  it("user input can't break the query syntax", () => {
    for (const q of ['"', "garlic AND (", "NEAR(", "*", "name:egg", "- ^ {}", "a\" OR \"b", "!!!"]) {
      expect(() => searchRecipes(db, { q })).not.toThrow();
    }
    expect(searchRecipes(db, { q: "!!!" }).total).toBe(0);
  });

  it("filters, author, sort and pagination", () => {
    expect(names({ difficulty: "easy", sort: "cookTime" })).toEqual(["Toast", "Egg Fried Rice"]);
    expect(names({ maxCookTime: 35, sort: "name" })).toEqual(["Egg Fried Rice", "Garlic Butter Chicken", "Toast"]);
    expect(names({ author: "KAZ", sort: "name" })).toEqual(["Egg Fried Rice", "Toast"]);
    expect(names({ q: "garlic", difficulty: "easy" })).toEqual(["Egg Fried Rice"]);

    const page = searchRecipes(db, { sort: "name", pageSize: 3, page: 2 });
    expect(page).toMatchObject({ total: 4, totalPages: 2, page: 2 });
    expect(page.items.map((r) => r.name)).toEqual(["Toast"]);
    expect(searchRecipes(db, { page: 9 }).items).toEqual([]);
  });

  it("max calories / cost / difficulty, matching the Meal2Me filters", () => {
    // Toast has no calories entered, so a calorie limit excludes it.
    expect(names({ maxCalories: 1200, sort: "calories" })).toEqual(["Egg Fried Rice", "Garlic Butter Chicken"]);
    expect(names({ maxCost: 8.25, sort: "cost" })).toEqual(["Toast", "Egg Fried Rice", "Crème Brûlée"]);
    expect(names({ maxCost: "3", sort: "cost" })).toEqual(["Toast", "Egg Fried Rice"]); // URL string form
    expect(names({ maxDifficulty: "medium", sort: "name" })).toEqual(["Egg Fried Rice", "Garlic Butter Chicken", "Toast"]);
    expect(names({ maxDifficulty: "easy", maxCalories: 1000, maxCost: 5, maxCookTime: 20 })).toEqual(["Egg Fried Rice"]);
    expect(searchRecipes(db, { sort: "cost" }).items.map((r) => r.cost)).toEqual([0.5, 3, 8.25, 12]);
    expectInvalid(() => searchRecipes(db, { maxCost: "1.234" }), "maxCost");
    expectInvalid(() => searchRecipes(db, { maxDifficulty: "insane" }), "maxDifficulty");
  });

  it("summaries don't carry notes or ingredients", () => {
    const item = searchRecipes(db).items[0] as unknown as Record<string, unknown>;
    expect(item).not.toHaveProperty("notes");
    expect(item).not.toHaveProperty("ingredients");
  });

  it("parses URL query strings and rejects bad ones", () => {
    const opts = parseSearchParams(
      new URLSearchParams("q=egg&field=name&maxCookTime=30&maxCalories=500&maxCost=7.5&maxDifficulty=medium&page=2&pageSize=10"),
    );
    expect(opts).toMatchObject({
      q: "egg", field: "name", maxCookTime: 30, maxCalories: 500, maxCostCents: 750,
      maxDifficulty: "medium", page: 2, pageSize: 10, sort: "relevance",
    });
    expectInvalid(() => parseSearchParams(new URLSearchParams("pageSize=500")), "pageSize");
    expectInvalid(() => parseSearchParams(new URLSearchParams("field=notes")), "field");
    expectInvalid(() => parseSearchParams(new URLSearchParams("maxCookTime=abc")), "maxCookTime");
    expectInvalid(() => parseSearchParams(new URLSearchParams("sort=;DROP TABLE recipes")), "sort");
  });

  it("uses indexes for filters", () => {
    const plan = db
      .prepare("EXPLAIN QUERY PLAN SELECT * FROM recipes WHERE difficulty = 'easy' AND cook_time_minutes <= 30")
      .all() as { detail: string }[];
    expect(plan.map((p) => p.detail).join()).toMatch(/USING INDEX idx_recipes_difficulty_cook_time/);
  });
});

describe("database constraints (raw SQL bypassing validation)", () => {
  const insert = (cols: Record<string, unknown>) => {
    const row = { author_id: garf, name: "Raw", cook_time_minutes: 10, difficulty: "easy", cost_cents: 100, ...cols };
    const keys = Object.keys(row);
    db.prepare(`INSERT INTO recipes (${keys.join()}) VALUES (${keys.map((k) => "@" + k).join()})`).run(row);
  };

  it.each([
    [{ difficulty: "Easy" }],
    [{ cook_time_minutes: 0 }],
    [{ cook_time_minutes: "ten" }],
    [{ calories: -5 }],
    [{ calories: 1.5 }],
    [{ name: " Raw " }],
    [{ name: "" }],
    [{ notes: "  " }],
    [{ author_id: 999 }],
    [{ cost_cents: -1 }],
    [{ cost_cents: 1.5 }],
    [{ cost_cents: null }],
  ])("rejects %j", (cols) => {
    expect(() => insert(cols)).toThrow();
  });

  it("rejects orphan ingredients", () => {
    expect(() =>
      db.prepare("INSERT INTO recipe_ingredients VALUES (999, 0, 'salt')").run(),
    ).toThrow(/FOREIGN KEY/);
  });
});
