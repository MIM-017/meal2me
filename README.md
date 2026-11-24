Meal2Me is a recipe catalog for students. Recipe cost, cook time, and difficulty are required; TheMealDB catalog values are estimates and are labeled as such.

## Getting Started

Install dependencies and run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Curating recipes from TheMealDB

The importer calls TheMealDB's official API and writes a local draft. It does not write to SQLite:

```bash
npm run pull:themealdb -- 150
```

`npm run prepare:recipes` turns the draft into the ready-to-seed `data/recipes.json` file and adds estimates. The importer chooses a stable cross-section of meals rather than the first 150 alphabetically.

The cost estimate uses listed ingredient quantities and rounded budget-brand U.S. grocery prices to estimate the **total cost of the recipe**, not per serving. Cook time uses active durations in the directions plus estimated prep time; chilling, marinating, and other inactive waits are excluded. Difficulty is estimated from ingredient count, instructions, and techniques. Actual costs, serving sizes, and cook times vary, so the app labels all three fields as estimates. U.S. food-at-home prices increased 2.3% in 2025 versus 2024, according to [USDA ERS](https://www.ers.usda.gov/data-products/chart-gallery/76961).

The catalog in `data/recipes.json` is automatically seeded into SQLite the first time the app reads its database. To manually validate and import a prepared catalog (or refresh the local database), run `npm run seed:recipes`; the command reports validation errors before writing, saves recipes under `meal2me-curated`, and refreshes existing curated directions and difficulty while preserving nutrition values. Home search and “Surprise me!” use that curated catalog; the home page shows 20 at a time with **Show more**. The Favorites page includes all recipes the user favorited, including their own recipes.

The Meal directory lists the full curated catalog. Difficulty uses a novice-focused estimate: ingredient count alone no longer makes a meal hard. The current 150 recipes are rated 46 easy, 91 medium, and 13 hard.

An individual recipe may also be added using the existing Add meal page, with optional source name and HTTPS source link. Its source appears on the recipe page.

Before publishing an app or using TheMealDB artwork publicly, check its [current API guide](https://themealdb.com/docs_api_guide.php) and [terms of use](https://themealdb.com/terms_of_use.php). The terms currently require paid supporter access for published apps, require source credit for paid API use, and prohibit use of third-party content without permission or another legal basis. This importer is not legal advice or a substitute for reviewing the content and terms.

## Database migrations

Migration 6 adds optional `source_name` and `source_url` fields. Existing recipes are preserved. Cost, cook time, and difficulty remain required.

## Owner-maintained nutrition values

Nutrition fields are not estimated for TheMealDB recipes. To enter or correct them yourself, open `data/recipes.db` with a SQLite database editor and update the `calories`, `protein_g`, and `carbs_g` columns in the `recipes` table. These fields represent totals for the full recipe. The catalog refresh updates imported directions and difficulty but leaves these nutrition columns untouched. There is no visitor-facing recipe-edit feature.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
