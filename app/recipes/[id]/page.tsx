import { Suspense } from "react";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getRecipe, getRequestDb, isFavorite, NotFoundError, ValidationError, type Recipe } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { FavoriteButton } from "@/components/favorite-button";
import { DeleteButton } from "@/components/delete-button";

/** "1. Boil water" / "Step 2: Drain" -> "Boil water" / "Drain", since the <ol> numbers them. */
function toSteps(instructions: string): string[] {
  return instructions
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .split("\n")
    .map((line) => line
      .replace(/^\s*(?:(?:step|part)\s*#?\s*)?\d+\s*[.):-]\s*/i, "")
      .replace(/^\s*(?:step|part)\s*#?\s*\d+\s*[:.)-]?\s*$/i, "")
      .trim())
    .filter((line) => line !== "");
}


async function RecipeContent({ params }: { params: PageProps<"/recipes/[id]">["params"] }) {
  const { id } = await params;

  const db = await getRequestDb();
  let recipe: Recipe;
  try {
    recipe = getRecipe(db, id);
  } catch (error) {
    // Bad id in the URL (e.g. /recipes/abc) or no recipe with that id.
    if (error instanceof ValidationError || error instanceof NotFoundError) notFound();
    throw error;
  }

  const m = recipe.macros;
  const isEstimated = recipe.sourceName === "TheMealDB";
  const steps = recipe.notes ? toSteps(recipe.notes) : [];
  const user = await getCurrentUser();

  return (
    <article className="recipe panel">
      <header className="recipe-header">
        <div>
          <h1>{recipe.name}</h1>
          <p className="recipe-author">by {recipe.author.username}</p>
        </div>
        <div style={{gap: 10, display: "flex"}}>
          {user?.id === recipe.author.id && <DeleteButton recipeId={recipe.id}/>}
          {user && <FavoriteButton recipeId={recipe.id} initialFavorited={isFavorite(db, user.id, recipe.id)} />}
        </div>
      </header>

      {(recipe.sourceName || recipe.sourceUrl) && <p className="recipe-source">Source: {recipe.sourceUrl
        ? <a href={recipe.sourceUrl} target="_blank" rel="noreferrer">{recipe.sourceName || recipe.sourceUrl}</a>
        : recipe.sourceName}</p>}

      {recipe.imageUrl && (
        <Image className="recipe-image" src={recipe.imageUrl} alt={recipe.name} width={760} height={507} />
      )}

      {isEstimated && <p className="estimate-note">Cost and cook time are estimates for a typical U.S. grocery shop and the listed quantities. Actual prices and times vary.</p>}

      <dl className="recipe-stats">
        <div><dt>Calories</dt><dd>{m?.calories ?? "—"}</dd></div>
        <div><dt>Protein</dt><dd>{m?.protein != null ? `${m.protein} g` : "—"}</dd></div>
        <div><dt>Carbs</dt><dd>{m?.carbs != null ? `${m.carbs} g` : "—"}</dd></div>
        <div><dt>{isEstimated ? "Est. recipe cost" : "Cost"}</dt><dd>${recipe.cost.toFixed(2)}</dd></div>
        <div><dt>{isEstimated ? "Est. cook time" : "Cook time"}</dt><dd>{recipe.cookTime} min</dd></div>
        <div><dt>{isEstimated ? "Est. difficulty" : "Difficulty"}</dt><dd>{recipe.difficulty}</dd></div>
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