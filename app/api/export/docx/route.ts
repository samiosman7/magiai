import { getRequestUser } from "@/lib/auth/user";
import { buildDocx } from "@/lib/export/docx";
import { checkRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Turn a MAGI deliverable into a real Word document — the answer as a file you
// hand to someone, not a chat bubble you reformat.
export async function POST(request: Request) {
  const { userId } = await getRequestUser(request);
  const rateLimit = checkRateLimit({
    key: `export:${userId}`,
    limit: Number(process.env.MAGI_EXPORT_RATE_LIMIT || 60),
    windowMs: 60 * 60 * 1000,
  });
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.resetAt);

  const body = (await request.json().catch(() => null)) as { markdown?: unknown; title?: unknown } | null;
  const markdown = typeof body?.markdown === "string" ? body.markdown : "";
  const title = typeof body?.title === "string" ? body.title.slice(0, 120) : undefined;

  if (!markdown.trim()) {
    return Response.json({ error: "Nothing to export." }, { status: 400 });
  }
  if (markdown.length > 200_000) {
    return Response.json({ error: "Document too large to export." }, { status: 413 });
  }

  const bytes = await buildDocx(markdown, title);
  const filename = (title || "magi-deliverable").replace(/[^a-z0-9-_ ]/gi, "").trim().replace(/\s+/g, "-") || "magi-deliverable";

  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}.docx"`,
      "Cache-Control": "no-store",
    },
  });
}
