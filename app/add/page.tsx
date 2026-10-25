"use client";

import { useState, useActionState } from "react";
import type { Difficulty } from "@/lib/db";
import { addMealSystem, type AddMealState } from "./lib/addMeal";

export default function AddMealPage() {
  const [name, setName] = useState("");
  const [calories, setCalories] = useState("");
  const [cost, setCost] = useState("");
  const [cookTime, setCookTime] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [state, formAction, pending] = useActionState<AddMealState, FormData>(addMealSystem, null);

  return (
    <main className="panel">
      <h2>Add a meal</h2>
      <form action={formAction}>
        {state?.error && <p style={{ color: "#b00020" }}>{state.error}</p>}
        <div className="filters">
          <label>
            Name
            <input name="name" required value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            Calories
            <input required name="calories" type="number" min="0" value={calories} onChange={(e) => setCalories(e.target.value)} />
          </label>
          <label>
            Cost ($)
            <input required name="cost" type="number" min="0" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} />
          </label>
          <label>
            Cook time (min)
            <input required name="cookTime" type="number" min="1" value={cookTime} onChange={(e) => setCookTime(e.target.value)} />
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
            <select name="difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </label>
          <label>
            Photo (optional)
            <input name="image" type="file" accept="image/jpeg,image/png,image/webp" />
          </label>
        </div>
        <div className="actions">
          <button type="submit" disabled={pending}>{pending ? "Saving…" : "Save meal"}</button>
        </div>
      </form>
    </main>
  );
}