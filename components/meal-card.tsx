import {
  getRecipe,
  Recipe,
  getRequestDb
} from "@/lib/db";

export async function MealCard({ recipeID }: { recipeID: unknown }) {
  const recipe: Recipe = getRecipe(await getRequestDb(), recipeID);

  return (
      <article className="meal-card">
        <h3>{recipe.name}</h3>
        <dl>
          <div>
            <dt>Calories</dt>
            <dd>{recipe.macros?.calories}</dd>
          </div>
          <div>
            <dt>Cost</dt>
            <dd>{recipe.cost}</dd>
          </div>
          <div>
            <dt>Cook time</dt>
            <dd>{recipe.cookTime}</dd>
          </div>
          <div>
            <dt>Difficulty</dt>
            <dd>{recipe.difficulty}</dd>
          </div>
        </dl>
      </article>
  );
}
