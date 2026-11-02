import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getCurrentUser, safeNextPath } from "@/lib/auth";

async function LoginContent({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  const target = safeNextPath(Array.isArray(next) ? next[0] : next);
  if (await getCurrentUser()) redirect(target); // already logged in
  return <AuthForm mode="login" next={target} />;
}

export default function LoginPage(props: PageProps<"/login">) {
  return (
    // cacheComponents: reading searchParams + cookies must happen inside Suspense.
    <Suspense fallback={<p className="empty">Loading…</p>}>
      <LoginContent {...props} />
    </Suspense>
  );
}
