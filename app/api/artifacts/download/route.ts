import JSZip from "jszip";
import { saveArtifactPackage } from "@/lib/artifacts/store";
import { generateUniversalArtifactProject } from "@/lib/artifacts/universal-generator";
import { getRequestUserId } from "@/lib/auth/user";
import type { GeminiModel, MagiArtifact, MagiMode } from "@/lib/magi/types";
import { checkRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const validModes = new Set(["economy", "standard", "premium"]);
const validArtifactTypes = new Set(["answer", "document", "report", "code", "project", "data", "plan"]);
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
    key: `artifact:${userId}`,
    limit: Number(process.env.MAGI_ARTIFACT_RATE_LIMIT || 20),
    windowMs: 60 * 60 * 1000,
  });

  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.resetAt);

  const body = (await request.json().catch(() => null)) as {
    prompt?: unknown;
    mode?: unknown;
    geminiModel?: unknown;
    artifactType?: unknown;
  } | null;

  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  const mode = validModes.has(String(body?.mode)) ? (body?.mode as MagiMode) : "standard";
  const geminiModel = validGeminiModels.has(String(body?.geminiModel))
    ? (body?.geminiModel as GeminiModel)
    : undefined;
  const artifactType = validArtifactTypes.has(String(body?.artifactType))
    ? (body?.artifactType as MagiArtifact["type"])
    : undefined;

  if (!prompt) {
    return Response.json({ error: "Prompt is required." }, { status: 400 });
  }

  const project = await generateUniversalArtifactProject({
    prompt,
    mode,
    geminiModel,
    requestedType: artifactType,
  });
  await saveArtifactPackage({
    userId,
    artifactType: artifactType || "answer",
    project,
    metadata: { route: "universal_artifact_download", mode },
  }).catch(() => null);
  const zip = new JSZip();

  for (const file of project.files) {
    zip.file(file.path, file.content);
  }

  const archive = await zip.generateAsync({ type: "arraybuffer" });

  return new Response(archive, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${project.slug}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
