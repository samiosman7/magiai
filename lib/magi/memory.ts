import "server-only";
import { getSupabaseAdmin, hasSupabaseConfig } from "@/lib/supabase/server";
import { generateText } from "./providers";

// MAGI's memory of each operator — the context layer the base models don't have.
// Two parts, both visible and editable by the user (trust through transparency):
//   facts — short durable statements MAGI learned from runs ("Works at Nakamura
//           Studios", "Prefers concise answers", "Building a meal-kit startup")
//   standing_instructions — the operator's own always-on directions ("Always
//           answer in French", "I'm a lawyer; cite jurisdictions")
// Injected into the pipeline so every run starts knowing who it's working for.

export type OperatorMemory = {
  facts: string[];
  standingInstructions: string;
};

export const MAX_FACTS = 20;
const MAX_FACT_LENGTH = 160;
const MAX_INSTRUCTIONS_LENGTH = 1200;

// Merge newly extracted facts into the existing list: trim, dedupe (case-insensitive,
// near-duplicates by prefix), newest last, capped. Pure — unit tested.
export function mergeFacts(existing: string[], incoming: string[], cap = MAX_FACTS): string[] {
  const cleaned = [...existing, ...incoming]
    .map((f) => f.replace(/\s+/g, " ").trim().slice(0, MAX_FACT_LENGTH))
    .filter((f) => f.length >= 6);

  const seen = new Set<string>();
  const out: string[] = [];
  // Walk newest→oldest so a refreshed fact supersedes its stale version,
  // then restore chronological order.
  for (let i = cleaned.length - 1; i >= 0; i--) {
    const key = cleaned[i].toLowerCase().replace(/[^a-z0-9 ]/g, "").slice(0, 60);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned[i]);
  }
  return out.reverse().slice(-cap);
}

export async function getMemory(userId: string): Promise<OperatorMemory> {
  if (!hasSupabaseConfig()) return { facts: [], standingInstructions: "" };
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("magi_memory")
      .select("facts, standing_instructions")
      .eq("clerk_user_id", userId)
      .maybeSingle();
    if (error || !data) return { facts: [], standingInstructions: "" };
    return {
      facts: Array.isArray(data.facts) ? data.facts.filter((f): f is string => typeof f === "string") : [],
      standingInstructions: typeof data.standing_instructions === "string" ? data.standing_instructions : "",
    };
  } catch {
    return { facts: [], standingInstructions: "" };
  }
}

export async function saveMemory(userId: string, memory: OperatorMemory): Promise<boolean> {
  if (!hasSupabaseConfig()) return false;
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("magi_memory").upsert(
      {
        clerk_user_id: userId,
        facts: mergeFacts([], memory.facts),
        standing_instructions: memory.standingInstructions.slice(0, MAX_INSTRUCTIONS_LENGTH),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "clerk_user_id" }
    );
    return !error;
  } catch {
    return false;
  }
}

// The block injected into node prompts. Empty string when there's nothing known.
export function buildOperatorContext(memory: OperatorMemory): string {
  const parts: string[] = [];
  if (memory.standingInstructions.trim()) {
    parts.push(`OPERATOR STANDING INSTRUCTIONS (always follow these):\n${memory.standingInstructions.trim()}`);
  }
  if (memory.facts.length > 0) {
    parts.push(
      `WHAT MAGI REMEMBERS ABOUT THIS OPERATOR (from past runs — use to tailor the answer, never recite unprompted):\n${memory.facts
        .map((f) => `- ${f}`)
        .join("\n")}`
    );
  }
  return parts.join("\n\n");
}

// Fire-and-forget after a successful run: a cheap model pass extracts durable
// facts worth remembering. Strict JSON contract; anything unparsable is dropped.
// Never throws — memory must not endanger a completed run.
export async function updateMemoryFromRun(userId: string, prompt: string, answer: string): Promise<void> {
  if (!hasSupabaseConfig()) return;
  try {
    const result = await generateText({
      provider: "vercel",
      model: "deepseek/deepseek-v3",
      system:
        'You maintain long-term memory for an AI assistant. From the exchange below, extract at most 3 DURABLE facts about the USER worth remembering across future sessions — their name, role, company, ongoing projects, domain, or stated preferences. Only facts the user revealed about themselves or their work; never facts about the answer topic itself, never speculation. Reply with ONLY a JSON array of short strings, e.g. ["Works at Acme Corp","Prefers answers in bullet points"]. If nothing durable, reply [].',
      prompt: `User request:\n${prompt.slice(0, 2000)}\n\nAssistant answer (for context only):\n${answer.slice(0, 1200)}`,
      maxTokens: 200,
      temperature: 0,
    });

    const match = result.text.match(/\[[\s\S]*\]/);
    if (!match) return;
    const parsed = JSON.parse(match[0]) as unknown;
    if (!Array.isArray(parsed)) return;
    const incoming = parsed.filter((f): f is string => typeof f === "string").slice(0, 3);
    if (incoming.length === 0) return;

    const current = await getMemory(userId);
    const facts = mergeFacts(current.facts, incoming);
    // No change → skip the write.
    if (JSON.stringify(facts) === JSON.stringify(current.facts)) return;

    const supabase = getSupabaseAdmin();
    await supabase.from("magi_memory").upsert(
      {
        clerk_user_id: userId,
        facts,
        standing_instructions: current.standingInstructions,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "clerk_user_id" }
    );
  } catch {
    // best-effort by design
  }
}

export async function clearMemory(userId: string): Promise<boolean> {
  if (!hasSupabaseConfig()) return false;
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("magi_memory").delete().eq("clerk_user_id", userId);
    return !error;
  } catch {
    return false;
  }
}
