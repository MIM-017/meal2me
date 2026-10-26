import { Suspense } from "react";
import { getRequestDb, searchRecipes, ValidationError } from "@/lib/db";
import { MealCard } from "@/components/meal-card";

type Params = Promise<Record<string, string | string[] | undefined>>;

const KEYS = [
  "ingredient", "maxCalories", "minProtein", "maxCarbs",
  "maxCost", "maxCookTime", "maxDifficulty",
] as const;

async function FilterContent({ searchParams }: { searchParams: Params }) {
  const sp = await searchParams;
  const values: Record<string, string> = {};
  for (const k of KEYS) {
    const v = sp[k];
    values[k] = (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
  }

  let content;
  try {
    const db = await getRequestDb();
    const { items, total } = searchRecipes(db, { ...values, sort: "newest", pageSize: 50 });
    content = (
      <>
        <h2>{total} matching {total === 1 ? "meal" : "meals"}</h2>
        {total === 0 ? (
          <p className="empty">No meals match those filters.</p>
        ) : (
          <div className="meal-list">
            {items.map((r) => <MealCard key={r.id} recipeID={r.id} />)}
          </div>
        )}
      </>
    );
  } catch (e) {
    if (!(e instanceof ValidationError)) throw e;
    content = <p className="empty">{e.issues.map((i) => `${i.field}: ${i.message}`).join("; ")}</p>;
  }

  return (
    <>
      <section className="panel">
        <h2>Filters</h2>
        <form method="get">
          <div className="filters">
            <label>Ingredient
              <input name="ingredient" defaultValue={values.ingredient} placeholder="e.g. garlic" />
            </label>
            <label>Max calories
              <input name="maxCalories" type="number" min="0" step="1" defaultValue={values.maxCalories} />
            </label>
            <label>Min protein (g)
              <input name="minProtein" type="number" min="0" step="1" defaultValue={values.minProtein} />
            </label>
            <label>Max carbs (g)
              <input name="maxCarbs" type="number" min="0" step="1" defaultValue={values.maxCarbs} />
            </label>
            <label>Max cost ($)
              <input name="maxCost" type="number" min="0" step="0.01" defaultValue={values.maxCost} />
            </label>
            <label>Max cook time (min)
              <input name="maxCookTime" type="number" min="1" step="1" defaultValue={values.maxCookTime} />
            </label>
            <label>Max difficulty
              <select name="maxDifficulty" defaultValue={values.maxDifficulty}>
                <option value="">Any</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </label>
          </div>
          <div className="actions">
            <button type="submit">Apply filters</button>
            <a href="/filters">Clear</a>
          </div>
        </form>
      </section>
      {content}
    </>
  );
}

export default function FiltersPage({ searchParams }: { searchParams: Params }) {
  return (
    <main>
      <Suspense fallback={<p className="empty">Loading…</p>}>
        <FilterContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}