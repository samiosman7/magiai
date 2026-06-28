// Pure text helpers for the MAGI pipeline — no server deps, so they're unit-testable.

export type TriageDecision = "simple" | "complex" | "refuse";

// Reads the opener's [SIMPLE]/[COMPLEX]/[REFUSE] tag and strips it from the body.
// Defaults to COMPLEX when no tag is found, to protect quality on real work.
export function parseTriage(text: string): { decision: TriageDecision; body: string } {
  const trimmed = text.trim();
  const match = trimmed.match(/^\[?\s*(SIMPLE|COMPLEX|REFUSE)\s*\]?/i);
  if (!match) return { decision: "complex", body: trimmed };
  const tag = match[1].toUpperCase();
  const decision: TriageDecision = tag === "REFUSE" ? "refuse" : tag === "SIMPLE" ? "simple" : "complex";
  const body = trimmed.slice(match[0].length).replace(/^[\s:\-–—]+/, "").trim();
  return { decision, body: body || trimmed };
}

// Cheap builders sometimes wrap the answer in a ```json {"final_answer": ...} envelope.
// Unwrap it so the user sees clean prose/code, not the internal artifact structure.
export function cleanFinalAnswer(text: string): string {
  const stripped = text.replace(/```(?:json)?/gi, "").trim();
  const match = stripped.match(/\{[\s\S]*\}/);
  for (const candidate of [stripped, match?.[0]]) {
    if (!candidate) continue;
    try {
      const obj = JSON.parse(candidate) as {
        final_answer?: unknown;
        files_to_create?: Array<{ filename?: string; content?: string }>;
      };
      if (obj && typeof obj.final_answer === "string") {
        let out = obj.final_answer.trim();
        for (const f of obj.files_to_create ?? []) {
          if (f?.filename && f?.content) out += `\n\n**${f.filename}**\n\`\`\`\n${f.content}\n\`\`\``;
        }
        return out;
      }
    } catch {
      // not a JSON envelope — fall through
    }
  }
  return text.trim();
}

// Remove [n] citations that point past the real source count so a cited claim never
// references a source that doesn't exist.
export function stripDanglingCitations(text: string, sourceCount: number): string {
  if (sourceCount <= 0) return text;
  return text.replace(/\[(\d+)\]/g, (m, d) => {
    const n = Number(d);
    return n >= 1 && n <= sourceCount ? m : "";
  });
}
