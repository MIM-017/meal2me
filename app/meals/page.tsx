import { MealCard } from "../../components/meal-card";
import { getRequestDb, searchRecipes } from "@/lib/db";

export default async function MealsPage() {
  const recipes = searchRecipes(await getRequestDb());

  return (
    <main>
      <h2>Meal directory</h2>
      <p className="empty">{recipes.total} meals in the catalog.</p>
      <div className="meal-list">
        {recipes.items.map((recipe) => (
            <MealCard key={recipe.id} recipeID={recipe.id} />
        ))}
      </div>
    </main>
  );
}
