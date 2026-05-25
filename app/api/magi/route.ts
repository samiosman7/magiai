import { auth } from "@clerk/nextjs/server";
import { checkCreditAccess } from "@/lib/billing/credits";
import { runMagiPipeline } from "@/lib/magi/pipeline";
import type { MagiEvent, MagiMode } from "@/lib/magi/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const validModes = new Set(["economy", "standard", "premium"]);

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    prompt?: unknown;
    mode?: unknown;
  } | null;

  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  const mode = validModes.has(String(body?.mode)) ? (body?.mode as MagiMode) : "standard";

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
      const emit = (event: MagiEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      try {
        emit({
          type: "node",
          name: "Credit gate",
          text: `${creditCheck.creditsRequired} credits authorized for ${mode} mode by operator ${userId}.`,
        });
        await runMagiPipeline(prompt, mode, emit);
      } catch (error) {
        emit({
          type: "error",
          message: error instanceof Error ? error.message : "MAGI pipeline failed.",
        });
      } finally {
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
