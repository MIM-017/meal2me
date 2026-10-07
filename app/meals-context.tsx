"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { seedMeals, type Meal } from "@/lib/meals";

const STORAGE_KEY = "meal2me-meals";

type MealsContextValue = {
  meals: Meal[];
  addMeal: (meal: Omit<Meal, "id">) => void;
};

const MealsContext = createContext<MealsContextValue | null>(null);

export function MealsProvider({ children }: { children: ReactNode }) {
  const [meals, setMeals] = useState<Meal[]>(seedMeals);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Meal[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMeals(parsed);
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) {
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(meals));
  }, [meals, ready]);

  const value = useMemo(
    () => ({
      meals,
      addMeal(meal: Omit<Meal, "id">) {
        setMeals((current) => [
          ...current,
          { ...meal, id: `${meal.name}-${Date.now()}` },
        ]);
      },
    }),
    [meals],
  );

  return (
    <MealsContext.Provider value={value}>{children}</MealsContext.Provider>
  );
}

export function useMeals() {
  const context = useContext(MealsContext);
  if (!context) {
    throw new Error("useMeals must be used inside MealsProvider");
  }
  return context;
}
