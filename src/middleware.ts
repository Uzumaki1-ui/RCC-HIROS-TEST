// ═══════════════════════════════════════════════════════════════
// RCC-HIROS — Next.js Middleware
// Simple gate: allows public paths (/login, /api/auth/login) and
// lets everything else pass through. Auth enforcement happens at
// the API route level (requireAuth/requirePermission) and on the
// client via AuthProvider (token presence + /api/auth/me).
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";

export const PUBLIC_PATHS = ["/login", "/api/auth/login"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public paths always pass through (no token check).
  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  // Everything else also passes through. Auth is enforced by API routes
  // (server-side via requireAuth/requirePermission) and by AuthProvider
  // (client-side via token presence + /api/auth/me).
  return NextResponse.next();
}

export const config = {
  // Run on every route except Next.js internals & static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
