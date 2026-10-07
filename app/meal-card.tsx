import {
  formatCookTime,
  formatCost,
  type Meal,
} from "@/lib/meals";

export function MealCard({ meal }: { meal: Meal }) {
  return (
    <article className="meal-card">
      <h3>{meal.name}</h3>
      <dl>
        <div>
          <dt>Calories</dt>
          <dd>{meal.calories}</dd>
        </div>
        <div>
          <dt>Cost</dt>
          <dd>{formatCost(meal.cost)}</dd>
        </div>
        <div>
          <dt>Cook time</dt>
          <dd>{formatCookTime(meal.cookTime)}</dd>
        </div>
        <div>
          <dt>Difficulty</dt>
          <dd>{meal.difficulty}</dd>
        </div>
      </dl>
    </article>
  );
}
