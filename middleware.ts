import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Beta access gate: locks /console and the run API behind an access code.
// Set MAGI_BETA_CODE to enable. Unset = open (local dev). Approved waitlist users
// get the code; they enter it once at /access and a cookie keeps them in.
export function middleware(req: NextRequest) {
  const code = process.env.MAGI_BETA_CODE;
  if (!code) return NextResponse.next();

  if (req.cookies.get("magi_access")?.value === code) return NextResponse.next();

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Beta access code required." }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = "/access";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/console", "/console/:path*", "/api/magi"],
};
