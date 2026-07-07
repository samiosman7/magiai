import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Two jobs, in order:
// 1. Refresh the Supabase session cookie if it expired (route handlers read it
//    but never write, so middleware is the only place tokens get renewed).
// 2. Beta access gate: MAGI_BETA_CODE locks /console and the run API. Unset = open.
export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (supabaseUrl && anonKey) {
    const supabase = createServerClient(supabaseUrl, anonKey, {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookies) {
          cookies.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          cookies.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        },
      },
    });
    // Triggers a token refresh when needed; result is intentionally unused here —
    // per-route code decides what anonymous callers may do.
    await supabase.auth.getUser();
  }

  const code = process.env.MAGI_BETA_CODE;
  if (!code) return res;

  // Auth pages stay reachable without the beta cookie — a magic link must never
  // bounce to /access and lose its token. The gate protects /console and the run API.
  const path = req.nextUrl.pathname;
  if (path === "/login" || path.startsWith("/auth/")) return res;

  if (req.cookies.get("magi_access")?.value === code) return res;

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Beta access code required." }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = "/access";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/console", "/console/:path*", "/api/magi", "/login", "/auth/callback"],
};
