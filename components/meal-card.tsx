import Image from "next/image";
import Link from "next/link";
import { getRecipe, Recipe, RecipeSummary, getRequestDb, isFavorite } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { FavoriteButton } from "./favorite-button";

export async function MealCard({ recipeID }: { recipeID: unknown }) {
  const db = await getRequestDb();
  const recipe: Recipe = getRecipe(db, recipeID);
  const user = await getCurrentUser();

  return <MealCardContent recipe={recipe} showFavorite={!!user} favorited={!!user && isFavorite(db, user.id, recipe.id)} />;
}

export function MealCardContent({ recipe, showFavorite, favorited }: {
  recipe: RecipeSummary;
  showFavorite: boolean;
  favorited: boolean;
}) {
  const m = recipe.macros;
  const isEstimated = recipe.sourceName === "TheMealDB";

  return (
    <article className="meal-card">
      {showFavorite && <FavoriteButton recipeId={recipe.id} initialFavorited={favorited} />}
      {recipe.imageUrl && (
        <Image src={recipe.imageUrl} alt={recipe.name} width={600} height={450} />
      )}
      <div className="meal-card-body">
        <h3><Link href={`/recipes/${recipe.id}`}>{recipe.name}</Link></h3>
        <p className="meal-byline">by {recipe.author.username}</p>
        <dl>
          <div><dt>Calories</dt><dd>{m?.calories ?? "—"}</dd></div>
          <div><dt>Protein</dt><dd>{m?.protein != null ? `${m.protein} g` : "—"}</dd></div>
          <div><dt>Carbs</dt><dd>{m?.carbs != null ? `${m.carbs} g` : "—"}</dd></div>
          <div><dt>{isEstimated ? "Est. recipe cost" : "Cost"}</dt><dd>${recipe.cost.toFixed(2)}</dd></div>
          <div><dt>{isEstimated ? "Est. cook time" : "Cook time"}</dt><dd>{recipe.cookTime} min</dd></div>
          <div><dt>{isEstimated ? "Est. difficulty" : "Difficulty"}</dt><dd>{recipe.difficulty}</dd></div>
        </dl>
      </div>
    </article>
  );
}
