"use client";

import { useState } from "react";
import type { Difficulty } from "@/lib/db";
import { addMealSystem } from "./lib/addMeal";

export default function AddMealPage() {
  const [name, setName] = useState("");
  const [calories, setCalories] = useState("");
  const [cost, setCost] = useState("");
  const [cookTime, setCookTime] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");

  return (
    <main className="panel">
      <h2>Add a meal</h2>
      <form action={addMealSystem}>
        <div className="filters">
          <label>
            Name
            <input
              name="name"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label>
            Calories
            <input
              required
              name="calories"
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
              name="cost"
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
              name="cookTime"
              type="number"
              min="0"
              value={cookTime}
              onChange={(event) => setCookTime(event.target.value)}
            />
          </label>
          <label>
            Proteins
            <input required name="proteins" type="number" min="0" />
          </label>
          <label>
            Carbs
            <input required name="carbs" type="number" min="0" />
          </label>
          <label>
            Difficulty
            <select
              name="difficulty"
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
          <label>
            Image
            <select name="imageUrl" defaultValue="">
              <option value="">No image</option>
              <option value="/images/oatmeal.jpg">Overnight oats</option>
              <option value="/images/spaghetti.jpg">Spaghetti</option>
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