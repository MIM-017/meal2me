import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Meal2Me",
  description: "A simple prototype for recommending meals.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
          <div className="shell">
            <header>
              <nav className="site-navigation">
                <Image src="/logo.png" alt="Meal2Me" width={60} height={60}/>
                <Link href="/add">Add meal</Link>
                <Link href="/" className="site-logo">Meal2Me</Link>
                <Link href="/filters">Filters</Link>
                <Link href="/meals">All Recipes</Link>
              </nav>
            </header>
            {children}
          </div>
      </body>
    </html>
  );
}
