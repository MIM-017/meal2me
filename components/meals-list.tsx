import MealCard from "./meal-card-small";
import { MealSearchResult } from "@/app/lib/searchMeals";

export default function MealList({ items }: { items: MealSearchResult[] }) {

    return (
    <div className="meal-list">
        {items.map((meal) => <MealCard meal={meal} key={meal.id}/>)}
    </div>
    );
}