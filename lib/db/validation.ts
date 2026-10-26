/**
 * Turns untrusted input (a JSON request body, URL query string, form data)
 * into typed, normalised values, or throws a ValidationError listing every
 * problem. The database has matching CHECK constraints as a second line of
 * defence; these checks exist to give users readable messages.
 */
import { ValidationError, type Issue } from "./errors";

/** Ordered easiest to hardest (the "max difficulty" filter relies on this). */
export const DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const SEARCH_FIELDS = ["all", "name", "ingredients"] as const;
export type SearchField = (typeof SEARCH_FIELDS)[number];

export const SORTS = ["relevance", "newest", "name", "cookTime", "cost", "calories"] as const;
export type Sort = (typeof SORTS)[number];

// Limits. Keep in sync with the CHECK constraints in schema.ts.
export const LIMITS = {
  nameLength: 200,
  ingredientLength: 500,
  ingredientCount: 100,
  notesLength: 20000,
  cookTimeMinutes: 10080, // one week
  costDollars: 10000,
  calories: 100000,
  grams: 10000,
  queryLength: 200,
  pageSize: 50,
} as const;

/** Macros for the whole recipe. Any of them may be missing. */
export interface Macros {
  calories: number | null; // kcal, whole number
  protein: number | null; // grams
  carbs: number | null; // grams
}

export interface RecipeInput {
  name: string;
  ingredients: string[];
  cookTime: number; // minutes
  difficulty: Difficulty;
  costCents: number; // stored in cents; the API takes and returns dollars
  notes: string | null;
  macros: Macros | null;
  imageUrl: string | null;
}

export interface SearchOptions {
  q: string;
  field: SearchField;
  difficulty: Difficulty | null; // exactly this difficulty
  maxDifficulty: Difficulty | null; // this difficulty or easier
  maxCookTime: number | null;
  maxCalories: number | null;
  maxCostCents: number | null;
  ingredient: string | null;   
  minProtein: number | null;   
  maxCarbs: number | null;  
  author: string | null;
  sort: Sort;
  page: number;
  pageSize: number;
}

// ---------------------------------------------------------------------------
// Small helpers. Each returns a cleaned value, or records an issue and
// returns undefined so that every problem is reported at once.
// ---------------------------------------------------------------------------

// Control characters (newlines, tabs, NUL...) don't belong in one-line fields.
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

// SQLite's length() counts Unicode code points; String.length counts UTF-16
// units (an emoji is 2). Count code points so both sides agree.
const charCount = (s: string) => Array.from(s).length;

function singleLine(
  value: unknown,
  field: string,
  max: number,
  issues: Issue[],
): string | undefined {
  if (typeof value !== "string") {
    issues.push({ field, message: "must be text" });
    return undefined;
  }
  const s = value.normalize("NFC").trim();
  if (s.length === 0) issues.push({ field, message: "must not be empty" });
  else if (charCount(s) > max) issues.push({ field, message: `must be at most ${max} characters` });
  else if (CONTROL_CHARS.test(s)) issues.push({ field, message: "must not contain line breaks or control characters" });
  else return s;
  return undefined;
}

function wholeNumber(
  value: unknown,
  field: string,
  min: number,
  max: number,
  issues: Issue[],
): number | undefined {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    issues.push({ field, message: "must be a whole number" });
  } else if (value < min || value > max) {
    issues.push({ field, message: `must be between ${min} and ${max}` });
  } else {
    return value;
  }
  return undefined;
}

function difficulty(value: unknown, field: string, issues: Issue[]): Difficulty | undefined {
  const s = typeof value === "string" ? value.trim().toLowerCase() : value;
  if ((DIFFICULTIES as readonly unknown[]).includes(s)) return s as Difficulty;
  issues.push({ field, message: `must be one of: ${DIFFICULTIES.join(", ")}` });
  return undefined;
}

function rejectUnknownKeys(
  obj: Record<string, unknown>,
  allowed: readonly string[],
  prefix: string,
  issues: Issue[],
) {
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) issues.push({ field: prefix + key, message: "is not a recognised field" });
  }
}

// ---------------------------------------------------------------------------
// Recipes
// ---------------------------------------------------------------------------

const RECIPE_KEYS = ["name", "ingredients", "cookTime", "difficulty", "cost", "notes", "macros", "imageUrl"] as const;
const MACRO_KEYS = ["calories", "protein", "carbs"] as const;

function parseIngredients(value: unknown, issues: Issue[]): string[] | undefined {
  if (!Array.isArray(value)) {
    issues.push({ field: "ingredients", message: "must be a list of text items" });
    return undefined;
  }
  if (value.length === 0) {
    issues.push({ field: "ingredients", message: "must have at least one item" });
    return undefined;
  }
  if (value.length > LIMITS.ingredientCount) {
    issues.push({ field: "ingredients", message: `may have at most ${LIMITS.ingredientCount} items` });
    return undefined;
  }
  const before = issues.length;
  const cleaned = value.map((item, i) =>
    singleLine(item, `ingredients[${i}]`, LIMITS.ingredientLength, issues),
  );
  return issues.length === before ? (cleaned as string[]) : undefined;
}

