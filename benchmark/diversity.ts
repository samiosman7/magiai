/**
 * Error-diversity test for the "models fill each other's gaps" thesis.
 *
 * Runs N genuinely different cheap models INDEPENDENTLY (no pipeline) on objective
 * short-answer questions, auto-grades each, and measures whether the models fail on
 * DIFFERENT questions (diversity -> gap-filling can work) or the SAME ones
 * (correlated -> gap-filling is impossible).
 *
 * Headline metric:
 *   best_single  = accuracy of the single best cheap model
 *   oracle_cheap = fraction of questions at least ONE cheap model got right
 *   gap = oracle_cheap - best_single  -> the headroom a perfect combiner could capture.
 *   Large gap => diverse errors, thesis has legs. ~0 => shared blind spots, dead end.
 *
 * Run:  npx tsx benchmark/diversity.ts
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
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

// 7 distinct lineages + 1 frontier reference (kept separate from the cheap-model metrics).
const CHEAP = [
  "deepseek/deepseek-v3",
  "alibaba/qwen3-next-80b-a3b-instruct",
  "meta/llama-3.3-70b",
  "mistral/mistral-small",
  "google/gemini-2.5-flash",
  "amazon/nova-lite",
  "cohere/command-a",
];
const REFERENCE = "anthropic/claude-sonnet-4.5";
const MODELS = [...CHEAP, REFERENCE];

type Q = { id: string; q: string; accept: string[] };
const QUESTIONS: Q[] = [
  { id: "mult1", q: "Compute exactly: 347 multiplied by 289.", accept: ["100283"] },
  { id: "mult2", q: "Compute exactly: 1234 multiplied by 5678.", accept: ["7006652"] },
  { id: "discount", q: "A shirt is discounted 20%, then the sale price is discounted a further 25%. What single percentage discount off the original price is equivalent? Give the number only.", accept: ["40"] },
  { id: "avg-speed-h", q: "A car covers a 120-mile trip: the first 60 miles at 40 mph and the last 60 miles at 60 mph. What is its average speed for the whole trip in mph?", accept: ["48"] },
  { id: "cats-mice", q: "If 3 cats catch 3 mice in 3 minutes, how many cats are needed to catch 100 mice in 100 minutes?", accept: ["3"] },
  { id: "div-12", q: "How many positive integers less than 100 are divisible by both 3 and 4?", accept: ["8"] },
  { id: "anagram-level", q: "How many distinct arrangements are there of the letters in the word LEVEL?", accept: ["30"] },
  { id: "anagram-banana", q: "How many distinct arrangements are there of the letters in the word BANANA?", accept: ["60"] },
  { id: "octagon", q: "How many diagonals does a regular octagon (8 sides) have?", accept: ["20"] },
  { id: "js-sort", q: "In JavaScript, what does [10, 1, 2, 20].sort() return? Give the resulting array.", accept: ["110220"] },
  { id: "py-exp", q: "In Python, what is the value of 2 ** 3 ** 2?", accept: ["512"] },
  { id: "js-concat", q: "In JavaScript, what is the result of 3 + '4' + 5? Give the exact value.", accept: ["345"] },
  { id: "py-floor", q: "In Python, what is the value of 7 // 2 + 7 % 2?", accept: ["4"] },
  { id: "seconds-week", q: "How many seconds are there in exactly one week?", accept: ["604800"] },
  { id: "tank", q: "A 500-liter tank starts empty. A pipe fills it at 30 liters per minute while a drain removes 10 liters per minute. How many minutes to fill it?", accept: ["25"] },
  { id: "coins-2h", q: "Three fair coins are flipped. What is the probability of getting exactly two heads?", accept: ["3/8", "0.375"] },
  { id: "two-red", q: "A bag has 3 red and 2 blue balls. You draw 2 balls without replacement. What is the probability both are red?", accept: ["3/10", "0.3"] },
  { id: "look-say", q: "What are the next terms after this sequence: 1, 11, 21, 1211, 111221, ? Give the next single term.", accept: ["312211"] },
  { id: "factorial-seq", q: "What number comes next: 1, 2, 6, 24, 120, ?", accept: ["720"] },
  { id: "char-a", q: "How many times does the letter 'a' appear in the word 'abracadabra'?", accept: ["5"] },
  { id: "word-len", q: "How many letters are in the word 'antidisestablishmentarianism'?", accept: ["28"] },
  { id: "jan2000", q: "What day of the week was January 1, 2000?", accept: ["saturday"] },
];

function normalize(s: string) {
  return s.toLowerCase().replace(/[\s$,%\[\]]/g, "");
}

function grade(text: string, accept: string[]): boolean {
  const m = text.match(/final\s*:?\s*([^\n]*)$/im) || text.match(/final\s*:?\s*([^\n]*)/im);
  const tail = m ? m[1] : text.slice(-80);
  const norm = normalize(tail);
  const full = normalize(text.slice(-200));
  return accept.some((a) => norm.includes(normalize(a)) || full.includes(normalize(a)));
}

async function ask(model: string, q: string): Promise<string> {
  try {
    const res = await generateText({
      provider: "vercel",
      model,
      temperature: 0,
      maxTokens: 1200,
      system: "Answer the question. You may reason briefly, but you MUST end your reply with a line formatted exactly as: FINAL: <your answer>",
      prompt: q,
    });
    return res.text;
  } catch (e) {
    return `[ERROR ${(e as Error).message}]`;
  }
}

async function main() {
  const OUT = join(process.cwd(), "benchmark", "out");
  mkdirSync(OUT, { recursive: true });

  // matrix[qid][model] = boolean correct
  const matrix: Record<string, Record<string, boolean>> = {};
  for (const Q of QUESTIONS) {
    matrix[Q.id] = {};
    const results = await Promise.all(MODELS.map(async (m) => [m, await ask(m, Q.q)] as const));
    for (const [m, text] of results) {
      matrix[Q.id][m] = grade(text, Q.accept);
    }
    const passes = MODELS.filter((m) => matrix[Q.id][m]).length;
    console.log(`${Q.id.padEnd(14)} ${passes}/${MODELS.length} passed`);
  }

  // Per-model accuracy
  const acc: Record<string, number> = {};
  for (const m of MODELS) acc[m] = QUESTIONS.filter((Q) => matrix[Q.id][m]).length;

  // Cheap-only metrics
  const bestSingle = Math.max(...CHEAP.map((m) => acc[m]));
  const oracleCheap = QUESTIONS.filter((Q) => CHEAP.some((m) => matrix[Q.id][m])).length;
  const allCheapFail = QUESTIONS.filter((Q) => CHEAP.every((m) => !matrix[Q.id][m]));
  const refRescues = allCheapFail.filter((Q) => matrix[Q.id][REFERENCE]).length;

  const lines: string[] = ["# Error-diversity report", ""];
  lines.push(`Questions: ${QUESTIONS.length}`, "");
  lines.push("## Per-model accuracy", "", "| model | correct |", "| --- | --- |");
  for (const m of MODELS) lines.push(`| ${m}${m === REFERENCE ? " (reference)" : ""} | ${acc[m]}/${QUESTIONS.length} |`);
  lines.push("");
  lines.push("## The diversity verdict (cheap models only)", "");
  lines.push(`- Best single cheap model: **${bestSingle}/${QUESTIONS.length}**`);
  lines.push(`- Oracle (>=1 cheap model correct): **${oracleCheap}/${QUESTIONS.length}**`);
  lines.push(`- **Gap a perfect combiner could capture: ${oracleCheap - bestSingle}/${QUESTIONS.length}**`);
  lines.push(`- Questions ALL cheap models failed: ${allCheapFail.length} (${allCheapFail.map((q) => q.id).join(", ") || "none"})`);
  lines.push(`- ...of those, Sonnet rescued: ${refRescues}`);
  lines.push("");
  lines.push(oracleCheap - bestSingle >= 3
    ? "=> MEANINGFUL diversity: cheap models fail on different questions. Gap-filling thesis has a foundation."
    : "=> LOW diversity: cheap models largely share blind spots. Gap-filling has little to capture.");
  lines.push("");
  lines.push("## Failure map (X = wrong)", "", "| question | " + MODELS.map((m) => m.split("/")[1].slice(0, 10)).join(" | ") + " |");
  lines.push("| --- | " + MODELS.map(() => "---").join(" | ") + " |");
  for (const Q of QUESTIONS) {
    lines.push(`| ${Q.id} | ` + MODELS.map((m) => (matrix[Q.id][m] ? "." : "X")).join(" | ") + " |");
  }

  writeFileSync(join(OUT, "diversity-report.md"), lines.join("\n"));
  writeFileSync(join(OUT, "diversity-matrix.json"), JSON.stringify(matrix, null, 2));
  console.log("\n=== VERDICT (cheap models) ===");
  console.log(`best single cheap: ${bestSingle}/${QUESTIONS.length}`);
  console.log(`oracle (>=1 right): ${oracleCheap}/${QUESTIONS.length}`);
  console.log(`gap to capture:    ${oracleCheap - bestSingle}/${QUESTIONS.length}`);
  console.log(`all-cheap-fail:    ${allCheapFail.length}; Sonnet rescued ${refRescues}`);
  console.log("\nWrote benchmark/out/diversity-report.md");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
