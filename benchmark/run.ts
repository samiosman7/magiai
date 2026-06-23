/**
 * MAGI benchmark runner.
 *
 * Runs every prompt through 4 arms:
 *   A. control      — single Claude Sonnet call, no pipeline
 *   B. magi-bench   — full MAGI pipeline, cheap ensemble + Sonnet arbiter (the real product)
 *   C. magi-premium — full MAGI pipeline, Sonnet in every slot (architecture ceiling)
 *   D. control-cheap— single DeepSeek-R1 call (cheap floor, for reference)
 *
 * All four go through OpenRouter so the only variable is the pipeline, not the API.
 *
 * Output:
 *   benchmark/out/responses-blind.md  — outputs labelled with shuffled codes (X1, X2...), score this
 *   benchmark/out/key.json            — maps codes -> arm, reveal AFTER scoring
 *   benchmark/out/raw.json            — everything, including per-pass MAGI internals
 *
 * Run:  npx tsx benchmark/run.ts
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

// --- load .env.local manually (standalone script, no Next runtime) ---
function loadEnv() {
  try {
    const raw = readFileSync(join(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    console.error("Could not read .env.local — make sure OPENROUTER_API_KEY is set.");
  }
}
loadEnv();

if (!process.env.OPENROUTER_API_KEY) {
  console.error("OPENROUTER_API_KEY missing. Aborting.");
  process.exit(1);
}

import { runMagiPipeline } from "../lib/magi/pipeline";
import { generateText } from "../lib/magi/providers";
import type { MagiEvent } from "../lib/magi/types";

type PromptSpec = {
  id: string;
  kind: string;
  trap?: boolean;
  prompt: string;
  answerKey?: string;
};

type ArmId = "control" | "magi-bench" | "magi-premium" | "control-cheap";

const promptsFile = JSON.parse(
  readFileSync(join(process.cwd(), "benchmark", "prompts.json"), "utf8")
) as { prompts: PromptSpec[] };

const OUT = join(process.cwd(), "benchmark", "out");
mkdirSync(OUT, { recursive: true });

// --- run one MAGI pipeline arm, capture final answer + per-node trace ---
async function runMagi(prompt: string, mode: "benchmark" | "benchmark-max") {
  const nodes: Array<{ name: string; text: string }> = [];
  let final = "";
  const emit = (e: MagiEvent) => {
    if (e.type === "node") nodes.push({ name: e.name, text: e.text });
    if (e.type === "final") final = e.answer;
  };
  await runMagiPipeline(prompt, mode, emit);
  return { final: final.replace(/^The Magi has decided\.\s*/, "").trim(), nodes };
}

// --- run a single direct model call (control arms) ---
async function runDirect(prompt: string, model: string) {
  const res = await generateText({
    provider: "vercel",
    model,
    system:
      "You are a careful, expert assistant. Answer the user's request directly, completely, and accurately. If the request contains a mistaken assumption or a planted error, point it out.",
    prompt,
    maxTokens: 2200,
  });
  return res.text;
}

async function runArm(arm: ArmId, p: PromptSpec): Promise<{ text: string; trace?: unknown }> {
  switch (arm) {
    case "control":
      return { text: await runDirect(p.prompt, "anthropic/claude-sonnet-4.5") };
    case "control-cheap":
      return { text: await runDirect(p.prompt, "deepseek/deepseek-r1") };
    case "magi-bench": {
      const r = await runMagi(p.prompt, "benchmark");
      return { text: r.final, trace: r.nodes };
    }
    case "magi-premium": {
      const r = await runMagi(p.prompt, "benchmark-max");
      return { text: r.final, trace: r.nodes };
    }
  }
}

const ARMS: ArmId[] = ["control", "magi-bench", "magi-premium", "control-cheap"];

