"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { searchMeals, getRandomMeals, getRandomMealId, type MealSearchResponse } from "@/app/lib/searchMeals";
import MealList from "./meals-list";

const MAX_QUERY_LENGTH = 200;
const TYPING_DELAY_MS = 180;
let latestSearch = 0;
let typingTimer: ReturnType<typeof setTimeout> | undefined;

export function SearchBar({ initialResults, intro, art, quickPicks }: {
  initialResults: MealSearchResponse;
  intro?: ReactNode;
  art?: ReactNode;
  quickPicks?: ReactNode;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MealSearchResponse | null>(initialResults);
  const [defaultFill, setDefaultFill] = useState(true);
  const [searchedFor, setSearchedFor] = useState("");
  const [failed, setFailed] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [surprising, setSurprising] = useState(false);

  async function runDefaultFill() {
    const thisSearch = ++latestSearch;
    try {
      const found = await getRandomMeals();
      if (thisSearch === latestSearch) {
        setResults(found);
        setFailed(false);
      }
    } catch {
      if (thisSearch === latestSearch) setFailed(true);
    }
  }

  async function navigateToRandomMeal() {
    setSurprising(true);
    try {
      const id = await getRandomMealId();
      if (id !== null) router.push(`/recipes/${id}`);
      else setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setSurprising(false);
    }
  }

  async function runSearch(text: string, page = 1) {
    clearTimeout(typingTimer);
    const q = text.trim();
    if (q === "") {
      setDefaultFill(true);
      setSearchedFor("");
      await runDefaultFill();
      return;
    }
    setDefaultFill(false);
    const thisSearch = ++latestSearch;
    try {
      const found = await searchMeals(q, page);
      if (thisSearch !== latestSearch) return;
      setResults((current) => page === 1 ? found : current
        ? { ...found, items: [...current.items, ...found.items] }
        : found);
      setSearchedFor(q);
      setFailed(false);
    } catch {
      if (thisSearch === latestSearch) setFailed(true);
    }
  }

  function handleChange(text: string) {
    setQuery(text);
    clearTimeout(typingTimer);
    if (text.trim() === "") {
      setDefaultFill(true);
      setSearchedFor("");
      void runDefaultFill();
      return;
    }
    typingTimer = setTimeout(() => { void runSearch(text); }, TYPING_DELAY_MS);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runSearch(query);
  }

  const hasMore = !!results && results.page < results.totalPages;

  return (
    <>
      <section className="hero">
        <div className="hero-text">
          {intro}
          <div className="search-row">
            <form role="search" className="search" onSubmit={handleSubmit}>
              <label htmlFor="recipe-search" className="visually-hidden">Search recipes by name</label>
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
            <button type="button" className="surprise-button" onClick={() => void navigateToRandomMeal()} disabled={surprising}>
              {surprising ? "Finding a meal…" : "Surprise me!"}
            </button>
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
        <div role="status" aria-live="polite">
          {failed && <p className="empty">Something went wrong. Please try again.</p>}
          {results && results.total === 0 && (
            <p className="empty">{defaultFill ? "No meals yet. Add a recipe to get started." : <>No recipes found for &ldquo;{searchedFor}&rdquo;.</>}</p>
          )}
          {results && results.total > 0 && (
            <>
              {!defaultFill && <p className="result-count">{results.total} {results.total === 1 ? "recipe" : "recipes"} found for &ldquo;{searchedFor}&rdquo;</p>}
              <MealList items={results.items} />
              {hasMore && (
                <div className="load-more">
                  <button
                    className="secondary"
                    disabled={loadingMore}
                    onClick={async () => {
                      setLoadingMore(true);
                      await runSearch(searchedFor, results.page + 1);
                      setLoadingMore(false);
                    }}
                  >
                    {loadingMore ? "Loading…" : `Show more (${results.total - results.items.length} remaining)`}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </>
  );
}
