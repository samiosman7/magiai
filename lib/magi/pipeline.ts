import { getModelPlan } from "./model-plan";
import { generateText, generateTextStream } from "./providers";
import { buildMagiRuntimeContext } from "./runtime-context";
import { skillLabels, skillPackPaths, skillPrompt } from "./skills";
import { classifyTask, createPlannedArtifact } from "./task-router";
import { webSearch, buildGrounding } from "./search";
import { parseTriage, cleanFinalAnswer, stripDanglingCitations } from "./text-utils";
import type { DifficultyResult, GeminiModel, JudgeResult, MagiEvent, MagiMode, PipelineStep } from "./types";

type Emit = (event: MagiEvent) => void;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const productContext =
  'You are one stage of MAGI, an AI system that turns a request into a verified, well-sourced deliverable. If a request refers to "MAGI," treat it as this product unless the user clearly means something else.';

export async function runMagiPipeline(
  prompt: string,
  mode: MagiMode,
  emit: Emit,
  geminiModel?: GeminiModel,
  signal?: AbortSignal,
  history?: Array<{ role: string; text: string }>
) {
  const taskProfile = classifyTask(prompt);

  const historyBlock =
    history && history.length
      ? `Conversation so far (most recent last):\n${history
          .map((h) => `${h.role === "user" ? "User" : "MAGI"}: ${h.text.slice(0, 1500)}`)
          .join("\n")}\n\n---\n\n`
      : "";

  // Instant, free shortcuts (greetings, plain arithmetic) — no model call at all.
  const quick = quickAnswer(prompt);
  if (quick !== null) {
    emit({ type: "final", answer: `The Magi has decided.\n\n${quick}` });
    return;
  }

  emit({ type: "status", step: "scan", message: "MAGI is reading your request..." });
  const runtimeContext = await buildMagiRuntimeContext(prompt);
  emit({ type: "task", profile: taskProfile });
  emit({ type: "artifact", artifact: createPlannedArtifact(taskProfile, prompt) });
  complete("scan", emit);
  complete("route", emit);

  // ── The angle ensemble: four perspectives building on each other ──
  // Node keys map to roles: melchior=Architect, balthasar=Maverick, casper=Adversary, judge=Synthesis.
  const route = `Task route:\n${JSON.stringify(taskProfile, null, 2)}`;
  const mcp = `${runtimeContext.mcpContext}\n\nMCP tool execution context:\n${runtimeContext.mcpToolContext}`;
  const noWrap =
    "Forbidden: JSON wrappers, wrapping the whole answer in a code fence, preamble, or mentioning these instructions.";

  // Grounding (the wedge): for research/analysis tasks, pull real sources so the models
  // cite [n] and verify against them. Fails soft to ungrounded (grounding stays "").
  let grounding = "";
  let sourcesList = "";
  let sourceCount = 0;
  if (taskProfile.kind === "research" || taskProfile.kind === "analysis") {
    emit({ type: "status", step: "scan", message: "MAGI is researching sources..." });
    const results = await webSearch(prompt, 5);
    sourceCount = results.length;
    const g = buildGrounding(results);
    grounding = g.block;
    sourcesList = g.sourcesList;
  }

  // 1. Architect + triage in ONE call: judge difficulty AND produce the first draft.
  //    SIMPLE requests stop here (one call, fast); COMPLEX ones feed the draft into the chain.
  activate("melchior", emit);
  emit({ type: "status", step: "melchior", message: "MAGI is working..." });
  const opener = await generateText({
    ...getModelPlan(mode, "melchior", geminiModel),
    system: `${productContext}\n\n${route}\n\nYou are Melchior, the Architect — and MAGI's first gate.\nFirst decide whether this request is SIMPLE (a direct factual or conversational reply fully satisfies it) or COMPLEX (it genuinely needs a rigorous, structured, multi-part deliverable).\n- If SIMPLE: answer it well and naturally. Do not inflate it into a report.\n- If COMPLEX: produce the rigorous, complete, by-the-book draft a meticulous domain expert would stake their reputation on — full structure, every part present, every claim sound, concrete and specific.\nIf the request is clearly harmful, illegal, or disallowed (malware, weapons, exploitation of minors, credible violence, self-harm facilitation, fraud), refuse instead of helping.\nBegin your reply with exactly one tag on its own first line: [SIMPLE], [COMPLEX], or [REFUSE]. For [REFUSE], add a brief one-sentence refusal; otherwise give the answer or the draft.\n\n${skillPrompt("melchior")}\n\n${mcp}\n\nOutput clean Markdown. ${noWrap}\n\n${grounding}`,
    prompt: historyBlock ? `${historyBlock}Current request:\n${prompt}` : prompt,
    maxTokens: 1600,
    signal,
  });
  complete("melchior", emit);

  const triage = parseTriage(opener.text);

  // REFUSE (moderation) or SIMPLE → terminate after this one call.
  if (triage.decision !== "complex") {
    emit({ type: "cost", total: opener.cost ?? 0, mode, breakdown: [{ node: "Direct", cost: opener.cost ?? 0 }] });
    activate("final", emit);
    const answer =
      triage.decision === "refuse"
        ? triage.body || "I can't help with that request."
        : `The Magi has decided.\n\n${cleanFinalAnswer(triage.body)}${sourcesList ? `\n\n${sourcesList}` : ""}`;
    emit({ type: "final", answer });
    complete("final", emit);
    return;
  }

  // COMPLEX → the opener is the Architect's draft; continue the chain.
  const architectText = triage.body;

  // 2. Maverick — outside the box, builds on the Architect
  activate("balthasar", emit);
  emit({ type: "skills", node: "Maverick", skills: skillLabels("balthasar"), sourcePath: skillPackPaths.balthasar });
  emit({ type: "status", step: "balthasar", message: "MAGI is working..." });
  // Each downstream node falls back to the best prior draft if it errors, so one
  // flaky model call degrades quality instead of failing the whole run.
  let maverickText = architectText;
  let maverickCost = 0;
  try {
    const maverick = await generateText({
      ...getModelPlan(mode, "balthasar", geminiModel),
      system: `${productContext}\n\n${route}\n\nYou are Balthasar, the Maverick. You receive the Architect's solid but safe draft and make it sharp. Find the non-obvious angle the Architect would never reach: the contrarian insight, the reframe, the bold move, the thing that makes this NOT sound like every other answer. ADD to the draft — keep all of its rigor and inject the edge it is missing. You are forbidden from merely polishing: every pass must introduce at least one genuinely fresh idea or differentiation.\n\n${skillPrompt("balthasar")}\n\n${mcp}\n\nReturn the COMPLETE improved deliverable in Markdown. ${noWrap} Also forbidden: deleting the Architect's substance for flair.\n\n${grounding}`,
      prompt: `Original request:\n${prompt}\n\nArchitect's draft to build on:\n${architectText}`,
      maxTokens: 1900,
      signal,
    });
    maverickText = maverick.text || architectText;
    maverickCost = maverick.cost ?? 0;
    emit({ type: "node", name: `Maverick (${maverick.provider})`, text: preview(maverick.text) });
  } catch {
    /* keep the Architect's draft */
  }
  complete("balthasar", emit);

  // 3. Adversary — red-team hardening, builds on the Maverick
  activate("casper", emit);
  emit({ type: "skills", node: "Adversary", skills: skillLabels("casper"), sourcePath: skillPackPaths.casper });
  emit({ type: "status", step: "casper", message: "MAGI is working..." });
  let adversaryText = maverickText;
  let adversaryCost = 0;
  try {
    const adversary = await generateText({
      ...getModelPlan(mode, "casper", geminiModel),
      system: `${productContext}\n\n${route}\n\nYou are Casper, the Adversary. Attack the combined work as a skeptical customer, tough investor, or tired operator would. Where does it fall apart? What is fragile, naive, missing, or over-promised? Then HARDEN it: cut weak claims, fill holes, answer objections, ground the hype — while keeping the rigor and the edge.\n\n${skillPrompt("casper")}\n\n${mcp}\n\nReturn the COMPLETE hardened deliverable in Markdown. ${noWrap} Also forbidden: politeness, softening, or leaving known weaknesses unaddressed.\n\nIf sources are provided below, cut or flag any claim they do not support, and keep inline [n] citations.\n\n${grounding}`,
      prompt: `Original request:\n${prompt}\n\nCurrent work to harden:\n${maverickText}`,
      maxTokens: 1900,
      signal,
    });
    adversaryText = adversary.text || maverickText;
    adversaryCost = adversary.cost ?? 0;
    emit({ type: "node", name: `Adversary (${adversary.provider})`, text: preview(adversary.text) });
  } catch {
    /* keep the Maverick draft */
  }
  complete("casper", emit);

  // 4. Synthesis — streams; falls back to the Adversary draft if it errors
  activate("judge", emit);
  emit({ type: "status", step: "judge", message: "MAGI is composing the final answer..." });
  emit({ type: "answer_start" });
  let synthesisText = "";
  let synthesisCost = 0;
  try {
    const synthesis = await generateTextStream(
      {
        ...getModelPlan(mode, "judge", geminiModel),
        system: `${productContext}\n\n${route}\n\nYou are the Synthesis — the final voice the user sees. Forge the rigor, the edge, and the hardening in the work so far into one clean, coherent, finished deliverable. Preserve all three: keep what is correct, keep what is sharp, keep what survived attack. Do not blend into bland mush or average into a gray median — keep the edges. Resolve conflicts in favor of the user's real goal.\n\n${skillPrompt("judge")}\n\nReturn the single polished deliverable in Markdown. ${noWrap} Also forbidden: re-opening settled debates, adding new untested ideas, or flattening distinct strengths.\n\nIf sources are provided below, keep inline [n] citations for sourced claims.\n\n${grounding}`,
        prompt: `Original request:\n${prompt}\n\nThe work so far (rigorous, sharpened, hardened) to finalize:\n${adversaryText}`,
        maxTokens: 2200,
        signal,
      },
      (piece) => emit({ type: "delta", text: piece })
    );
    synthesisText = synthesis.text;
    synthesisCost = synthesis.cost ?? 0;
  } catch {
    /* fall back to the hardened draft */
  }
  if (!synthesisText) synthesisText = adversaryText;
  complete("judge", emit);

  const costBreakdown = [
    { node: "Architect", cost: opener.cost ?? 0 },
    { node: "Maverick", cost: maverickCost },
    { node: "Adversary", cost: adversaryCost },
    { node: "Synthesis", cost: synthesisCost },
  ];
  emit({
    type: "cost",
    total: costBreakdown.reduce((sum, b) => sum + b.cost, 0),
    mode,
    breakdown: costBreakdown,
  });

  // Strip fabricated citations ([n] pointing past the real source count) so "cited"
  // never references a source that doesn't exist; then append the real Sources list.
  const body = stripDanglingCitations(cleanFinalAnswer(synthesisText), sourceCount);
  const clean = body + (sourcesList ? `\n\n${sourcesList}` : "");

  activate("final", emit);
  emit({ type: "status", step: "final", message: "Final ruling released." });
  emit({ type: "final", answer: `The Magi has decided.\n\n${clean}` });
  complete("final", emit);
}

