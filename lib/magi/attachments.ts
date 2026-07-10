import "server-only";

// File ingestion for MAGI: turn an uploaded file into clean text the pipeline
// can reason over. Text formats decode directly; DOCX is unzipped; PDF uses the
// serverless-safe unpdf; images go through a vision OCR pass. Everything fails
// soft — a file that can't be read becomes a noted, empty attachment rather than
// breaking the run.

export type AttachmentKind = "text" | "pdf" | "docx" | "image" | "unknown";

export type Attachment = {
  id: string;
  name: string;
  kind: AttachmentKind;
  chars: number;
  truncated: boolean;
  ok: boolean;
  text: string;
  note?: string;
};

export type ExtractInput = {
  name: string;
  mimeType: string;
  bytes: Uint8Array;
};

// Per-file text budget (chars). Several docs must fit a single run without
// blowing the model context, so keep each generous but bounded.
export const PER_FILE_CHAR_CAP = 24000;
export const MAX_FILES = 6;
export const MAX_FILE_BYTES = 15 * 1024 * 1024;

const textExtensions = new Set([
  "txt", "md", "markdown", "csv", "tsv", "json", "log", "yaml", "yml", "xml", "html", "htm", "rtf",
]);

function extOf(name: string) {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

function kindFor(name: string, mimeType: string): AttachmentKind {
  const ext = extOf(name);
  if (ext === "pdf" || mimeType === "application/pdf") return "pdf";
  if (ext === "docx" || mimeType.includes("wordprocessingml")) return "docx";
  if (textExtensions.has(ext) || mimeType.startsWith("text/") || mimeType === "application/json") return "text";
  if (mimeType.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) return "image";
  return "unknown";
}

function clampText(raw: string): { text: string; truncated: boolean } {
  const collapsedSpaces = raw.replace(/\r\n/g, "\n").split("\n").map((line) => line.replace(/[\t ]{2,}/g, " ").trimEnd()).join("\n");
  const clean = collapsedSpaces.replace(/\n{3,}/g, "\n\n").trim();
  if (clean.length <= PER_FILE_CHAR_CAP) return { text: clean, truncated: false };
  return { text: clean.slice(0, PER_FILE_CHAR_CAP), truncated: true };
}

let idCounter = 0;
function nextId() {
  idCounter += 1;
  return `att-${idCounter}-${(idCounter * 2654435761) % 100000}`;
}

export async function extractAttachment(input: ExtractInput): Promise<Attachment> {
  const kind = kindFor(input.name, input.mimeType);
  const base = { id: nextId(), name: input.name, kind };

  if (input.bytes.byteLength > MAX_FILE_BYTES) {
    return { ...base, chars: 0, truncated: false, ok: false, text: "", note: "File too large (15 MB max)." };
  }

  try {
    if (kind === "text") return finish(base, decodeText(input.bytes));
    if (kind === "docx") return finish(base, await extractDocx(input.bytes));
    if (kind === "pdf") return finish(base, await extractPdf(input.bytes));
    if (kind === "image") {
      const ocr = await extractImageText(input.bytes, input.mimeType || "image/png");
      if (!ocr.ok) return { ...base, chars: 0, truncated: false, ok: false, text: "", note: ocr.note };
      const { text, truncated } = clampText(ocr.text);
      return { ...base, chars: text.length, truncated, ok: text.length > 0, text, note: "Scanned via vision OCR." };
    }
    return { ...base, chars: 0, truncated: false, ok: false, text: "", note: "Unsupported file type." };
  } catch (error) {
    return {
      ...base,
      chars: 0,
      truncated: false,
      ok: false,
      text: "",
      note: `Could not read this file (${error instanceof Error ? error.message.slice(0, 80) : "parse error"}).`,
    };
  }
}

function finish(base: { id: string; name: string; kind: AttachmentKind }, raw: string): Attachment {
  const { text, truncated } = clampText(raw);
  const ok = text.length > 0;
  return {
    ...base,
    chars: text.length,
    truncated,
    ok,
    text,
    note: ok
      ? truncated
        ? "Long file — analyzed the first portion."
        : undefined
      : "No readable text found (it may be a scanned image — try exporting as text).",
  };
}

function decodeText(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

// DOCX is a zip; the body lives in word/document.xml. Strip tags, keep paragraph
// and break boundaries as newlines. Avoids a heavy docx dependency.
async function extractDocx(bytes: Uint8Array): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(bytes);
  const doc = zip.file("word/document.xml");
  if (!doc) return "";
  const xml = await doc.async("string");
  return xml
    .replace(/<w:p\b[^>]*>/g, "\n")
    .replace(/<w:br\b[^>]*\/?>/g, "\n")
    .replace(/<w:tab\b[^>]*\/?>/g, "\t")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\n{3,}/g, "\n\n");
}

