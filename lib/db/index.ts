// Server-only: this module opens a database file with a native Node addon.
// Import it from route handlers, server actions and server components only,
// never from a file marked "use client".

export { getDb, openDatabase, migrate, type DB } from "./client";
export { getRequestDb } from "./request";
export * from "./errors";
export * from "./recipes";
export * from "./users";
export {
  DIFFICULTIES,
  LIMITS,
  parseRecipeInput,
  parseSearchParams,
  parseSearchOptions,
  parseId,
  type Difficulty,
  type Macros,
  type RecipeInput,
  type SearchOptions,
  type SearchInput,
  type SearchField,
  type Sort,
} from "./validation";
