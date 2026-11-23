#!/usr/bin/env node
// Turn the API review draft into Meal2Me's validated recipe shape and attach
// transparent U.S. grocery and timing estimates for the imported recipes.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.resolve(process.argv[2] || path.join(root, "data/themealdb-draft.json"));
const target = path.resolve(process.argv[3] || path.join(root, "data/recipes.json"));
const raw = JSON.parse(await readFile(source, "utf8"));

// Approximate ingredient consumption cost, not full package checkout cost.
// These unit prices are rounded U.S. supermarket averages for budget brands.
const perGram = [
  [/salmon/, 0.030], [/shrimp|prawn/, 0.027], [/lamb|venison/, 0.024],
  [/steak|sirloin|rib.?eye/, 0.024], [/beef|veal/, 0.017],
  [/chicken|turkey|duck/, 0.012], [/pork|bacon|ham|sausage/, 0.015],
  [/fish|cod|tuna|anchov|sardine|mackerel/, 0.022],
  [/parmesan|pecorino/, 0.027], [/cheese|mozzarella|cheddar|feta|ricotta/, 0.019],
  [/butter/, 0.010], [/almond|walnut|cashew|pistachio|pecan|pine nut/, 0.022],
  [/chocolate|cocoa/, 0.018], [/coffee/, 0.025],
  [/flour|cornmeal|corn flour|starch/, 0.002], [/sugar|honey|syrup/, 0.004],
  [/rice|oat|couscous|bulgur|quinoa/, 0.005], [/pasta|noodle|spaghetti/, 0.004],
  [/bean|lentil|chickpea|pea\b/, 0.005], [/potato|yam|sweet potato/, 0.003],
  [/onion|shallot|garlic/, 0.004], [/tomato|pepper|carrot|cabbage|celery|courgette|zucchini|aubergine|eggplant/, 0.005],
  [/mushroom|asparagus|artichoke|avocado/, 0.010], [/apple|banana|orange|lemon|lime|berry|fruit|mango|pineapple/, 0.007],
  [/cream|yogurt|yoghurt|milk|sour cream/, 0.004],
];
const perMl = [
  [/oil/, 0.003], [/milk/, 0.0015], [/cream/, 0.0045], [/stock|broth/, 0.0018],
  [/juice/, 0.003], [/vinegar/, 0.003], [/wine|beer|liqueur/, 0.006], [/sauce|syrup/, 0.005],
];
const cupGrams = [
  [/flour|cornmeal|starch/, 125], [/sugar/, 200], [/rice/, 190], [/oat/, 90],
  [/pasta|noodle/, 100], [/cheese|mozzarella/, 110], [/nut/, 140],
  [/bean|lentil|chickpea|pea\b/, 180], [/oil/, 218], [/milk|cream|stock|broth|water|juice|vinegar|wine|sauce/, 240],
];
const eachCost = [
  [/egg/, 0.32], [/avocado/, 1.00], [/lemon|lime/, 0.55], [/onion/, 0.65],
  [/garlic/, 0.12], [/pepper|chilli|chili/, 0.75], [/tomato/, 0.55],
  [/apple|pear|orange|banana/, 0.55], [/potato/, 0.40], [/carrot/, 0.20],
  [/bread|roll|bun|tortilla/, 0.20], [/cheese/, 0.28], [/prawn|shrimp/, 0.40],
  [/bay leaf|clove|cardamom pod/, 0.04],
];
const specialIngredient = /saffron|truffle|vanilla pod|caviar|lobster|crab meat|wagyu/;
const fractions = { "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1/3, "⅔": 2/3, "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875 };

function numberValue(text) {
  const s = text.trim();
  const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  if (fractions[s] !== undefined) return fractions[s];
  const compact = s.match(/^(\d+)?([½¼¾⅓⅔⅛⅜⅝⅞])$/);
  if (compact) return Number(compact[1] || 0) + fractions[compact[2]];
  if (/^\d+\/\d+$/.test(s)) { const [a, b] = s.split("/").map(Number); return b ? a / b : 0; }
  return Number(s) || 0;
}

