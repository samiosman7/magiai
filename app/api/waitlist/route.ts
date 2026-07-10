import { getSupabaseAdmin, hasSupabaseConfig } from "@/lib/supabase/server";
import { guardByIp } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  // Anti-spam: 8 signups per IP per hour.
  const blocked = await guardByIp(request, "waitlist", { limit: 8, windowMs: 60 * 60 * 1000 });
  if (blocked) return blocked;

  const body = (await request.json().catch(() => null)) as { email?: unknown; source?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const source = typeof body?.source === "string" ? body.source.slice(0, 80) : "landing";

  if (!email || !EMAIL_RE.test(email) || email.length > 254) {
    return Response.json({ ok: false, error: "Enter a valid email address." }, { status: 400 });
  }

  // No Supabase yet: accept so the page is demoable, but tell the owner it wasn't stored.
  if (!hasSupabaseConfig()) {
    console.warn(`[waitlist] not persisted (Supabase not configured): ${email}`);
    return Response.json({ ok: true, stored: false });
  }

  try {
    const supabase = getSupabaseAdmin();
    const referrer = request.headers.get("referer")?.slice(0, 300) ?? null;
    const { error } = await supabase
      .from("magi_waitlist")
      .insert({ email, source, referrer });

    // Unique-violation = already signed up. Treat as success, don't leak details.
    if (error && error.code !== "23505") {
      console.error("[waitlist] insert failed:", error.message);
      return Response.json({ ok: false, error: "Could not join right now. Try again shortly." }, { status: 500 });
    }

    return Response.json({ ok: true, stored: true, alreadyOnList: error?.code === "23505" });
  } catch (err) {
    console.error("[waitlist] error:", (err as Error).message);
    return Response.json({ ok: false, error: "Could not join right now. Try again shortly." }, { status: 500 });
  }
}
