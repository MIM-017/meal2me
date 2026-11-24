import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { SearchBar } from "@/components/search-bar";
import TutorialPopup from "@/components/tutorial-popup";
import { getRandomMeals } from "@/app/lib/searchMeals";

// Shortcuts into the Filters page. Each one just pre-fills a filter in the URL.
const QUICK_PICKS = [
  { href: "/filters?maxCookTime=20", label: "⏱ Ready in 20 min" },
  { href: "/filters?maxDifficulty=easy", label: "🥄 Easy wins" },
  { href: "/filters?maxCost=10", label: "💰 Under $10" },
  { href: "/meals", label: "📖 Browse all recipes" },
];

async function HomeRecipes() {
  const initialResults = await getRandomMeals();
  return (
    <SearchBar
      initialResults={initialResults}
      intro={
        <>
          <span className="eyebrow">🌿 Home cooking, made simple</span>
          <h1 className="home-title">What&rsquo;s cooking <em>tonight?</em></h1>
          <p className="lede">Discover new cuisines and cozy everyday favorites, shared by home cooks like you.</p>
        </>
      }
      art={
        <div className="hero-art" aria-hidden="true">
          <Image className="plate plate-large" src="/images/spaghetti.jpg" alt="" width={540} height={540} preload />
          <Image className="plate plate-small" src="/images/oatmeal.jpg" alt="" width={380} height={380} />
          <p className="hero-sticker">⏱ Dinner in 20 min<small>Quick &amp; easy picks</small></p>
        </div>
      }
      quickPicks={
        <nav className="quick-picks" aria-label="Quick picks">
          {QUICK_PICKS.map((pick) => (
            <Link key={pick.href} href={pick.href} className="chip">{pick.label}</Link>
          ))}
        </nav>
      }
    />
  );
}

export default function Page() {
  return (
    <main className="home">
      <Suspense fallback={<p className="home-hint">Loading meals…</p>}>
        <HomeRecipes />
      </Suspense>
      <TutorialPopup />
    </main>
  );
}