function activate(step: PipelineStep, emit: Emit) {
  emit({ type: "step", step, state: "active" });
}

function complete(step: PipelineStep, emit: Emit) {
  emit({ type: "step", step, state: "done" });
}

function scanDifficulty(prompt: string, complexityBoost = 0): DifficultyResult {
  const words = prompt.trim().split(/\s+/).filter(Boolean).length;
  const lower = prompt.toLowerCase();
  if (
    /\b(build|create|make|generate|design)\b/.test(lower) &&
    /\b(website|site|landing page|web page|homepage|portfolio|ui|component)\b/.test(lower)
  ) {
    return {
      complex: true,
      score: Math.max(24, words + 16),
      reason: "Website/UI generation request. Ensemble activated.",
    };
  }

  const terms = [
    "create",
    "review",
    "build",
    "debug",
    "plan",
    "compare",
    "analyze",
    "design",
    "implement",
    "explain",
    "strategy",
    "risk",
    "code",
    "latest",
    "website",
    "landing page",
    "component",
    "ui",
  ];
  const hits = terms.filter((term) => lower.includes(term)).length;
  const score = words + hits * 8 + (prompt.match(/[?.,;:]/g) || []).length + complexityBoost;
  return {
    complex: score >= 18,
    score,
    reason: score >= 18 ? "Ensemble activated." : "Direct route selected.",
  };
}

