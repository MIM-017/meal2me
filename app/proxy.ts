import { NextResponse, type NextRequest } from "next/server";
 
// Keep in sync with SESSION_COOKIE in lib/auth.ts. (Not imported: that file
// pulls in the database, which the proxy shouldn't load.)
const SESSION_COOKIE = "meal2me_session";
 
/**
 * Optimistic check only: no session cookie at all -> straight to the login
 * page, before any rendering. Whether the cookie is still VALID is checked
 * against the database by the page and by the server action itself.
 */
export function proxy(request: NextRequest) {
  if (!request.cookies.has(SESSION_COOKIE)) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}
 
export const config = {
  // Pages that need a logged-in user. Everything else stays public.
    matcher: ["/add/:path*", "/favorites/:path*"],
};