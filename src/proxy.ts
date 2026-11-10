import { NextResponse, type NextRequest } from "next/server";
import { RequestLimit } from "@/lib/auth/login-limits";
import { SESSION_COOKIE_NAME } from "@/lib/auth/cookie-name";

// This request gate has independent state from the server-action verification gate.
const loginRequests = new RequestLimit();

// Per-request nonce so the CSP can avoid 'unsafe-inline' for scripts. Next.js
// picks the nonce up from the request CSP header and applies it to its own
// inline scripts. Inline *styles* stay allowed: Radix/shadcn set style attrs.
function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

function withSecurityHeaders(request: NextRequest): NextResponse {
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

// Optimistic auth gate: only checks that a session cookie exists (this runs
// before Node.js code, so no DB access). Real validation happens in the
// server components and actions via getCurrentSession().
export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    (pathname === "/login" || request.headers.has("next-action")) &&
    request.method === "POST" &&
    !loginRequests.consume()
  ) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  const isPublicPage = pathname === "/login";
  const isHealthCheck = pathname === "/api/health"; // used by the Docker healthcheck
  if (isPublicPage || isHealthCheck) {
    return withSecurityHeaders(request);
  }

  if (request.cookies.has(SESSION_COOKIE_NAME)) {
    return withSecurityHeaders(request);
  }

  if (pathname.startsWith("/api")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  // Everything except Next.js internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
