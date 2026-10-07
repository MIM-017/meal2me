"use client";

import { FormEvent, useMemo, useState } from "react";
import { MealCard } from "./meal-card";
import { useMeals } from "./meals-context";
import {
  DIFFICULTY_RANK,
  type Difficulty,
  type Meal,
} from "@/lib/meals";

type Filters = {
  maxCalories: string;
  maxCost: string;
  maxCookTime: string;
  difficulty: "any" | Difficulty;
};

const emptyFilters: Filters = {
  maxCalories: "",
  maxCost: "",
  maxCookTime: "",
  difficulty: "any",
};

function matches(meal: Meal, filters: Filters) {
  const maxCalories = Number(filters.maxCalories);
  const maxCost = Number(filters.maxCost);
  const maxCookTime = Number(filters.maxCookTime);

  if (filters.maxCalories && meal.calories > maxCalories) {
    return false;
  }
  if (filters.maxCost && meal.cost > maxCost) {
    return false;
  }
  if (filters.maxCookTime && meal.cookTime > maxCookTime) {
    return false;
  }
  if (
    filters.difficulty !== "any" &&
    DIFFICULTY_RANK[meal.difficulty] > DIFFICULTY_RANK[filters.difficulty]
  ) {
    return false;
  }
  return true;
}

export default function HomePage() {
  const { meals } = useMeals();
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [pick, setPick] = useState<Meal | null>(null);

  const results = useMemo(
    () => meals.filter((meal) => matches(meal, filters)),
    [meals, filters],
  );

  function recommend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (results.length === 0) {
      setPick(null);
      return;
    }
    const index = Math.floor(Math.random() * results.length);
    setPick(results[index]);
  }

  return (
    <main>
      <section className="panel">
        <h2>Recommend a meal</h2>
        <form onSubmit={recommend}>
          <div className="filters">
            <label>
              Max calories
              <input
                type="number"
                min="0"
                value={filters.maxCalories}
                onChange={(event) =>
                  setFilters({ ...filters, maxCalories: event.target.value })
                }
              />
            </label>
            <label>
              Max cost ($)
              <input
                type="number"
                min="0"
                step="0.01"
                value={filters.maxCost}
                onChange={(event) =>
                  setFilters({ ...filters, maxCost: event.target.value })
                }
              />
            </label>
            <label>
              Max cook time (min)
              <input
                type="number"
                min="0"
                value={filters.maxCookTime}
                onChange={(event) =>
                  setFilters({ ...filters, maxCookTime: event.target.value })
                }
              />
            </label>
            <label>
              Max difficulty
              <select
                value={filters.difficulty}
                onChange={(event) =>
                  setFilters({
                    ...filters,
                    difficulty: event.target.value as Filters["difficulty"],
                  })
                }
              >
                <option value="any">Any</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </label>
          </div>
          <div className="actions">
            <button type="submit">Recommend one</button>
            <button
              type="reset"
              onClick={() => {
                setFilters(emptyFilters);
                setPick(null);
              }}
            >
              Clear
            </button>
          </div>
        </form>
      </section>

      {pick ? (
        <section className="panel">
          <h2>Try this</h2>
          <MealCard meal={pick} />
        </section>
      ) : null}

      <section>
        <h2>{results.length} matching meals</h2>
        {results.length === 0 ? (
          <p className="empty">No meals match those limits.</p>
        ) : (
          <div className="meal-list">
            {results.map((meal) => (
              <MealCard key={meal.id} meal={meal} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