// deterministic-ish shuffle seeded by prompt id so codes vary per prompt
function shuffle<T>(arr: T[], seed: string): T[] {
  const a = [...arr];
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  for (let i = a.length - 1; i > 0; i--) {
    h = (h * 1103515245 + 12345) >>> 0;
    const j = h % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function main() {
  const raw: Record<string, Record<ArmId, { text: string; trace?: unknown }>> = {};
  const key: Record<string, Record<string, ArmId>> = {};
  const blindLines: string[] = [
    "# MAGI Benchmark — Blind Scoring Sheet",
    "",
    "Score each labelled response WITHOUT knowing which model/arm produced it.",
    "For each: Correctness, Completeness, Usefulness (1-10).",
    "For trap prompts, the key thing is whether the planted error was caught.",
    "Reveal arms with key.json only AFTER you finish scoring.",
    "",
    "---",
    "",
  ];

  for (const p of promptsFile.prompts) {
    console.log(`\n=== ${p.id} (${p.kind}${p.trap ? ", TRAP" : ""}) ===`);
    raw[p.id] = {} as Record<ArmId, { text: string; trace?: unknown }>;

    // run all arms in parallel per prompt (paid tier; retry/backoff covers transient 429s)
    const results = await Promise.all(
      ARMS.map(async (arm) => {
        try {
          const r = await runArm(arm, p);
          console.log(`  ${arm}: ${r.text.length} chars`);
          return [arm, r] as const;
        } catch (err) {
          console.log(`  ${arm}: ERROR ${(err as Error).message}`);
          return [arm, { text: `[ERROR: ${(err as Error).message}]` }] as const;
        }
      })
    );
    for (const [arm, r] of results) raw[p.id][arm] = r;

    // blind sheet with shuffled codes
    const codes = shuffle(ARMS, p.id);
    key[p.id] = {};
    blindLines.push(`## ${p.id}${p.trap ? "  (objective — has a right answer)" : ""}`, "");
    blindLines.push("**Prompt:**", "", "> " + p.prompt.replace(/\n/g, "\n> "), "");
    codes.forEach((arm, i) => {
      const label = `${p.id.slice(0, 3).toUpperCase()}-${i + 1}`;
      key[p.id][label] = arm;
      blindLines.push(`### Response ${label}`, "", raw[p.id][arm].text, "", "---", "");
    });
  }

  // Verify-pass impact: the pipeline emits a "Reprompt loop" node ONLY when Casper + Judge
  // flag the same issue and the answer is revised. If it rarely fires, the 4th call (verify)
  // is mostly dead weight and the pipeline could drop to 3 calls.
  const summaryLines = ["# Verify-pass impact (4-vs-3-calls signal)", ""];
  let benchReprompts = 0;
  for (const p of promptsFile.prompts) {
    const fired = (arm: ArmId) => {
      const trace = raw[p.id][arm]?.trace as Array<{ name: string }> | undefined;
      return Array.isArray(trace) && trace.some((n) => n.name === "Reprompt loop");
    };
    const b = fired("magi-bench");
    if (b) benchReprompts++;
    summaryLines.push(
      `- ${p.id}: magi-bench verify ${b ? "CHANGED the answer" : "no change"}; magi-premium ${fired("magi-premium") ? "CHANGED" : "no change"}`
    );
  }
  summaryLines.push(
    "",
    `Bench arm: verify pass changed the answer in ${benchReprompts}/${promptsFile.prompts.length} prompts.`,
    benchReprompts <= 2
      ? "=> Verify rarely fires. Strong case for merging Casper+Judge to 3 calls."
      : "=> Verify earns its keep. Keep the independent dual-signal check."
  );
  writeFileSync(join(OUT, "verify-impact.md"), summaryLines.join("\n"));

  writeFileSync(join(OUT, "raw.json"), JSON.stringify(raw, null, 2));
  writeFileSync(join(OUT, "key.json"), JSON.stringify(key, null, 2));
  writeFileSync(join(OUT, "responses-blind.md"), blindLines.join("\n"));
  console.log(`\nDone. Wrote:\n  benchmark/out/responses-blind.md  (score this)\n  benchmark/out/key.json            (reveal after)\n  benchmark/out/verify-impact.md    (4-vs-3-calls signal)\n  benchmark/out/raw.json            (full trace)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
