import { Suspense } from "react";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getRecipe, getRequestDb, NotFoundError, ValidationError, type Recipe } from "@/lib/db";

/** "1. Boil water" / "Step 2: Drain" -> "Boil water" / "Drain", since the <ol> numbers them. */
function toSteps(instructions: string): string[] {
  return instructions
    .split("\n")
    .map((line) => line.replace(/^\s*(step\s*)?\d+\s*[.):-]\s*/i, "").trim())
    .filter((line) => line !== "");
}

async function RecipeContent({ params }: { params: PageProps<"/recipes/[id]">["params"] }) {
  const { id } = await params;

  let recipe: Recipe;
  try {
    recipe = getRecipe(await getRequestDb(), id);
  } catch (error) {
    // Bad id in the URL (e.g. /recipes/abc) or no recipe with that id.
    if (error instanceof ValidationError || error instanceof NotFoundError) notFound();
    throw error;
  }

  const m = recipe.macros;
  const steps = recipe.notes ? toSteps(recipe.notes) : [];

  return (
    <article className="recipe panel">
      <header className="recipe-header">
        <h1>{recipe.name}</h1>
        <p className="recipe-author">by {recipe.author.username}</p>
      </header>

      {recipe.imageUrl && (
        <Image className="recipe-image" src={recipe.imageUrl} alt={recipe.name} width={760} height={507} />
      )}

      <dl className="recipe-stats">
        <div><dt>Calories</dt><dd>{m?.calories ?? "—"}</dd></div>
        <div><dt>Protein</dt><dd>{m?.protein != null ? `${m.protein} g` : "—"}</dd></div>
        <div><dt>Carbs</dt><dd>{m?.carbs != null ? `${m.carbs} g` : "—"}</dd></div>
        <div><dt>Cost</dt><dd>${recipe.cost.toFixed(2)}</dd></div>
        <div><dt>Cook time</dt><dd>{recipe.cookTime} min</dd></div>
        <div><dt>Difficulty</dt><dd>{recipe.difficulty}</dd></div>
      </dl>

      <section className="recipe-section">
        <h2>Ingredients</h2>
        <ul>
          {recipe.ingredients.map((ingredient, i) => <li key={i}>{ingredient}</li>)}
        </ul>
      </section>

      <section className="recipe-section">
        <h2>Instructions</h2>
        {steps.length > 0 ? (
          <ol>
            {steps.map((step, i) => <li key={i}>{step}</li>)}
          </ol>
        ) : (
          <p className="empty">No instructions have been added for this recipe.</p>
        )}
      </section>
    </article>
  );
}

export default function RecipePage({ params }: PageProps<"/recipes/[id]">) {
  return (
    <main>
      {/* cacheComponents: reading params + the database must happen inside Suspense. */}
      <Suspense fallback={<p className="empty">Loading recipe…</p>}>
        <RecipeContent params={params} />
      </Suspense>
    </main>
  );
}