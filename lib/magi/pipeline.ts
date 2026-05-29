import { getModelPlan } from "./model-plan";
import { generateText } from "./providers";
import { buildMagiRuntimeContext } from "./runtime-context";
import { skillLabels, skillPackPaths, skillPrompt } from "./skills";
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
  activate("scan", emit);
  emit({ type: "status", step: "scan", message: "Difficulty scan running..." });
  const [difficulty, runtimeContext] = await Promise.all([
    Promise.resolve(scanDifficulty(prompt)),
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

  if (!difficulty.complex) {
    activate("final", emit);
    emit({ type: "status", step: "final", message: "Direct route selected. Generating answer..." });
    const answer = await directAnswer(prompt, mode, emit, geminiModel);
    emit({ type: "final", answer: `The Magi has decided.\n\n${answer}` });
    complete("final", emit);
    return;
  }

  activate("melchior", emit);
  emit({
    type: "skills",
    node: "Melchior",
    skills: skillLabels("melchior"),
    sourcePath: skillPackPaths.melchior,
  });
  emit({ type: "status", step: "melchior", message: "Melchior repairing gaps and missing reasoning..." });
  const melchiorPlan = getModelPlan(mode, "melchior", geminiModel);
  const melchior = await generateText({
    ...melchiorPlan,
    system: `${productContext}\n\nYou are Melchior, the correction and gap-filling node. Repair missing steps, identify assumptions, preserve the user's goal, and return a concise repaired draft.\n\n${skillPrompt("melchior")}\n\nFull Melchior SKILL.md:\n${runtimeContext.nodeSkillContext.melchior}\n\n${runtimeContext.mcpContext}\n\nMCP tool execution context:\n${runtimeContext.mcpToolContext}`,
    prompt,
    maxTokens: 900,
  });
  emit({ type: "node", name: `Melchior (${melchior.provider})`, text: preview(melchior.text) });
  complete("melchior", emit);

  activate("balthasar", emit);
  emit({
    type: "skills",
    node: "Balthasar",
    skills: skillLabels("balthasar"),
    sourcePath: skillPackPaths.balthasar,
  });
  emit({ type: "status", step: "balthasar", message: "Balthasar hardening the answer..." });
  const balthasarPlan = getModelPlan(mode, "balthasar", geminiModel);
  const balthasar = await generateText({
    ...balthasarPlan,
    system: `${productContext}\n\nYou are Balthasar, the builder and hardener. Turn the repaired draft into a concrete, polished, directly usable answer. Do not mention internal deliberation.\n\n${skillPrompt("balthasar")}\n\nFull Balthasar SKILL.md:\n${runtimeContext.nodeSkillContext.balthasar}\n\nProject and cross-functional skill packs:\n${runtimeContext.projectSkillContext}\n\n${runtimeContext.mcpContext}\n\nMCP tool execution context:\n${runtimeContext.mcpToolContext}`,
    prompt: `Original prompt:\n${prompt}\n\nMelchior repaired draft:\n${melchior.text}`,
    maxTokens: 1200,
  });
  emit({ type: "node", name: `Balthasar (${balthasar.provider})`, text: preview(balthasar.text) });
  complete("balthasar", emit);

  activate("casper", emit);
  activate("judge", emit);
  emit({
    type: "skills",
    node: "Casper",
    skills: skillLabels("casper"),
    sourcePath: skillPackPaths.casper,
  });
  emit({
    type: "skills",
    node: "Fact Judge",
    skills: skillLabels("judge"),
    sourcePath: skillPackPaths.judge,
  });
  emit({ type: "status", step: "casper", message: "Casper checking intent drift..." });
  emit({ type: "status", step: "judge", message: "Fact Judge verifying correctness..." });

  const [casper, judge] = await Promise.all([
    runJudgeLikeNode(
      mode,
      "casper",
      `${productContext}\n\nYou are Casper, the intent-preservation and dramatic-change monitor. Return strict JSON with passed, issue, and rationale. Flag only if the answer drifts from the original request.\n\n${skillPrompt("casper")}\n\nFull Casper SKILL.md:\n${runtimeContext.nodeSkillContext.casper}\n\n${runtimeContext.mcpContext}\n\nMCP tool execution context:\n${runtimeContext.mcpToolContext}`,
      prompt,
      balthasar.text,
      geminiModel
    ),
    runJudgeLikeNode(
      mode,
      "judge",
      `${productContext}\n\nYou are a fresh, independent correctness judge. Return strict JSON with passed, issue, and rationale. Flag only blocking factual, logic, or instruction-following problems.\n\n${skillPrompt("judge")}\n\nFull Fact Judge SKILL.md:\n${runtimeContext.nodeSkillContext.judge}\n\n${runtimeContext.mcpContext}\n\nMCP tool execution context:\n${runtimeContext.mcpToolContext}`,
      prompt,
      balthasar.text,
      geminiModel
    ),
  ]);

  emit({
    type: "node",
    name: "Casper",
    text: casper.issue ? `Flagged: ${casper.issue}. ${casper.rationale}` : casper.rationale,
  });
  emit({
    type: "node",
    name: "Fact Judge",
    text: judge.issue ? `Flagged: ${judge.issue}. ${judge.rationale}` : judge.rationale,
  });
  complete("casper", emit);
  complete("judge", emit);

  let finalAnswer = balthasar.text;
  const sharedIssue = sharedObjection(casper, judge);
  if (sharedIssue) {
    emit({
      type: "status",
      step: "melchior",
      message: "Dual-signal rule triggered. Melchior and Balthasar revising around the shared objection...",
    });
    activate("melchior", emit);
    activate("balthasar", emit);
    const revision = await generateText({
      ...balthasarPlan,
      system: `${productContext}\n\nYou are Melchior and Balthasar in a correction loop. Fix the shared objection while preserving the user's intent. Return only the revised final answer.\n\n${skillPrompt("melchior")}\n\n${runtimeContext.nodeSkillContext.melchior}\n\n${skillPrompt("balthasar")}\n\n${runtimeContext.nodeSkillContext.balthasar}\n\n${runtimeContext.projectSkillContext}\n\n${runtimeContext.mcpContext}\n\nMCP tool execution context:\n${runtimeContext.mcpToolContext}`,
      prompt: `Original prompt:\n${prompt}\n\nPrevious answer:\n${balthasar.text}\n\nShared objection:\n${sharedIssue}`,
      maxTokens: 1300,
    });
    finalAnswer = revision.text;
    emit({ type: "node", name: "Reprompt loop", text: `Revised around: ${sharedIssue}` });
    complete("melchior", emit);
    complete("balthasar", emit);
  }

  activate("final", emit);
  emit({ type: "status", step: "final", message: "Final ruling released." });
  emit({ type: "final", answer: `The Magi has decided.\n\n${finalAnswer}` });
  complete("final", emit);
}

function activate(step: PipelineStep, emit: Emit) {
  emit({ type: "step", step, state: "active" });
}

function complete(step: PipelineStep, emit: Emit) {
  emit({ type: "step", step, state: "done" });
}

function scanDifficulty(prompt: string): DifficultyResult {
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
  const score = words + hits * 8 + (prompt.match(/[?.,;:]/g) || []).length;
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

  try {
    const parsed = JSON.parse(result.text) as Partial<JudgeResult>;
    return {
      passed: Boolean(parsed.passed),
      issue: parsed.issue || null,
      rationale: parsed.rationale || "No rationale supplied.",
    };
  } catch {
    return {
      passed: true,
      issue: null,
      rationale: preview(result.text) || "No blocking issue detected.",
    };
  }
}

function sharedObjection(casper: JudgeResult, judge: JudgeResult) {
  if (!casper.issue || !judge.issue) return null;
  const casperTerms = normalizeIssue(casper.issue);
  const judgeTerms = normalizeIssue(judge.issue);
  const overlap = casperTerms.some((term) => judgeTerms.includes(term));
  return overlap ? `${casper.issue}; ${judge.issue}` : null;
}

function normalizeIssue(issue: string) {
  return issue
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((term) => term.length > 4);
}

function preview(text: string, limit = 260) {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length > limit ? `${compact.slice(0, limit)}...` : compact;
}
