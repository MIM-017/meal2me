import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getRequestDb, listFavorites } from "@/lib/db";
import { MealCard } from "@/components/meal-card";

async function FavoritesContent() {
  // The list is looked up by the session's user id, never by anything in the
  // URL, so each user can only ever see their own favorites.
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/favorites");

  const favorites = listFavorites(await getRequestDb(), user.id);

  return (
    <>
      <h2>Your favorites</h2>
      {favorites.length === 0 ? (
        <p className="empty">
          You haven&rsquo;t favorited any meals yet. Click the ☆ on a meal to add it here.{" "}
          <Link href="/">Browse meals</Link>
        </p>
      ) : (
        <>
          <p className="empty">
            {favorites.length} favorite {favorites.length === 1 ? "meal" : "meals"}.
          </p>
          <div className="meal-list">
            {favorites.map((recipe) => (
              <MealCard key={recipe.id} recipeID={recipe.id} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

export default function FavoritesPage() {
  return (
    <main>
      {/* cacheComponents: reading cookies + the database must happen inside Suspense. */}
      <Suspense fallback={<p className="empty">Loading favorites…</p>}>
        <FavoritesContent />
      </Suspense>
    </main>
  );
}