import { getRequestUser } from "@/lib/auth/user";
import { checkRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";
import {
  extractAttachment,
  MAX_FILES,
  MAX_FILE_BYTES,
  type Attachment,
} from "@/lib/magi/attachments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// PDFs/images can be a few MB; allow a generous body.
export const maxDuration = 60;

// Accepts multipart form-data (field name "files"), extracts text from each,
// and returns lightweight attachment records the console holds until the run.
export async function POST(request: Request) {
  const { userId } = await getRequestUser(request);
  const rateLimit = checkRateLimit({
    key: `files:${userId}`,
    limit: Number(process.env.MAGI_FILE_RATE_LIMIT || 40),
    windowMs: 60 * 60 * 1000,
  });
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.resetAt);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Expected a multipart file upload." }, { status: 400 });
  }

  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return Response.json({ error: "No files were uploaded." }, { status: 400 });
  }
  if (files.length > MAX_FILES) {
    return Response.json({ error: `Up to ${MAX_FILES} files per upload.` }, { status: 400 });
  }

  const attachments: Attachment[] = [];
  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) {
      attachments.push({
        id: `oversize-${attachments.length}`,
        name: file.name || "file",
        kind: "unknown",
        chars: 0,
        truncated: false,
        ok: false,
        text: "",
        note: "File too large (15 MB max).",
      });
      continue;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    attachments.push(
      await extractAttachment({
        name: file.name || "file",
        mimeType: file.type || "",
        bytes,
      })
    );
  }

  return Response.json({
    attachments: attachments.map((a) => ({
      id: a.id,
      name: a.name,
      kind: a.kind,
      chars: a.chars,
      truncated: a.truncated,
      ok: a.ok,
      note: a.note,
      // full text returned to the client so it can send it back with the run;
      // it never renders raw — it goes straight into the next /api/magi body.
      text: a.text,
    })),
  });
}
