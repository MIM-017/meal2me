import type { Metadata } from "next";
import Link from "next/link";
import { MealsProvider } from "./meals-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "Meal2Me",
  description: "A simple prototype for recommending meals.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <MealsProvider>
          <div className="shell">
            <header className="site-header">
              <div>
                <h1>Meal2Me</h1>
                <p>Find a meal by calories, cost, time, and difficulty.</p>
              </div>
              <nav>
                <Link href="/">Recommend</Link>
                <Link href="/meals">Directory</Link>
                <Link href="/add">Add meal</Link>
              </nav>
            </header>
            {children}
          </div>
        </MealsProvider>
      </body>
    </html>
  );
}
