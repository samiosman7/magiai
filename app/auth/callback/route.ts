import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const otpTypes = new Set(["email", "signup", "magiclink", "recovery", "invite", "email_change"]);

// Magic-link / email-confirmation landing. Supabase redirects here with either a
// PKCE ?code= or a ?token_hash=&type= pair depending on flow; both end in a session
// cookie and a redirect to the console.
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const fail = (message: string) =>
    NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(message)}`, url.origin));

  if (!supabaseUrl || !anonKey) return fail("Auth is not configured.");

  const response = NextResponse.redirect(new URL("/console", url.origin));
  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookies) {
        cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return fail(error.message);
    return response;
  }

  if (tokenHash && type && otpTypes.has(type)) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as EmailOtpType,
    });
    if (error) return fail(error.message);
    return response;
  }

  return fail("Sign-in link was missing its token. Request a new one.");
}
