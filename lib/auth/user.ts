import "server-only";
import { getRequestSupabaseUser, hasSupabaseAuthConfig } from "@/lib/supabase/request";

export const fallbackUserId = "local-test-user";

export type RequestUser = {
  userId: string;
  email: string | null;
  // true only for a verified Supabase session; false for the anonymous operator fallback
  authenticated: boolean;
};

// Resolves who is calling. Order matters:
// 1. Verified Supabase session (cookie JWT checked against Supabase) — real account.
// 2. x-magi-user-id header — the browser-generated operator id. Spoofable, so it is
//    only acceptable while billing is off; requireAccount() below gates paid paths.
export async function getRequestUser(request: Request): Promise<RequestUser> {
  if (hasSupabaseAuthConfig()) {
    const user = await getRequestSupabaseUser(request);
    if (user) {
      return { userId: user.id, email: user.email ?? null, authenticated: true };
    }
  }

  const headerId = request.headers.get("x-magi-user-id")?.trim();
  if (headerId && isSafeUserId(headerId)) {
    return { userId: headerId, email: null, authenticated: false };
  }
  return { userId: fallbackUserId, email: null, authenticated: false };
}

// When billing is enforced, anonymous operator ids must not reach charge paths:
// credits attach to real accounts only.
export function accountRequired(user: RequestUser) {
  return process.env.MAGI_REQUIRE_BILLING === "true" && !user.authenticated;
}

function isSafeUserId(value: string) {
  return /^[a-zA-Z0-9:_-]{3,96}$/.test(value);
}
