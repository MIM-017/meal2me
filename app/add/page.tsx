"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useMeals } from "../meals-context";
import type { Difficulty } from "@/lib/meals";

export default function AddMealPage() {
  const { addMeal } = useMeals();
  const router = useRouter();
  const [name, setName] = useState("");
  const [calories, setCalories] = useState("");
  const [cost, setCost] = useState("");
  const [cookTime, setCookTime] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    addMeal({
      name: name.trim(),
      calories: Number(calories),
      cost: Number(cost),
      cookTime: Number(cookTime),
      difficulty,
    });
    router.push("/meals");
  }

  return (
    <main className="panel">
      <h2>Add a meal</h2>
      <form onSubmit={onSubmit}>
        <div className="filters">
          <label>
            Name
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label>
            Calories
            <input
              required
              type="number"
              min="0"
              value={calories}
              onChange={(event) => setCalories(event.target.value)}
            />
          </label>
          <label>
            Cost ($)
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={cost}
              onChange={(event) => setCost(event.target.value)}
            />
          </label>
          <label>
            Cook time (min)
            <input
              required
              type="number"
              min="0"
              value={cookTime}
              onChange={(event) => setCookTime(event.target.value)}
            />
          </label>
          <label>
            Difficulty
            <select
              value={difficulty}
              onChange={(event) =>
                setDifficulty(event.target.value as Difficulty)
              }
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </label>
        </div>
        <div className="actions">
          <button type="submit">Save meal</button>
        </div>
      </form>
    </main>
  );
}
