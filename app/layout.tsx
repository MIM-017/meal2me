import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import "@fontsource-variable/fraunces/soft.css";
import "@fontsource-variable/fraunces/soft-italic.css";
import "@fontsource-variable/nunito/index.css";
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
        <header className="site-header">
          <div className="header-inner">
            <Link href="/" className="brand">
              <span className="logo-badge">
                <Image src="/logo.png" alt="" width={40} height={40} />
              </span>
              <span className="site-logo">Meal2Me</span>
            </Link>
            <nav className="site-navigation">
              <Link href="/add">Add meal</Link>
              <Link href="/filters">Filters</Link>
              <Link href="/meals">All Recipes</Link>
              <Link href="/favorites" className="favorites-link">★ Favorites</Link>
            </nav>
            <div className="header-actions">
              <Suspense fallback={<div className="auth-status" aria-hidden="true" />}>
                <AuthStatus />
              </Suspense>
              <ThemeToggle />
            </div>
          </div>
        </header>
        <div className="shell">
          {children}
          <footer className="site-footer">
            <strong>Meal2Me</strong>
            <span>Made for home cooks · Happy cooking! 🍲</span>
            <span>Recipe data and artwork credited to <a href="https://www.themealdb.com/" target="_blank" rel="noreferrer">TheMealDB</a> where applicable.</span>
          </footer>
        </div>
      </body>
    </html>
  );
}
