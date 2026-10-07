"use client";

import { MealCard } from "../meal-card";
import { useMeals } from "../meals-context";

export default function MealsPage() {
  const { meals } = useMeals();

  return (
    <main>
      <h2>Meal directory</h2>
      <p className="empty">{meals.length} meals in the catalog.</p>
      <div className="meal-list">
        {meals.map((meal) => (
          <MealCard key={meal.id} meal={meal} />
        ))}
      </div>
    </main>
  );
}
