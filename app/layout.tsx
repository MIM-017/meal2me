import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import "./globals.css";
import "./theme.css";
import Image from "next/image";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthStatus } from "@/components/auth-status";

export const metadata: Metadata = {
  title: "Meal2Me",
  description: "A simple prototype for recommending meals.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("theme");if(t)document.documentElement.setAttribute("data-theme",t)}catch(e){}`,
          }}
        />
      </head>
      <body>
        <div className="shell">
          <header className="site-header">
            <nav className="site-navigation">
              <Image src="/logo.png" alt="Meal2Me" width={60} height={60} />
              <Link href="/" className="site-logo">Meal2Me</Link>
              <Link href="/add">Add meal</Link>
              <Link href="/filters">Filters</Link>
              <Link href="/meals">All Recipes</Link>
              <ThemeToggle />
            </nav>
            {/* Reads the session cookie, so it streams in; the rest of the page doesn't wait. */}
                        <Suspense fallback={<div className="auth-status" aria-hidden="true" />}>
              <AuthStatus />
            </Suspense>
            <Link href="/favorites" className="favorites-link">★ Favorites</Link>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}