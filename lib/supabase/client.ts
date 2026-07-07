"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

// Browser Supabase client (anon key). Sessions are stored in cookies so the
// server can read them on API routes. Returns null when auth isn't configured
// so the app still works in local/mock setups without keys.
export function getSupabaseBrowser(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  if (!browserClient) {
    browserClient = createBrowserClient(url, anonKey);
  }
  return browserClient;
}