/**
 * Dollars (e.g. 12.5) -> cents (1250). At most 2 decimal places.
 * Accepts a number, or a numeric string when `allowString` (URL params).
 */
function dollarsToCents(
  value: unknown,
  field: string,
  issues: Issue[],
  allowString = false,
): number | undefined {
  const n =
    allowString && typeof value === "string" && /^\d+(\.\d+)?$/.test(value.trim()) ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) {
    issues.push({ field, message: "must be a number" });
    return undefined;
  }
  const cents = Math.round(n * 100);
  // 0.1 * 100 = 10.000000000000002 in floating point, so compare with a tolerance.
  if (Math.abs(n * 100 - cents) > 1e-6) {
    issues.push({ field, message: "must have at most 2 decimal places" });
  } else if (n < 0 || n > LIMITS.costDollars) {
    issues.push({ field, message: `must be between 0 and ${LIMITS.costDollars}` });
  } else {
    return cents;
  }
  return undefined;
}

function parseNotes(value: unknown, issues: Issue[]): string | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    issues.push({ field: "notes", message: "must be text" });
    return undefined;
  }
  // Notes are multi-line: keep line breaks, normalise Windows "\r\n" to "\n".
  const s = value.normalize("NFC").replace(/\r\n?/g, "\n").trim();
  if (s.length === 0) return null; // blank notes are stored as "no notes"
  if (charCount(s) > LIMITS.notesLength) {
    issues.push({ field: "notes", message: `must be at most ${LIMITS.notesLength} characters` });
    return undefined;
  }
  if (/[\u0000-\u0008\u000b-\u001f\u007f]/.test(s)) {
    issues.push({ field: "notes", message: "must not contain control characters" });
    return undefined;
  }
  return s;
}

function parseMacro(
  value: unknown,
  field: string,
  max: number,
  integer: boolean,
  issues: Issue[],
): number | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    issues.push({ field, message: "must be a number" });
  } else if (integer && !Number.isInteger(value)) {
    issues.push({ field, message: "must be a whole number" });
  } else if (value < 0 || value > max) {
    issues.push({ field, message: `must be between 0 and ${max}` });
  } else {
    return value;
  }
  return undefined;
}

function parseMacros(value: unknown, issues: Issue[]): Macros | null | undefined {
  if (value === undefined || value === null) return null;
  if (!isPlainObject(value)) {
    issues.push({ field: "macros", message: "must be an object" });
    return undefined;
  }
  rejectUnknownKeys(value, MACRO_KEYS, "macros.", issues);
  const macros = {
    calories: parseMacro(value.calories, "macros.calories", LIMITS.calories, true, issues),
    protein: parseMacro(value.protein, "macros.protein", LIMITS.grams, false, issues),
    carbs: parseMacro(value.carbs, "macros.carbs", LIMITS.grams, false, issues),
  };
  if (Object.values(macros).some((v) => v === undefined)) return undefined;
  // {} or all-null means "no macros given".
  if (Object.values(macros).every((v) => v === null)) return null;
  return macros as Macros;
}

function parseImageUrl(value: unknown, issues: Issue[]): string | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  if (
    typeof value !== "string" ||
    value.length > 500 ||
    !/^\/images\/[A-Za-z0-9_\-./]+$/.test(value) ||
    value.includes("..")
  ) {
    issues.push({ field: "imageUrl", message: "must be a path like /images/oatmeal.jpg" });
    return undefined;
  }
  return value;
}

