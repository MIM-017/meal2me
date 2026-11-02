import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getCurrentUser, safeNextPath } from "@/lib/auth";

async function SignupContent({ searchParams }: PageProps<"/signup">) {
  const { next } = await searchParams;
  const target = safeNextPath(Array.isArray(next) ? next[0] : next);
  if (await getCurrentUser()) redirect(target); // already logged in
  return <AuthForm mode="signup" next={target} />;
}

export default function SignupPage(props: PageProps<"/signup">) {
  return (
    <Suspense fallback={<p className="empty">Loading…</p>}>
      <SignupContent {...props} />
    </Suspense>
  );
}
