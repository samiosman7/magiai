import "server-only";
import { getSupabaseAdmin, hasSupabaseConfig } from "@/lib/supabase/server";

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export function checkRateLimit({
  key,
  limit,
  windowMs,
}: {
  key: string;
  limit: number;
  windowMs: number;
}) {
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (current.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: current.resetAt };
  }

  current.count += 1;
  return { allowed: true, remaining: Math.max(0, limit - current.count), resetAt: current.resetAt };
}

export function rateLimitResponse(resetAt: number) {
  const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
  return Response.json(
    { error: "Too many requests. Please slow down and try again shortly.", retryAfter },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
      },
    }
  );
}

// Client IP from proxy headers (Vercel sets x-forwarded-for). Best-effort — an
// "unknown" bucket just means unresolved clients share one limit, which is fine.
export function getClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

// Durable fixed-window limiter backed by Supabase, so limits hold across
// serverless instances (the in-memory limiter is per-instance — too weak for
// brute-force protection on public endpoints). Fails OPEN if Supabase is
// unavailable or the table hasn't been created yet, so it never blocks legit
// traffic; the in-memory limiter is the guaranteed floor.
export async function checkRateLimitDurable({
  key,
  limit,
  windowMs,
}: {
  key: string;
  limit: number;
  windowMs: number;
}): Promise<{ allowed: boolean; resetAt: number }> {
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const resetAt = windowStart + windowMs;
  if (!hasSupabaseConfig()) return { allowed: true, resetAt };

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("magi_rate_limits")
      .select("count")
      .eq("bucket", key)
      .eq("window_start", windowStart)
      .maybeSingle();

    if (error) return { allowed: true, resetAt }; // table missing / read error → fail open
    const count = Number(data?.count ?? 0);
    if (count >= limit) return { allowed: false, resetAt };

    await supabase
      .from("magi_rate_limits")
      .upsert({ bucket: key, window_start: windowStart, count: count + 1 }, { onConflict: "bucket,window_start" });

    // Opportunistic cleanup of stale windows so the table stays small (no cron needed).
    if (Math.random() < 0.02) {
      await supabase.from("magi_rate_limits").delete().lt("window_start", now - 6 * 60 * 60 * 1000);
    }

    return { allowed: true, resetAt };
  } catch {
    return { allowed: true, resetAt };
  }
}

// One call to guard a public endpoint by IP: in-memory burst floor + durable
// cross-instance window. Returns a 429 Response to short-circuit, or null to proceed.
export async function guardByIp(
  request: Request,
  name: string,
  opts: { limit: number; windowMs: number }
): Promise<Response | null> {
  const ip = getClientIp(request);
  const key = `${name}:${ip}`;

  const mem = checkRateLimit({ key: `mem:${key}`, limit: opts.limit, windowMs: opts.windowMs });
  if (!mem.allowed) return rateLimitResponse(mem.resetAt);

  const durable = await checkRateLimitDurable({ key, limit: opts.limit, windowMs: opts.windowMs });
  if (!durable.allowed) return rateLimitResponse(durable.resetAt);

  return null;
}
