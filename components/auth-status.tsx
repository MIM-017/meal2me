import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { logOut } from "@/app/login/actions";

/** Top-right of the header: "Log in", or the signed-in user + "Log out". Render inside <Suspense>. */
export async function AuthStatus() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="auth-status">
        <Link href="/login" className="button-link">Log in</Link>
      </div>
    );
  }

  return (
    <div className="auth-status">
      <span className="auth-user">
        Signed in as <strong>{user.username}</strong>
      </span>
      <form action={logOut}>
        <button type="submit" className="secondary">Log out</button>
      </form>
    </div>
  );
}
