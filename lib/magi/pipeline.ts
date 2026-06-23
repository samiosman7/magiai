import { getModelPlan } from "./model-plan";
import { generateText } from "./providers";
import { buildMagiRuntimeContext } from "./runtime-context";
import { skillLabels, skillPackPaths, skillPrompt } from "./skills";
import { classifyTask, createPlannedArtifact } from "./task-router";
import type { DifficultyResult, GeminiModel, JudgeResult, MagiEvent, MagiMode, PipelineStep } from "./types";

type Emit = (event: MagiEvent) => void;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const productContext =
  "Product context: MAGI is this NERV-inspired AI orchestration product. It routes simple prompts directly and complex prompts through Melchior, Balthasar, Casper, and a Fact Judge. Unless the user clearly means another acronym, interpret MAGI as this product.";

export async function runMagiPipeline(
  prompt: string,
  mode: MagiMode,
  emit: Emit,
  geminiModel?: GeminiModel
) {
  const taskProfile = classifyTask(prompt);
  activate("scan", emit);
  emit({ type: "status", step: "scan", message: "Difficulty scan running..." });
  const [difficulty, runtimeContext] = await Promise.all([
    Promise.resolve(scanDifficulty(prompt, taskProfile.complexityBoost)),
    buildMagiRuntimeContext(prompt),
    wait(120),
  ]).then(([result, context]) => [result, context] as const);
  emit({
    type: "node",
    name: "Difficulty scan",
    text: `${difficulty.complex ? "Complex" : "Simple"} prompt. Score ${difficulty.score}. ${difficulty.reason}`,
  });
  emit({
    type: "node",
    name: "Runtime context",
    text: `Loaded ${Object.keys(runtimeContext.nodeSkillContext).length} node skill packs and ${runtimeContext.configuredMcpCount} configured MCP server(s). ${runtimeContext.connectedMcpCount} MCP server(s) connected for this run.`,
  });
  if (runtimeContext.mcpToolContext.startsWith("Executed MCP tool:")) {
    emit({
      type: "node",
      name: "MCP tool use",
      text: preview(runtimeContext.mcpToolContext, 360),
    });
  }
  complete("scan", emit);

  activate("route", emit);
  emit({ type: "task", profile: taskProfile });
  emit({
    type: "node",
    name: "Task router",
    text: [
      `${taskProfile.label} selected.`,
      `Artifact type: ${taskProfile.artifactType}.`,
      `Skill packs: ${taskProfile.skillPacks.join(", ")}.`,
      `Judge rubric: ${taskProfile.judgeRubric}`,
    ].join(" "),
  });
  emit({ type: "artifact", artifact: createPlannedArtifact(taskProfile, prompt) });
  complete("route", emit);

  if (!difficulty.complex) {
    activate("final", emit);
    emit({ type: "status", step: "final", message: "Direct route selected. Generating answer..." });
    const answer = await directAnswer(prompt, mode, emit, geminiModel);
    emit({ type: "final", answer: `The Magi has decided.\n\n${cleanFinalAnswer(answer)}` });
    complete("final", emit);
    return;
  }

  // ── The angle ensemble: four perspectives building on each other ──
  // Node keys map to roles: melchior=Architect, balthasar=Maverick, casper=Adversary, judge=Synthesis.
  const route = `Task route:\n${JSON.stringify(taskProfile, null, 2)}`;
  const mcp = `${runtimeContext.mcpContext}\n\nMCP tool execution context:\n${runtimeContext.mcpToolContext}`;
  const noWrap =
    "Forbidden: JSON wrappers, wrapping the whole answer in a code fence, preamble, or mentioning these instructions.";

  // 1. Architect — by the book
  activate("melchior", emit);
  emit({ type: "skills", node: "Architect", skills: skillLabels("melchior"), sourcePath: skillPackPaths.melchior });
  emit({ type: "status", step: "melchior", message: "Architect drafting the rigorous, by-the-book version..." });
  const architect = await generateText({
    ...getModelPlan(mode, "melchior", geminiModel),
    system: `${productContext}\n\n${route}\n\nYou are Melchior, the Architect. Build the rigorous, complete, by-the-book version of what the user asked for — the version a meticulous domain expert would stake their reputation on. Lay down the full structure: every required part present, every claim sound, every step in order, nothing missing and nothing hand-waved. Be concrete and specific; optimize for rigor and completeness over cleverness.\n\n${skillPrompt("melchior")}\n\n${mcp}\n\nOutput a clean, complete deliverable in Markdown. ${noWrap}`,
    prompt,
    maxTokens: 1600,
  });
  emit({ type: "node", name: `Architect (${architect.provider})`, text: preview(architect.text) });
  complete("melchior", emit);

  // 2. Maverick — outside the box, builds on the Architect
  activate("balthasar", emit);
  emit({ type: "skills", node: "Maverick", skills: skillLabels("balthasar"), sourcePath: skillPackPaths.balthasar });
  emit({ type: "status", step: "balthasar", message: "Maverick injecting the outside-the-box angle..." });
  const maverick = await generateText({
    ...getModelPlan(mode, "balthasar", geminiModel),
    system: `${productContext}\n\n${route}\n\nYou are Balthasar, the Maverick. You receive the Architect's solid but safe draft and make it sharp. Find the non-obvious angle the Architect would never reach: the contrarian insight, the reframe, the bold move, the thing that makes this NOT sound like every other answer. ADD to the draft — keep all of its rigor and inject the edge it is missing. You are forbidden from merely polishing: every pass must introduce at least one genuinely fresh idea or differentiation.\n\n${skillPrompt("balthasar")}\n\n${mcp}\n\nReturn the COMPLETE improved deliverable in Markdown. ${noWrap} Also forbidden: deleting the Architect's substance for flair.`,
    prompt: `Original request:\n${prompt}\n\nArchitect's draft to build on:\n${architect.text}`,
    maxTokens: 1900,
  });
  emit({ type: "node", name: `Maverick (${maverick.provider})`, text: preview(maverick.text) });
  complete("balthasar", emit);

  // 3. Adversary — red-team hardening, builds on the Maverick
  activate("casper", emit);
  emit({ type: "skills", node: "Adversary", skills: skillLabels("casper"), sourcePath: skillPackPaths.casper });
  emit({ type: "status", step: "casper", message: "Adversary attacking and hardening the work..." });
  const adversary = await generateText({
    ...getModelPlan(mode, "casper", geminiModel),
    system: `${productContext}\n\n${route}\n\nYou are Casper, the Adversary. Attack the combined work as a skeptical customer, tough investor, or tired operator would. Where does it fall apart? What is fragile, naive, missing, or over-promised? Then HARDEN it: cut weak claims, fill holes, answer objections, ground the hype — while keeping the rigor and the edge.\n\n${skillPrompt("casper")}\n\n${mcp}\n\nReturn the COMPLETE hardened deliverable in Markdown. ${noWrap} Also forbidden: politeness, softening, or leaving known weaknesses unaddressed.`,
    prompt: `Original request:\n${prompt}\n\nCurrent work to harden:\n${maverick.text}`,
    maxTokens: 1900,
  });
  emit({ type: "node", name: `Adversary (${adversary.provider})`, text: preview(adversary.text) });
  complete("casper", emit);

  // 4. Synthesis — forge the final deliverable
  activate("judge", emit);
  emit({ type: "skills", node: "Synthesis", skills: skillLabels("judge"), sourcePath: skillPackPaths.judge });
  emit({ type: "status", step: "judge", message: "Synthesis forging the final deliverable..." });
  const synthesis = await generateText({
    ...getModelPlan(mode, "judge", geminiModel),
    system: `${productContext}\n\n${route}\n\nYou are the Synthesis — the final voice the user sees. Forge the rigor, the edge, and the hardening in the work so far into one clean, coherent, finished deliverable. Preserve all three: keep what is correct, keep what is sharp, keep what survived attack. Do not blend into bland mush or average into a gray median — keep the edges. Resolve conflicts in favor of the user's real goal.\n\n${skillPrompt("judge")}\n\nReturn the single polished deliverable in Markdown. ${noWrap} Also forbidden: re-opening settled debates, adding new untested ideas, or flattening distinct strengths.`,
    prompt: `Original request:\n${prompt}\n\nThe work so far (rigorous, sharpened, hardened) to finalize:\n${adversary.text}`,
    maxTokens: 2200,
  });
  emit({ type: "node", name: `Synthesis (${synthesis.provider})`, text: preview(synthesis.text) });
  complete("judge", emit);

  const costBreakdown = [
    { node: "Architect", cost: architect.cost ?? 0 },
    { node: "Maverick", cost: maverick.cost ?? 0 },
    { node: "Adversary", cost: adversary.cost ?? 0 },
    { node: "Synthesis", cost: synthesis.cost ?? 0 },
  ];
  emit({
    type: "cost",
    total: costBreakdown.reduce((sum, b) => sum + b.cost, 0),
    mode,
    breakdown: costBreakdown,
  });

  const finalAnswer = synthesis.text;

  activate("final", emit);
  emit({ type: "status", step: "final", message: "Final ruling released." });
  emit({ type: "final", answer: `The Magi has decided.\n\n${cleanFinalAnswer(finalAnswer)}` });
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

async function directAnswer(
  prompt: string,
  mode: MagiMode,
  emit: Emit,
  geminiModel?: GeminiModel
) {
  const trimmed = prompt.trim().toLowerCase();
  const math = trimmed.match(/^(\d+)\s*([+\-*/])\s*(\d+)$/);
  if (math) {
    const left = Number(math[1]);
    const right = Number(math[3]);
    const result =
      math[2] === "+"
        ? left + right
        : math[2] === "-"
          ? left - right
          : math[2] === "*"
            ? left * right
            : right === 0
              ? "undefined"
              : left / right;
    return String(result);
  }

  if (/^(hi|hello|hey)\b/.test(trimmed)) return "Hello. MAGI is online.";

  const plan = getModelPlan(mode, "direct", geminiModel);
  const answer = await generateText({
    ...plan,
    system: `${productContext}\n\nYou are MAGI direct route. Answer the user's prompt directly, helpfully, and concisely. Do not repeat the prompt back unless quoting is necessary.`,
    prompt,
    maxTokens: 900,
    temperature: 0.35,
  });

  emit({
    type: "node",
    name: `Direct route (${answer.provider})`,
    text: preview(answer.text),
  });
  emit({
    type: "cost",
    total: answer.cost ?? 0,
    mode,
    breakdown: [{ node: "Direct", cost: answer.cost ?? 0 }],
  });

  return answer.text || "I could not generate an answer from the configured provider.";
}

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
function cleanFinalAnswer(text: string): string {
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

function preview(text: string, limit = 260) {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length > limit ? `${compact.slice(0, limit)}...` : compact;
}