// Instant, zero-cost answers for trivial inputs — no model call. Returns null otherwise.
function quickAnswer(prompt: string): string | null {
  const trimmed = prompt.trim().toLowerCase();
  const math = trimmed.match(/^(\d+)\s*([+\-*/])\s*(\d+)$/);
  if (math) {
    const left = Number(math[1]);
    const right = Number(math[3]);
    const result =
      math[2] === "+" ? left + right
      : math[2] === "-" ? left - right
      : math[2] === "*" ? left * right
      : right === 0 ? "undefined"
      : left / right;
    return String(result);
  }
  if (/^(hi|hello|hey)\b/.test(trimmed)) return "Hello. MAGI is online.";
  return null;
}

// Reads the opener's [SIMPLE]/[COMPLEX] tag and strips it from the body.
// Defaults to COMPLEX when no tag is found, to protect the quality promise on real work.

async function runJudgeLikeNode(
  mode: MagiMode,
  node: "casper" | "judge",
  system: string,
  originalPrompt: string,
  answer: string,
  geminiModel?: GeminiModel
): Promise<JudgeResult> {
  const plan = getModelPlan(mode, node, geminiModel);
  const result = await generateText({
    ...plan,
    system,
    prompt: `Original prompt:\n${originalPrompt}\n\nCandidate answer:\n${answer}`,
    maxTokens: 400,
    temperature: 0,
  });

  const parsed = parseJudgeJson(result.text);
  if (parsed) {
    return {
      passed: Boolean(parsed.passed),
      issue: parsed.issue || null,
      rationale: parsed.rationale || "No rationale supplied.",
    };
  }
  return {
    passed: true,
    issue: null,
    rationale: preview(result.text) || "No blocking issue detected.",
  };
}

