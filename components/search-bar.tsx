"use client";

import { useState, type FormEvent } from "react";
import { searchMeals, type MealSearchResponse } from "@/app/lib/searchMeals";

// Same as LIMITS.queryLength in lib/db/validation.ts. Not imported from
// "@/lib/db" because that module must never be imported by a client file.
const MAX_QUERY_LENGTH = 200;

// Wait this long after the last keystroke before searching, so typing
// "chicken" quickly sends 1 request instead of 7.
const TYPING_DELAY_MS = 150;

// Counts searches so that if an older search finishes after a newer one,
// its (stale) results are ignored.
let latestSearch = 0;
// The search waiting for the user to stop typing.
let typingTimer: ReturnType<typeof setTimeout> | undefined;

export function SearchBar() {
  const [query, setQuery] = useState("");
  // null = nothing searched yet, so nothing is shown.
  const [results, setResults] = useState<MealSearchResponse | null>(null);
  const [searchedFor, setSearchedFor] = useState("");
  const [failed, setFailed] = useState(false);

  function clearResults() {
    clearTimeout(typingTimer); // drop a search that hasn't started yet
    latestSearch++;            // and ignore one that's still in flight
    setResults(null);
    setSearchedFor("");
    setFailed(false);
  }

  async function runSearch(text: string) {
    clearTimeout(typingTimer);
    const q = text.trim();

    // Nothing typed, or only spaces: show no recipes.
    if (q === "") {
      clearResults();
      return;
    }

    const thisSearch = ++latestSearch;
    try {
      const found = await searchMeals(q);
      if (thisSearch !== latestSearch) return;
      setResults(found);
      setSearchedFor(q);
      setFailed(false);
    } catch {
      if (thisSearch !== latestSearch) return;
      setResults(null);
      setFailed(true);
    }
  }

  function handleChange(text: string) {
    setQuery(text);
    clearTimeout(typingTimer);
    if (text.trim() === "") {
      // Box emptied (or only spaces left): hide results right away.
      clearResults();
      return;
    }
    // Old results stay on screen until the new ones arrive (no flicker).
    typingTimer = setTimeout(() => runSearch(text), TYPING_DELAY_MS);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runSearch(query); // Enter searches immediately, skipping the delay.
  }

  return (
    <>
      <form role="search" className="search" onSubmit={handleSubmit}>
        <label htmlFor="recipe-search" className="visually-hidden">
          Search recipes by name
        </label>
        <input
          id="recipe-search"
          name="q"
          type="search"
          placeholder="Search..."
          autoComplete="off"
          maxLength={MAX_QUERY_LENGTH}
          value={query}
          onChange={(event) => handleChange(event.target.value)}
        />
      </form>

      <p className="home-hint">Click on any meal to learn more information</p>

      <div role="status">
        {failed && <p className="empty">Something went wrong. Please try again.</p>}

        {results && results.total === 0 && (
          <p className="empty">No recipes found for &ldquo;{searchedFor}&rdquo;.</p>
        )}

        {results && results.total > 0 && (
          <>
            <p className="empty">
              {results.total} {results.total === 1 ? "recipe" : "recipes"} found for &ldquo;{searchedFor}&rdquo;
              {results.total > results.items.length && ` (showing the first ${results.items.length})`}
            </p>
            <ul className="search-results">
              {results.items.map((recipe) => (
                <li key={recipe.id}>
                  {recipe.name} <span className="empty">by {recipe.author}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </>
  );
}