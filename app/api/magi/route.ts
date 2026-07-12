import { checkCreditAccess, recordRunAndChargeCredits } from "@/lib/billing/credits";
import { checkSpendLimits, recordSpend } from "@/lib/billing/spend";
import { accountRequired, getRequestUser } from "@/lib/auth/user";
import { runMagiPipeline } from "@/lib/magi/pipeline";
import { buildOperatorContext, getMemory, updateMemoryFromRun } from "@/lib/magi/memory";
import type { GeminiModel, MagiEvent, MagiMode } from "@/lib/magi/types";
import type { Attachment, AttachmentKind } from "@/lib/magi/attachments";
import { MAX_FILES, PER_FILE_CHAR_CAP } from "@/lib/magi/attachments";
import {
  checkRateLimit,
  rateLimitResponse,
  getClientIp,
  getAnonymousTrialUsed,
  recordAnonymousTrialRun,
  FREE_TRIAL_RUNS,
} from "@/lib/security/rate-limit";

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
  const user = await getRequestUser(request);
  // With billing on, runs must be attributable to a real account before any spend.
  if (accountRequired(user)) {
    return Response.json({ error: "Sign in to run MAGI.", signInRequired: true }, { status: 401 });
  }
  const userId = user.userId;
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
    history?: unknown;
    attachments?: unknown;
  } | null;

  const rawHistory = Array.isArray(body?.history)
    ? (body.history as unknown[])
        .filter(
          (h): h is { role: string; text: string } =>
            !!h && typeof (h as { text?: unknown }).text === "string"
        )
        .slice(-8)
    : [];
  const lastAssistantIdx = rawHistory.map((h) => h.role).lastIndexOf("magi") !== -1
    ? rawHistory.map((h) => h.role).lastIndexOf("magi")
    : rawHistory.map((h) => h.role !== "user").lastIndexOf(true);
  const history = rawHistory.length
    ? rawHistory.map((h, i) => ({
        role: h.role === "user" ? "user" : "assistant",
        // The most recent deliverable keeps more room — the revision fast-path
        // edits it verbatim, so truncating it would silently drop content.
        text: h.text.slice(0, i === lastAssistantIdx ? 9000 : 2000),
      }))
    : undefined;

  // Attachments come back from /api/files/extract already parsed; the client
  // returns them with the run. Re-validate and re-cap here — never trust sizes
  // from the client — before they reach the model prompt.
  const validKinds = new Set<AttachmentKind>(["text", "pdf", "docx", "image", "unknown"]);
  const attachments: Attachment[] = Array.isArray(body?.attachments)
    ? (body.attachments as unknown[])
        .filter((a): a is Record<string, unknown> => !!a && typeof a === "object")
        .slice(0, MAX_FILES)
        .map((a, i) => {
          const text = typeof a.text === "string" ? a.text.slice(0, PER_FILE_CHAR_CAP) : "";
          const kind = validKinds.has(a.kind as AttachmentKind) ? (a.kind as AttachmentKind) : "unknown";
          return {
            id: typeof a.id === "string" ? a.id : `att-${i}`,
            name: typeof a.name === "string" ? a.name.slice(0, 200) : `file-${i + 1}`,
            kind,
            chars: text.length,
            truncated: Boolean(a.truncated),
            ok: text.length > 0 && a.ok !== false,
            text,
            note: typeof a.note === "string" ? a.note.slice(0, 200) : undefined,
          };
        })
    : [];

  const rawPrompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  const mode = validModes.has(String(body?.mode)) ? (body?.mode as MagiMode) : "standard";
  const geminiModel = validGeminiModels.has(String(body?.geminiModel))
    ? (body?.geminiModel as GeminiModel)
    : undefined;

  // A file with no typed prompt is a valid request ("just read this"): default it.
  const prompt =
    rawPrompt || (attachments.some((a) => a.ok) ? "Review the attached file(s) and give me a clear, useful summary of what they contain and anything important I should know." : "");

  if (!prompt) {
    return Response.json({ error: "Prompt is required." }, { status: 400 });
  }

  if (prompt.length > 12000) {
    return Response.json({ error: "Prompt is too long for this MAGI tier." }, { status: 413 });
  }

  // Public freemium: unsigned visitors get FREE_TRIAL_RUNS free runs, then a signup
  // wall. Only active in public mode (no beta code); private-beta invitees skip it and
  // run under the daily/monthly caps. Signed-in users use the normal credit/plan system.
  const publicMode = !process.env.MAGI_BETA_CODE;
  const isAnonymous = !user.authenticated;
  const clientIp = getClientIp(request);
  if (publicMode && isAnonymous) {
    const used = await getAnonymousTrialUsed(clientIp);
    if (used >= FREE_TRIAL_RUNS) {
      return Response.json(
        {
          error: `You've used your ${FREE_TRIAL_RUNS} free runs. Create a free account to keep going — it takes 10 seconds.`,
          signupRequired: true,
          freeTrialRuns: FREE_TRIAL_RUNS,
        },
        { status: 402 }
      );
    }
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

  // Spend guard: kill switch + global/per-user caps, BEFORE any model call.
  // Plan caps apply ALWAYS — even during the free beta (billing off), anonymous
  // callers resolve to the Free plan, so the free-tier daily limits ($/runs) bound
  // a release-day flood instead of the looser env fallback. Blocked => clean
  // capacity message as a normal NDJSON stream (HTTP 200), never a raw error, zero spend.
  const spend = await checkSpendLimits(userId, {
    dailyRuns: creditCheck.plan.dailyRuns,
    dailyUsd: creditCheck.plan.dailyUsd,
  });
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

  const reqId = crypto.randomUUID().slice(0, 8);
  const startedAt = Date.now();
  // Structured server logs (greppable in Vercel): one line per lifecycle event.
  const log = (event: string, extra: Record<string, unknown> = {}) =>
    console.log(JSON.stringify({ t: `magi.${event}`, reqId, mode, ...extra }));
  log("start", { promptLen: prompt.length });

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
        // Operator memory: what MAGI knows about this user, injected into the run.
        const memory = await getMemory(userId).catch(() => null);
        const operatorContext = memory ? buildOperatorContext(memory) : "";
        await runMagiPipeline(prompt, mode, emit, {
          geminiModel,
          signal: request.signal,
          history,
          attachments,
          operatorContext,
        });
        succeeded = true;
      } catch (error) {
        // Graceful failure: clean user-facing message, and don't charge for a broken run.
        console.error(
          JSON.stringify({ t: "magi.error", reqId, mode, message: error instanceof Error ? error.message : "unknown" })
        );
        emit({
          type: "final",
          answer: "MAGI couldn't finish this request. You haven't been charged — please try again.",
        });
      } finally {
        log("done", { succeeded, costUsd: Number(runCostUsd.toFixed(6)), ms: Date.now() - startedAt });
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
        // Burn a free-trial slot only on a successful anonymous run.
        if (publicMode && isAnonymous && succeeded) {
          await recordAnonymousTrialRun(clientIp).catch(() => null);
        }
        // Learn from the run (fire-and-forget; never delays or breaks the response).
        if (succeeded && finalAnswer) {
          void updateMemoryFromRun(userId, prompt, finalAnswer).catch(() => null);
        }
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
