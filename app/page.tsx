import { SearchBar } from "@/components/search-bar";
import TutorialPopup from "@/components/tutorial-popup";

export default function Page() {
  return (
    <main className="home">
      <h1 className="home-title">~ Discover new Cuisines ~</h1>
      <SearchBar />
      <TutorialPopup />
    </main>
  );
}