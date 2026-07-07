import "server-only";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";

export function hasSupabaseAuthConfig() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

// Supabase client bound to a plain Request's cookies (read-only). Route handlers
// use this to verify who is calling; cookie refresh happens in middleware.
export function getSupabaseFromRequest(request: Request): SupabaseClient | null {
  if (!hasSupabaseAuthConfig()) return null;

  const cookieHeader = request.headers.get("cookie") ?? "";
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return parseCookieHeader(cookieHeader);
        },
        setAll() {
          // Read-only in route handlers; middleware owns token refresh.
        },
      },
    }
  );
}

// Verified Supabase user for this request, or null (no session / auth not configured).
// Uses getUser(), which validates the JWT against Supabase, not just the cookie.
export async function getRequestSupabaseUser(request: Request): Promise<User | null> {
  const supabase = getSupabaseFromRequest(request);
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) return null;
    return data.user;
  } catch {
    return null;
  }
}

function parseCookieHeader(header: string): Array<{ name: string; value: string }> {
  if (!header) return [];
  return header
    .split(";")
    .map((part) => {
      const eq = part.indexOf("=");
      if (eq === -1) return null;
      const name = part.slice(0, eq).trim();
      const value = part.slice(eq + 1).trim();
      if (!name) return null;
      try {
        return { name, value: decodeURIComponent(value) };
      } catch {
        return { name, value };
      }
    })
    .filter((c): c is { name: string; value: string } => c !== null);
}
