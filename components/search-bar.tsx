"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { searchMeals, getAllMeals, type MealSearchResponse } from "@/app/lib/searchMeals";
import MealList from "./meals-list";
import { redirect, RedirectType } from "next/navigation";

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

/**
 * The home page's hero (intro text + search box + Surprise me!) and the
 * results grid under it. They share the search state, so they live together;
 * the static parts are passed in from app/page.tsx.
 */
export function SearchBar({ intro, art, quickPicks }: { intro?: ReactNode; art?: ReactNode; quickPicks?: ReactNode }) {
  const [query, setQuery] = useState("");
  // null = nothing searched yet, so nothing is shown.
  const [results, setResults] = useState<MealSearchResponse | null>(null);
  const [defaultFill, setDefaultFill] = useState<boolean>(true);
  const [searchedFor, setSearchedFor] = useState("");
  const [failed, setFailed] = useState(false);

  async function runDefaultFill() {
      const found = await getAllMeals();
      setResults(found);
  }

  // Fill the initial page on first load
  useEffect(() => {
    runDefaultFill();
  }, []);

  async function navigateToRandomMeal() {
    const meals = await getAllMeals();
    const randomIndex = Math.floor(Math.random() * meals.total);
    const randomMeal = meals.items[randomIndex];
    redirect("/recipes/" + randomMeal.id, RedirectType.push);
  }

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
      runDefaultFill();
      setDefaultFill(true);
      return;
    }
    setDefaultFill(false);


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
      runDefaultFill();
      setDefaultFill(true);
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
      <section className="hero">
        <div className="hero-text">
          {intro}
          <div className="search-row">
            <form role="search" className="search" onSubmit={handleSubmit}>
              <label htmlFor="recipe-search" className="visually-hidden">
                Search recipes by name
              </label>
              <span className="search-icon" aria-hidden="true">🔍</span>
              <input
                id="recipe-search"
                name="q"
                type="search"
                placeholder="Search recipes, e.g. overnight oats…"
                autoComplete="off"
                maxLength={MAX_QUERY_LENGTH}
                value={query}
                onChange={(event) => handleChange(event.target.value)}
              />
            </form>
            <button type="button" className="surprise-button" onClick={() => navigateToRandomMeal()}>Surprise me!</button>
          </div>
        </div>
        {art}
      </section>

      {quickPicks}

      <section aria-labelledby="results-heading">
        <div className="section-head">
          <h2 id="results-heading">{defaultFill ? "Fresh from the kitchen" : "Search results"}</h2>
          <p className="home-hint">Click on any meal to learn more information</p>
        </div>

        <div role="status">
          {failed && <p className="empty">Something went wrong. Please try again.</p>}

          {results && results.total === 0 && (
            <p className="empty">No recipes found for &ldquo;{searchedFor}&rdquo;.</p>
          )}

          {results && results.total > 0 && (
            <>
              <p className="empty">
                {!defaultFill ? 
                <>{results.total} {results.total === 1 ? "recipe" : "recipes"} found for &ldquo;{searchedFor}&rdquo;</>
                : null}
                {results.total > results.items.length && ` (showing the first ${results.items.length})`}
              </p>
              <MealList items={results.items}/>
            </>
          )}
        </div>
      </section>
    </>
  );
}