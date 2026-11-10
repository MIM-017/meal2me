"use client";

import { useState, useTransition, type MouseEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { setFavorite } from "@/app/favorites/actions";

/** Star in the top-right of a meal. Only render it for a logged-in user. */
export function FavoriteButton({ recipeId, initialFavorited }: { recipeId: number; initialFavorited: boolean }) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    const next = !favorited;
    setFavorited(next); // show the change immediately; undone below if the save fails

    startTransition(async () => {
      try {
        const result = await setFavorite(recipeId, next);
        if (result.ok) return;
        setFavorited(!next);
        // Session expired since the page loaded: log in, then come back here.
        if (result.error === "login") router.push(`/login?next=${encodeURIComponent(pathname)}`);
      } catch {
        setFavorited(!next); // network or server error
      }
    });
  }

  const label = favorited ? "Remove from favorites" : "Add to favorites";

  return (
    <button
      type="button"
      className="favorite-button"
      onClick={handleClick}
      aria-pressed={favorited}
      aria-label={label}
      title={label}
    >
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <path d="M12 2.8l2.83 5.73 6.33.92-4.58 4.46 1.08 6.3L12 17.24l-5.66 2.97 1.08-6.3-4.58-4.46 6.33-.92z" />
      </svg>
    </button>
  );
}