/** Validate a recipe body. Throws ValidationError listing every problem. */
export function parseRecipeInput(data: unknown): RecipeInput {
  if (!isPlainObject(data)) {
    throw new ValidationError([{ field: "body", message: "must be a JSON object" }]);
  }
  const issues: Issue[] = [];
  rejectUnknownKeys(data, RECIPE_KEYS, "", issues);
  const result = {
    name: singleLine(data.name, "name", LIMITS.nameLength, issues),
    ingredients: parseIngredients(data.ingredients, issues),
    cookTime: wholeNumber(data.cookTime, "cookTime", 1, LIMITS.cookTimeMinutes, issues),
    difficulty: difficulty(data.difficulty, "difficulty", issues),
    costCents: dollarsToCents(data.cost, "cost", issues),
    notes: parseNotes(data.notes, issues),
    macros: parseMacros(data.macros, issues),
    imageUrl: parseImageUrl(data.imageUrl, issues), 
  };
  if (issues.length > 0) throw new ValidationError(issues);
  return result as RecipeInput;
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

/** 3-30 characters: letters, digits, "_", "." or "-". */
export function parseUsername(value: unknown): string {
  const issues: Issue[] = [];
  if (typeof value !== "string" || !/^[A-Za-z0-9_.-]{3,30}$/.test(value.trim())) {
    issues.push({
      field: "username",
      message: "must be 3-30 characters: letters, digits, _ . or -",
    });
    throw new ValidationError(issues);
  }
  return value.trim();
}

/** Database ids are positive integers. Accepts a number or a digit string (from a URL). */
export function parseId(value: unknown, field = "id"): number {
  const n = typeof value === "string" && /^[1-9]\d{0,15}$/.test(value) ? Number(value) : value;
  if (typeof n === "number" && Number.isSafeInteger(n) && n > 0) return n;
  throw new ValidationError([{ field, message: "must be a positive whole number" }]);
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/** What callers pass in. Same as SearchOptions, except cost is `maxCost` in dollars. */
export type SearchInput = Partial<Record<Exclude<keyof SearchOptions, "maxCostCents"> | "maxCost", unknown>>;

// URL params arrive as strings; code may pass numbers. Accept both.
function toInt(value: unknown): unknown {
  return typeof value === "string" && /^-?\d{1,9}$/.test(value.trim()) ? Number(value) : value;
}

const empty = (v: unknown) => v === undefined || v === null || v === "";

export function parseSearchOptions(input: SearchInput = {}): SearchOptions {
  const issues: Issue[] = [];

  let q = "";
  if (!empty(input.q)) {
    if (typeof input.q !== "string") issues.push({ field: "q", message: "must be text" });
    else if (charCount(input.q) > LIMITS.queryLength)
      issues.push({ field: "q", message: `must be at most ${LIMITS.queryLength} characters` });
    else q = input.q.trim();
  }

  const pick = <T extends string>(value: unknown, options: readonly T[], field: string, fallback: T): T => {
    if (empty(value)) return fallback;
    if ((options as readonly unknown[]).includes(value)) return value as T;
    issues.push({ field, message: `must be one of: ${options.join(", ")}` });
    return fallback;
  };

  const field = pick(input.field, SEARCH_FIELDS, "field", "all");
  const sort = pick(input.sort, SORTS, "sort", q ? "relevance" : "newest");

  const options: SearchOptions = {
    q,
    field,
    sort,
    difficulty: empty(input.difficulty) ? null : (difficulty(input.difficulty, "difficulty", issues) ?? null),
    maxDifficulty: empty(input.maxDifficulty)
      ? null
      : (difficulty(input.maxDifficulty, "maxDifficulty", issues) ?? null),
    maxCookTime: empty(input.maxCookTime)
      ? null
      : (wholeNumber(toInt(input.maxCookTime), "maxCookTime", 1, LIMITS.cookTimeMinutes, issues) ?? null),
    maxCalories: empty(input.maxCalories)
      ? null
      : (wholeNumber(toInt(input.maxCalories), "maxCalories", 0, LIMITS.calories, issues) ?? null),
    maxCostCents: empty(input.maxCost) ? null : (dollarsToCents(input.maxCost, "maxCost", issues, true) ?? null),
    ingredient: empty(input.ingredient)
      ? null
      : (singleLine(input.ingredient, "ingredient", LIMITS.queryLength, issues) ?? null),
    minProtein: empty(input.minProtein)
      ? null
      : (wholeNumber(toInt(input.minProtein), "minProtein", 0, LIMITS.grams, issues) ?? null),
    maxCarbs: empty(input.maxCarbs)
      ? null
      : (wholeNumber(toInt(input.maxCarbs), "maxCarbs", 0, LIMITS.grams, issues) ?? null),
    author: empty(input.author) ? null : (singleLine(input.author, "author", 30, issues) ?? null),
    page: empty(input.page) ? 1 : (wholeNumber(toInt(input.page), "page", 1, 10000, issues) ?? 1),
    pageSize: empty(input.pageSize)
      ? 20
      : (wholeNumber(toInt(input.pageSize), "pageSize", 1, LIMITS.pageSize, issues) ?? 20),
  };

  if (issues.length > 0) throw new ValidationError(issues);
  return options;
}

/** Convenience for route handlers: `/api/recipes?q=garlic&difficulty=easy&page=2`. */
export function parseSearchParams(params: URLSearchParams): SearchOptions {
  const keys = [
    "q", "field", "difficulty", "maxDifficulty", "maxCookTime",
    "maxCalories", "maxCost", "author", "sort", "page", "pageSize",
  ] as const;
  const input: SearchInput = {};
  for (const key of keys) {
    const value = params.get(key);
    if (value !== null) input[key] = value;
  }
  return parseSearchOptions(input);
}