async function extractPdf(bytes: Uint8Array): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n\n") : text;
}

// Vision OCR for images (and photographed/scanned docs). Uses the Vercel AI
// gateway with a vision-capable model. No key → clean note, no throw.
async function extractImageText(
  bytes: Uint8Array,
  mimeType: string
): Promise<{ ok: boolean; text: string; note?: string }> {
  const key = process.env.AI_GATEWAY_API_KEY;
  if (!key) {
    return { ok: false, text: "", note: "Image scanning needs the AI gateway key. Text/PDF/DOCX still work." };
  }

  const b64 = Buffer.from(bytes).toString("base64");
  const dataUrl = `data:${mimeType};base64,${b64}`;
  const model = process.env.MAGI_VISION_MODEL || "openai/gpt-4o-mini";

  try {
    const res = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        max_tokens: 1500,
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
              "You are an OCR and document-reading engine. Transcribe ALL text in the image faithfully, preserving structure (headings, lists, tables as text). If it is a form or contract, keep field labels and values together. Output only the transcribed text — no commentary.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Transcribe every piece of text in this document image." },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(45000),
    });

    if (!res.ok) {
      return { ok: false, text: "", note: `Vision OCR failed (${res.status}).` };
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = data.choices?.[0]?.message?.content?.trim() || "";
    return { ok: text.length > 0, text, note: text.length > 0 ? undefined : "No text detected in image." };
  } catch (error) {
    return {
      ok: false,
      text: "",
      note: `Vision OCR error (${error instanceof Error ? error.message.slice(0, 60) : "network"}).`,
    };
  }
}

// Signals that legal-document handling should apply — from the extracted text
// (contract vocabulary) or the user's own phrasing.
const legalTextPattern =
  /\b(agreement|whereas|hereinafter|indemnif|liabilit|arbitrat|governing law|termination|confidential|non-disclosure|warrant(y|ies)|shall be liable|in witness whereof|force majeure|severability|jurisdiction|counterparts?)\b/i;
const legalPromptPattern =
  /\b(contract|agreement|lease|nda|terms|clause|legal|liabilit|tenant|landlord|employment offer|settlement|waiver|policy|obligation)\b/i;

export function looksLegal(attachments: Attachment[], prompt: string): boolean {
  if (legalPromptPattern.test(prompt)) return true;
  return attachments.some((a) => a.ok && legalTextPattern.test(a.text));
}

// The block injected into every node's system prompt. Mirrors the grounding
// block so attachment content survives the whole chain, not just the Architect.
export function buildAttachmentBlock(attachments: Attachment[]): string {
  const usable = attachments.filter((a) => a.ok && a.text);
  if (usable.length === 0) return "";

  const header =
    "ATTACHED FILES — the user uploaded these. Treat their content as primary source material for this request; quote and reference them by name. Do not invent content that is not present in them:";
  const body = usable
    .map((a, i) => {
      const meta = [a.kind.toUpperCase(), `${a.chars} chars`, a.truncated ? "truncated" : ""]
        .filter(Boolean)
        .join(", ");
      return `--- FILE ${i + 1}: ${a.name} (${meta}) ---\n${a.text}`;
    })
    .join("\n\n");
  return `${header}\n\n${body}`;
}

// A short, user-facing manifest for the run trace.
export function attachmentSummary(attachments: Attachment[]): string {
  if (attachments.length === 0) return "";
  const names = attachments.map((a) => (a.ok ? a.name : `${a.name} (unreadable)`)).join(", ");
  const okCount = attachments.filter((a) => a.ok).length;
  return `${okCount}/${attachments.length} file${attachments.length > 1 ? "s" : ""} read: ${names}`;
}
