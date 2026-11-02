import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AddMealForm } from "./add-meal-form";

async function AddMealGate() {
  // proxy.ts already bounces visitors with no session cookie. This catches
  // expired / logged-out cookies, and is the check that actually counts.
  if (!(await getCurrentUser())) redirect("/login?next=/add");
  return <AddMealForm />;
}

export default function AddMealPage() {
  return (
    <Suspense fallback={<p className="empty">Loading…</p>}>
      <AddMealGate />
    </Suspense>
  );
}
