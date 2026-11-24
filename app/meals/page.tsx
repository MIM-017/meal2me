import { MealCardContent } from "../../components/meal-card";
import { getCurrentUser } from "@/lib/auth";
import { getFavoriteIds, getRequestDb, searchRecipes } from "@/lib/db";

export default async function MealsPage() {
  const db = await getRequestDb();
  const user = await getCurrentUser();
  const favoriteIds = user ? getFavoriteIds(db, user.id) : null;
  const firstPage = searchRecipes(db, { pageSize: 50 });
  const recipes = [
    ...firstPage.items,
    ...Array.from({ length: Math.max(0, firstPage.totalPages - 1) }, (_, index) =>
      searchRecipes(db, { page: index + 2, pageSize: 50 }).items,
    ).flat(),
  ];

  return (
    <main>
      <h2>Meal directory</h2>
      <p className="empty">{firstPage.total} meals in the catalog.</p>
      <div className="meal-list">
        {recipes.slice(0, 12).map((recipe) => (
          <MealCardContent key={recipe.id} recipe={recipe} showFavorite={!!user} favorited={favoriteIds?.has(recipe.id) ?? false} />
        ))}
      </div>
      {recipes.length > 12 && (
        <details className="meal-directory-more">
          <summary>Show remaining meals ({recipes.length - 12})</summary>
          <div className="meal-list">
            {recipes.slice(12).map((recipe) => (
              <MealCardContent key={recipe.id} recipe={recipe} showFavorite={!!user} favorited={favoriteIds?.has(recipe.id) ?? false} />
            ))}
          </div>
        </details>
      )}
    </main>
  );
}
