import { guardByIp } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  // Brute-force guard on the beta gate: 10 attempts per IP per 10 minutes.
  const blocked = await guardByIp(request, "access", { limit: 10, windowMs: 10 * 60 * 1000 });
  if (blocked) return blocked;

  const body = (await request.json().catch(() => null)) as { code?: unknown } | null;
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  const expected = process.env.MAGI_BETA_CODE;

  if (!expected || code !== expected) {
    return Response.json({ ok: false, error: "Invalid access code." }, { status: 401 });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      // 30-day httpOnly cookie; the middleware checks it on /console and /api/magi.
      "Set-Cookie": `magi_access=${encodeURIComponent(code)}; HttpOnly; Path=/; Max-Age=2592000; SameSite=Lax`,
    },
  });
}