function parseMeasure(line) {
  const text = line.trim().toLowerCase().replace(/[–—]/g, "-");
  const quantityMatch = text.match(/^((?:\d+(?:\.\d+)?[½¼¾⅓⅔⅛⅜⅝⅞]?|[½¼¾⅓⅔⅛⅜⅝⅞])(?:\s+\d+\/\d+)?|(?:\d+\s+)?\d+\/\d+)\s*(.*)$/);
  if (!quantityMatch) return { amount: /to taste|for frying|as needed|pinch/i.test(text) ? 0.05 : 1, unit: "each", item: text };
  const amount = numberValue(quantityMatch[1]);
  let rest = quantityMatch[2].trim();
  const unitMatch = rest.match(/^(kilograms?|kgs?|kg|grams?|g|millilit(?:er|re)s?|ml|lit(?:er|re)s?|l|pounds?|lbs?|lb|ounces?|oz|cups?|tablespoons?|tbsp|tbs|tblsp|teaspoons?|tsp|pints?|quarts?|qt|cloves?|slices?|cans?|packets?|bunch(?:es)?|large|medium|small|whole|diced|chopped|sliced)\b\s*/);
  const unit = unitMatch ? unitMatch[1] : "each";
  if (unitMatch) rest = rest.slice(unitMatch[0].length).trim();
  rest = rest.replace(/^(of\s+)?(finely\s+|roughly\s+|chopped\s+|diced\s+|sliced\s+|crushed\s+|grated\s+|peeled\s+|fresh\s+|frozen\s+|dried\s+|ground\s+|large\s+|medium\s+|small\s+)+/i, "");
  return { amount: amount || 0.05, unit, item: rest };
}

function ingredientCost(line) {
  const { amount, unit, item } = parseMeasure(line);
  const name = item.toLowerCase();
  if (/^water\b/.test(name)) return 0;
  if (specialIngredient.test(name)) return Math.max(0.15, amount * 0.20);
  const price = perGram.find(([pattern]) => pattern.test(name))?.[1];
  const liquidPrice = perMl.find(([pattern]) => pattern.test(name))?.[1];
  const each = eachCost.find(([pattern]) => pattern.test(name))?.[1];
  if (/kg|kilogram/.test(unit)) return amount * 1000 * (price ?? 0.008);
  if (/^(g|gram)/.test(unit)) return amount * (price ?? 0.008);
  if (/^(lb|pound)/.test(unit)) return amount * 453.6 * (price ?? 0.008);
  if (/^(oz|ounce)/.test(unit)) return amount * 28.35 * (price ?? 0.008);
  if (/^(ml|millil)/.test(unit)) return amount * (liquidPrice ?? 0.004);
  if (/^(l|liter|litre)$/.test(unit)) return amount * 1000 * (liquidPrice ?? 0.004);
  if (/cup/.test(unit)) {
    if (liquidPrice) return amount * 240 * liquidPrice;
    const grams = cupGrams.find(([pattern]) => pattern.test(name))?.[1];
    return grams ? amount * grams * (price ?? 0.007) : amount * 240 * (liquidPrice ?? 0.004);
  }
  if (/^(tbsp|tbs|tblsp|tablespoon)/.test(unit)) {
    const grams = /butter/.test(name) ? 14 : /flour|starch/.test(name) ? 8 : /sugar/.test(name) ? 12 : /cheese|nut/.test(name) ? 10 : 6;
    return amount * (liquidPrice ? 15 * liquidPrice : price ? grams * price : 0.05);
  }
  if (/^(tsp|teaspoon)/.test(unit)) {
    const grams = /butter/.test(name) ? 4.7 : /flour|starch/.test(name) ? 2.7 : /sugar/.test(name) ? 4 : 2;
    return amount * (liquidPrice ? 5 * liquidPrice : price ? grams * price : 0.02);
  }
  if (/^(pint|quart|qt)/.test(unit)) return amount * (/quart|qt/.test(unit) ? 946 : 473) * (liquidPrice ?? 0.004);
  if (/^(can|packet)/.test(unit)) return amount * (name.includes("milk") ? 1.75 : name.includes("tomato") ? 1.25 : 1.50);
  if (/^(bunch)/.test(unit)) return amount * 1.25;
  if (/^(clove)/.test(unit)) return amount * (each ?? (name.includes("garlic") ? 0.12 : 0.18));
  if (/^(slice)/.test(unit)) return amount * (each ?? 0.18);
  if (/^(large|medium|small|whole)/.test(unit) || unit === "each") {
    const gramsPerItem = /chicken|turkey|duck|beef|pork|lamb|fish|salmon|cod/.test(name) ? 220 : 120;
    return amount * (each ?? (price ? gramsPerItem * price : liquidPrice ? 120 * liquidPrice : 0.45));
  }
  return Math.max(0.05, amount * (price ? 60 * price : liquidPrice ? 60 * liquidPrice : each ?? 0.45));
}

