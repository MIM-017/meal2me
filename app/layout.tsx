import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import "./theme.css";
import Image from "next/image";
import { ThemeToggle } from "@/components/theme-toggle";

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
          <header>
            <nav className="site-navigation">
              <Image src="/logo.png" alt="Meal2Me" width={60} height={60} />
              <Link href="/add">Add meal</Link>
              <Link href="/" className="site-logo">Meal2Me</Link>
              <Link href="/filters">Filters</Link>
              <Link href="/meals">All Recipes</Link>
              <ThemeToggle />
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}