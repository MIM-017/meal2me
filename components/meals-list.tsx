import { getRequestDb, searchRecipes } from "@/lib/db";
import MealCard from "./meal-card-small";

export default async function MealList() {
    const db = await getRequestDb();
    const meals = searchRecipes(db).items;
    console.log(meals);

    return (
    <div className="meal-list">
        {meals.map((meal) => <MealCard meal={meal} key={meal.id}/>)}
    </div>
    );
}