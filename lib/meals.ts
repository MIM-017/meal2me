export type Difficulty = "easy" | "medium" | "hard";

export type Meal = {
  id: string;
  name: string;
  calories: number;
  cost: number;
  cookTime: number;
  difficulty: Difficulty;
};

export const DIFFICULTY_RANK: Record<Difficulty, number> = {
  easy: 1,
  medium: 2,
  hard: 3,
};

export const seedMeals: Meal[] = [
  {
    id: "oatmeal",
    name: "Overnight oats",
    calories: 320,
    cost: 1.5,
    cookTime: 10,
    difficulty: "easy",
  },
  {
    id: "veggie-stir-fry",
    name: "Veggie stir-fry",
    calories: 410,
    cost: 6,
    cookTime: 25,
    difficulty: "easy",
  },
  {
    id: "chicken-rice",
    name: "Chicken and rice bowl",
    calories: 560,
    cost: 8,
    cookTime: 40,
    difficulty: "medium",
  },
  {
    id: "salmon",
    name: "Baked salmon and potatoes",
    calories: 620,
    cost: 14,
    cookTime: 35,
    difficulty: "medium",
  },
  {
    id: "lasagna",
    name: "Vegetable lasagna",
    calories: 740,
    cost: 12,
    cookTime: 90,
    difficulty: "hard",
  },
];

export function formatCost(cost: number) {
  return `$${cost.toFixed(2)}`;
}

export function formatCookTime(minutes: number) {
  return `${minutes} min`;
}