// Models often wrap the verdict in ```json fences or add prose around it.
// Strip fences and fall back to the first {...} block so valid verdicts are not discarded.
function parseJudgeJson(text: string): Partial<JudgeResult> | null {
  const candidates: string[] = [];
  const unfenced = text.replace(/```(?:json)?/gi, "").trim();
  candidates.push(unfenced);
  const match = unfenced.match(/\{[\s\S]*\}/);
  if (match) candidates.push(match[0]);
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as Partial<JudgeResult>;
    } catch {
      // try next candidate
    }
  }
  return null;
}

// When to trigger a correction:
//  - The Fact Judge (correctness) can fire ON ITS OWN. A factually or logically wrong answer
//    must be fixed even if it stays on-intent (Casper checks intent, not correctness, so it
//    usually passes a wrong-but-on-topic answer and would otherwise veto the fix).
//  - Casper alone (intent drift, Judge passed) is NOT enough, to avoid over-rewriting on style.
function sharedObjection(casper: JudgeResult, judge: JudgeResult) {
  if (judge.passed) return null;
  const issues = [judge.issue, casper.passed ? null : casper.issue].filter(Boolean);
  if (issues.length === 0) return null;
  return issues.join("; ");
}

// Cheap builders sometimes emit the answer as a ```json {"final_answer": ...}``` envelope.
// Unwrap it so the user sees clean prose/code, not the internal artifact structure.

function preview(text: string, limit = 260) {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length > limit ? `${compact.slice(0, limit)}...` : compact;
}
