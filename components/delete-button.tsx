"use client";

import { useTransition, type MouseEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { deleteMeal } from "@/app/recipes/actions";

/** Only render it for a logged-in user. */
export function DeleteButton({ recipeId }: { recipeId: number }) {
  const [, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    startTransition(async () => {
      try {
        const result = await deleteMeal(recipeId);
        if (result.ok) { router.replace("/meals"); return; }
        // Session expired since the page loaded: log in, then come back here.
        if (result.error === "login") router.push(`/login?next=${encodeURIComponent(pathname)}`);
      } catch {
      }
    });
  }


  return (
    <button
      type="button"
      className="delete-button"
      onClick={handleClick}
      title="Delete Meal"
    >Delete Meal</button>
  );
}