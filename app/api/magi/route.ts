import { checkCreditAccess, recordRunAndChargeCredits } from "@/lib/billing/credits";
import { getRequestUserId } from "@/lib/auth/user";
import { runMagiPipeline } from "@/lib/magi/pipeline";
import type { GeminiModel, MagiEvent, MagiMode } from "@/lib/magi/types";
import { checkRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const validModes = new Set(["economy", "standard", "premium", "benchmark"]);
const validGeminiModels = new Set([
  "gemini-3.1-pro-preview",
  "gemini-3.1-flash-lite-preview",
  "gemini-3-pro-preview",
  "gemini-3-flash-preview",
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash-lite-preview-06-17",
  "gemini-2.5-flash-lite-preview-09-2025",
  "gemini-2.0-flash-001",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-2.0-flash-lite-001",
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
  "gemini-1.5-pro",
]);

export async function POST(request: Request) {
  const userId = getRequestUserId(request);
  const rateLimit = checkRateLimit({
    key: `magi:${userId}`,
    limit: Number(process.env.MAGI_RUN_RATE_LIMIT || 30),
    windowMs: 60 * 60 * 1000,
  });

  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.resetAt);

  const body = (await request.json().catch(() => null)) as {
    prompt?: unknown;
    mode?: unknown;
    geminiModel?: unknown;
  } | null;

  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  const mode = validModes.has(String(body?.mode)) ? (body?.mode as MagiMode) : "standard";
  const geminiModel = validGeminiModels.has(String(body?.geminiModel))
    ? (body?.geminiModel as GeminiModel)
    : undefined;

  if (!prompt) {
    return Response.json({ error: "Prompt is required." }, { status: 400 });
  }

  if (prompt.length > 12000) {
    return Response.json({ error: "Prompt is too long for this MAGI tier." }, { status: 413 });
  }

  const creditCheck = await checkCreditAccess(userId, mode, prompt);
  if (!creditCheck.allowed) {
    return Response.json(
      {
        error: creditCheck.reason,
        creditsRequired: creditCheck.creditsRequired,
      },
      { status: 402 }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const dossier: MagiEvent[] = [];
      let finalAnswer = "";
      const emit = (event: MagiEvent) => {
        dossier.push(event);
        if (event.type === "final") finalAnswer = event.answer;
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      try {
        emit({
          type: "node",
          name: "Credit gate",
          text: `${creditCheck.creditsRequired} credits authorized for ${mode} mode.`,
        });
        await runMagiPipeline(prompt, mode, emit, geminiModel);
      } catch (error) {
        emit({
          type: "error",
          message: error instanceof Error ? error.message : "MAGI pipeline failed.",
        });
      } finally {
        await recordRunAndChargeCredits({
          clerkUserId: userId,
          mode,
          prompt,
          finalAnswer,
          creditsCharged: creditCheck.creditsRequired,
          dossier,
        }).catch(() => null);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
