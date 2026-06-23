/**
 * Constraint-satisfaction scorer for the ARENA set.
 *
 * For each (prompt, arm) it asks a strict Sonnet grader: of this prompt's explicit
 * requirements, which did the RESPONSE actually satisfy? Then it tallies satisfied/total
 * per arm. The pipeline's claimed value is catching dropped requirements a single pass misses —
 * so the number that matters is whether magi-bench satisfies MORE requirements than control-cheap.
 *
 * Reads benchmark/out/raw.json (from run.ts) + benchmark/prompts.json. Re-runnable without
 * re-running the benchmark.
 *
 * Run:  npx tsx benchmark/score.ts
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function loadEnv() {
  const raw = readFileSync(join(process.cwd(), ".env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv();

import { generateText } from "../lib/magi/providers";

type PromptSpec = { id: string; requirements?: string[] };
const prompts = (
  JSON.parse(readFileSync(join(process.cwd(), "benchmark", "prompts.json"), "utf8")) as {
    prompts: PromptSpec[];
  }
).prompts.filter((p) => Array.isArray(p.requirements) && p.requirements.length > 0);

const raw = JSON.parse(
  readFileSync(join(process.cwd(), "benchmark", "out", "raw.json"), "utf8")
) as Record<string, Record<string, { text: string }>>;

const ARMS = ["control", "control-cheap", "magi-bench", "magi-premium"] as const;
type Arm = (typeof ARMS)[number];

async function grade(requirements: string[], response: string): Promise<boolean[]> {
  const list = requirements.map((r, i) => `${i + 1}. ${r}`).join("\n");
  const res = await generateText({
    provider: "vercel",
    model: "anthropic/claude-sonnet-4.5",
    temperature: 0,
    maxTokens: 600,
    system:
      "You are a strict, literal grader. You are given a checklist of REQUIREMENTS and a RESPONSE. For each requirement, decide if the response actually satisfies it — present AND correct, not merely mentioned. Be strict: partial or hand-wavy coverage is false. Return ONLY a JSON array of booleans, one per requirement, in order. No prose.",
    prompt: `REQUIREMENTS:\n${list}\n\nRESPONSE:\n${response}\n\nReturn a JSON array of ${requirements.length} booleans.`,
  });
  const text = res.text.replace(/```(?:json)?/gi, "").trim();
  const match = text.match(/\[[\s\S]*\]/);
  try {
    const arr = JSON.parse(match ? match[0] : text) as unknown[];
    return requirements.map((_, i) => Boolean(arr[i]));
  } catch {
    return requirements.map(() => false);
  }
}

async function main() {
  const lines: string[] = ["# Arena scorecard — requirements satisfied per arm", ""];
  const totals: Record<Arm, { sat: number; max: number }> = {
    control: { sat: 0, max: 0 },
    "control-cheap": { sat: 0, max: 0 },
    "magi-bench": { sat: 0, max: 0 },
    "magi-premium": { sat: 0, max: 0 },
  };

  for (const p of prompts) {
    const reqs = p.requirements!;
    lines.push(`## ${p.id} (${reqs.length} requirements)`, "");
    lines.push("| arm | satisfied |", "| --- | --- |");
    for (const arm of ARMS) {
      const text = raw[p.id]?.[arm]?.text ?? "";
      const verdicts = await grade(reqs, text);
      const sat = verdicts.filter(Boolean).length;
      totals[arm].sat += sat;
      totals[arm].max += reqs.length;
      const missed = reqs.filter((_, i) => !verdicts[i]);
      lines.push(`| ${arm} | ${sat}/${reqs.length}${missed.length ? " — missed: " + missed.join("; ") : ""} |`);
      console.log(`${p.id} ${arm}: ${sat}/${reqs.length}`);
    }
    lines.push("");
  }

  lines.push("## TOTALS", "");
  lines.push("| arm | satisfied | % |", "| --- | --- | --- |");
  for (const arm of ARMS) {
    const { sat, max } = totals[arm];
    lines.push(`| ${arm} | ${sat}/${max} | ${((100 * sat) / max).toFixed(0)}% |`);
  }
  writeFileSync(join(process.cwd(), "benchmark", "out", "arena-scorecard.md"), lines.join("\n"));
  console.log("\nWrote benchmark/out/arena-scorecard.md");
  for (const arm of ARMS) {
    const { sat, max } = totals[arm];
    console.log(`  ${arm.padEnd(14)} ${sat}/${max} (${((100 * sat) / max).toFixed(0)}%)`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
