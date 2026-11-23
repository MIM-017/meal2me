import { MealSearchResult } from "@/app/lib/searchMeals";
import Image from "next/image";
import Link from "next/link";
import { FavoriteButton } from "./favorite-button";

export default function MealCard({ meal }: { meal: MealSearchResult}) {

    return (
        <article className="meal-card">
            {meal.favorited !== null && (
                <FavoriteButton recipeId={meal.id} initialFavorited={meal.favorited} />
            )}
            {meal.imageUrl ?
            <Image src={meal.imageUrl} alt={meal.name}
            width={600}
            height={450}/> : null}

            <div className="meal-card-body">
                <h3 className="meal-name">
                    <Link href={`/recipes/${meal.id}`}>{meal.name}</Link>
                </h3>
                <p className="meal-byline">by {meal.author}</p>
                <ul className="meal-tags" aria-label="Recipe details">
                    <li>⏱ {meal.cookTime} min</li>
                    <li className="tag-herb">{meal.difficulty}</li>
                    <li>${meal.cost.toFixed(2)}</li>
                </ul>
            </div>
        </article>
    );
}