"use client";

import { useActionState } from "react";
import Link from "next/link";
import { logIn, signUp, type AuthFormState } from "@/app/login/actions";

// Same limits as lib/db/validation.ts (not imported: that module is server-only).
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;

export function AuthForm({ mode, next }: { mode: "login" | "signup"; next: string }) {
  const isLogin = mode === "login";
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(isLogin ? logIn : signUp, null);
  const otherHref = `${isLogin ? "/signup" : "/login"}${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`;

  return (
    <main className="panel auth-panel">
      <h2>{isLogin ? "Log in" : "Create an account"}</h2>
      <form action={formAction} className="auth-form">
        <input type="hidden" name="next" value={next} />
        {state?.error && (
          <p className="form-error" role="alert">
            {state.error}
          </p>
        )}
        <label>
          Email
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            defaultValue={state?.values.email}
            key={`email-${state?.values.email ?? ""}`}
          />
        </label>
        <label>
          Username
          <input
            name="username"
            autoComplete="username"
            required
            minLength={3}
            maxLength={30}
            pattern="[A-Za-z0-9_.\-]+"
            title="Letters, digits, _ . or -"
            defaultValue={state?.values.username}
            key={`username-${state?.values.username ?? ""}`}
          />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            autoComplete={isLogin ? "current-password" : "new-password"}
            required
            minLength={isLogin ? undefined : PASSWORD_MIN}
            maxLength={PASSWORD_MAX}
          />
        </label>
        {!isLogin && (
          <label>
            Confirm password
            <input name="confirmPassword" type="password" autoComplete="new-password" required maxLength={PASSWORD_MAX} />
          </label>
        )}
        <div className="actions">
          <button type="submit" disabled={pending}>
            {pending ? (isLogin ? "Logging in…" : "Creating account…") : isLogin ? "Log in" : "Sign up"}
          </button>
        </div>
      </form>
      <p className="auth-switch">
        {isLogin ? "No account yet? " : "Already have an account? "}
        <Link href={otherHref}>{isLogin ? "Sign up" : "Log in"}</Link>
      </p>
    </main>
  );
}
