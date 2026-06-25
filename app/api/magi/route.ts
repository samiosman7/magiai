import { checkCreditAccess, recordRunAndChargeCredits } from "@/lib/billing/credits";
import { checkSpendLimits, recordSpend } from "@/lib/billing/spend";
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

  // Spend guard: kill switch + daily caps, BEFORE any model call. Blocked => clean
  // capacity message as a normal NDJSON stream (HTTP 200), never a raw error, zero spend.
  const spend = await checkSpendLimits(userId);
  if (!spend.allowed) {
    const body =
      `${JSON.stringify({ type: "status", step: "final", message: "Capacity" })}\n` +
      `${JSON.stringify({ type: "final", answer: spend.reason ?? "MAGI is at capacity. Please try again later." })}\n`;
    return new Response(body, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const dossier: MagiEvent[] = [];
      let finalAnswer = "";
      let runCostUsd = 0;
      let succeeded = false;
      const emit = (event: MagiEvent) => {
        if (event.type !== "delta") dossier.push(event); // don't bloat the saved run with token deltas
        if (event.type === "final") finalAnswer = event.answer;
        if (event.type === "cost") runCostUsd = event.total;
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      try {
        emit({
          type: "node",
          name: "Credit gate",
          text: `${creditCheck.creditsRequired} credits authorized for ${mode} mode.`,
        });
        await runMagiPipeline(prompt, mode, emit, geminiModel);
        succeeded = true;
      } catch {
        // Graceful failure: clean user-facing message, and don't charge for a broken run.
        emit({
          type: "final",
          answer: "MAGI couldn't finish this request. You haven't been charged — please try again.",
        });
      } finally {
        await recordRunAndChargeCredits({
          clerkUserId: userId,
          mode,
          prompt,
          finalAnswer,
          creditsCharged: succeeded ? creditCheck.creditsRequired : 0,
          dossier,
        }).catch(() => null);
        // Record real cost actually incurred (even on failure) so caps stay accurate.
        await recordSpend(userId, runCostUsd).catch(() => null);
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