function estimateCost(ingredients) {
  const sum = ingredients.reduce((total, line) => total + ingredientCost(line), 0);
  // Small pantry staples and rounding buffer; do not use a zero-cost recipe.
  return Math.max(0.50, Math.min(10000, Math.round((sum * 1.08 + 0.20) * 100) / 100));
}

function estimateMinutes(notes, ingredients) {
  const text = notes.toLowerCase().replace(/\r/g, "\n");
  const durations = [];
  const durationRe = /(\d+(?:\.\d+)?)\s*(?:to|-|–)\s*(\d+(?:\.\d+)?)\s*(minutes?|mins?|hours?|hrs?)\b|(\d+(?:\.\d+)?)\s*(minutes?|mins?|hours?|hrs?)\b/g;
  for (const match of text.matchAll(durationRe)) {
    const before = text.slice(0, match.index);
    const sentence = before.slice(Math.max(before.lastIndexOf("."), before.lastIndexOf("!"), before.lastIndexOf("?"), before.lastIndexOf("\n")) + 1);
    // Resting, soaking, proofing, chilling, and marinating time is not hands-on
    // cooking time and varies too much to make a useful student-facing estimate.
    if (/\b(chill|rest|leave|let stand|stand|marinat\w*|soak|cool|refrigerat\w*|freez|proof|rise|set aside|overnight)\b/i.test(sentence)) continue;
    const low = Number(match[1] || match[4]);
    const high = Number(match[2] || match[4]);
    const unit = (match[3] || match[5]).startsWith("h") ? 60 : 1;
    durations.push(((low + high) / 2) * unit);
  }
  let minutes = durations.reduce((a, b) => a + b, 0);
  if (/no time|not specified/.test(text)) minutes = 0;
  const steps = text.split(/\bstep\s*\d+\b|\n+/).filter((s) => s.trim()).length;
  const prep = Math.max(8, Math.min(30, ingredients.length * 1.5 + steps * 1.25));
  if (minutes === 0) minutes = prep + 10;
  else minutes += prep;
  return Math.max(5, Math.min(600, Math.round(minutes / 5) * 5));
}

function cleanInstructions(value) {
  return value
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/^\s*(?:step|part)\s*#?\s*\d+\s*[:.)-]?\s*$/gim, "")
    .replace(/^\s*(?:step|part)\s*#?\s*\d+\s*[:.)-]\s*/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function estimateDifficulty(notes, ingredients, minutes) {
  const text = notes.toLowerCase();
  const steps = text.split(/\bstep\s*\d+\b|\n+/).filter((s) => s.trim()).length;
  // Ingredient lists often count every spice and garnish separately. Treat
  // those as planning effort, not cooking skill; reserve hard for techniques
  // that are genuinely tricky or recipes with unusually involved directions.
  const advanced = /temper(?:ing)? chocolate|laminat\w*|sous.?vide|flamb[eé]|confit|candy thermometer|make a roux|deep.?fry/.test(text);
  const manyDetailedSteps = steps >= 16 && ingredients.length >= 12;
  const unusuallyLargeRecipe = ingredients.length >= 20 && steps >= 10;
  if (advanced || manyDetailedSteps || unusuallyLargeRecipe) return "hard";
  if (ingredients.length >= 10 || steps >= 8 || minutes > 75) return "medium";
  return "easy";
}

const recipes = raw.map((meal) => {
  const ingredients = meal.ingredients.filter(Boolean);
  const cookTime = estimateMinutes(meal.notes || "", ingredients);
  return {
    name: meal.name,
    ingredients,
    cookTime,
    difficulty: estimateDifficulty(meal.notes || "", ingredients, cookTime),
    cost: estimateCost(ingredients),
    notes: cleanInstructions(meal.notes || ""),
    macros: null,
    imageUrl: meal.imageUrl || null,
    sourceName: "TheMealDB",
    sourceUrl: meal.sourceUrl,
  };
});

await writeFile(target, `${JSON.stringify(recipes, null, 2)}\n`);
console.log(`Prepared ${recipes.length} recipes with estimated total cost and cook time: ${path.relative(root, target)}`);
