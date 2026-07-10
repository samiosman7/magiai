import { getModelPlan } from "./model-plan";
import { generateText, generateTextStream } from "./providers";
import { buildMagiRuntimeContext } from "./runtime-context";
import { skillLabels, skillPackPaths, skillPrompt } from "./skills";
import { classifyTask, createPlannedArtifact } from "./task-router";
import { webSearch, buildGrounding } from "./search";
import { parseTriage, cleanFinalAnswer, stripDanglingCitations } from "./text-utils";
import { buildAttachmentBlock, looksLegal, attachmentSummary, type Attachment } from "./attachments";
import type { GeminiModel, MagiEvent, MagiMode, PipelineStep } from "./types";

type Emit = (event: MagiEvent) => void;

const productContext =
  'You are one stage of MAGI, an AI system that turns a request into a verified, well-sourced deliverable. If a request refers to "MAGI," treat it as this product unless the user clearly means something else.';

export async function runMagiPipeline(
  prompt: string,
  mode: MagiMode,
  emit: Emit,
  geminiModel?: GeminiModel,
  signal?: AbortSignal,
  history?: Array<{ role: string; text: string }>,
  attachments: Attachment[] = []
) {
  const hasFiles = attachments.some((a) => a.ok && a.text);
  const isLegal = looksLegal(attachments, prompt);
  const taskProfile = classifyTask(prompt, { forceLegal: isLegal });

  const historyBlock =
    history && history.length
      ? `Conversation so far (most recent last):\n${history
          .map((h) => `${h.role === "user" ? "User" : "MAGI"}: ${h.text.slice(0, 1500)}`)
          .join("\n")}\n\n---\n\n`
      : "";

  // Instant, free shortcuts (greetings, plain arithmetic) — no model call at all.
  // Skipped when files are attached: an uploaded doc always deserves a real read.
  const quick = hasFiles ? null : quickAnswer(prompt);
  if (quick !== null) {
    emit({ type: "final", answer: `The Magi has decided.\n\n${quick}` });
    return;
  }

  emit({ type: "status", step: "scan", message: "MAGI is reading your request..." });
  const runtimeContext = await buildMagiRuntimeContext(prompt);
  emit({ type: "task", profile: taskProfile });
  emit({ type: "artifact", artifact: createPlannedArtifact(taskProfile, prompt) });

  // Uploaded files: injected into every node so their content survives the whole
  // chain (unlike history, which only the Architect sees). Legal docs get an
  // extra clause-review directive + a mandatory not-legal-advice disclaimer.
  const attachmentBlock = buildAttachmentBlock(attachments);
  if (attachments.length) {
    emit({ type: "status", step: "scan", message: `MAGI is reading files — ${attachmentSummary(attachments)}` });
    emit({ type: "node", name: "Attachments", text: attachmentSummary(attachments) });
  }
  const legalDirective = isLegal
    ? "\n\nLEGAL DOCUMENT MODE: Work only from the attached/quoted document text. Identify the parties, key obligations, payment/terms, important dates and deadlines, liability and indemnity, termination and renewal, confidentiality/IP, and governing law. Flag unusual, one-sided, ambiguous, or risky clauses and anything a reasonable party would expect but is missing. Quote exact clause language when it matters. Do not invent terms that are not present. Always end with: \"This is general information, not legal advice.\""
    : "";
  const fileContext = `${attachmentBlock ? `\n\n${attachmentBlock}` : ""}${legalDirective}`;

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
    system: `${productContext}\n\n${route}\n\nYou are Melchior, the Architect — MAGI's first gate. You decide the request type and, for real work, design the blueprint the builder will follow. You do NOT write the final deliverable yourself.\nClassify, then act:\n- SIMPLE — a direct factual or conversational reply fully answers it. Answer it directly; do not pad it into a report.\n- COMPLEX — it needs a structured, multi-part deliverable. Output a PLAN, not prose: the exact sections/components it must contain, the must-have requirements (including ones the user implied but did not state), the approach to take, and the key facts or constraints to respect. Be complete — anything you leave out, the builder will not include.\n- REFUSE — clearly harmful or illegal (malware, weapons, exploitation of minors, credible violence, self-harm facilitation, fraud). Refuse in one sentence.\nWhen files are attached and the user asks you to review, analyze, summarize, extract from, or compare them, treat it as COMPLEX and have the plan cover the document thoroughly.\nBegin with exactly one tag on its own first line: [SIMPLE], [COMPLEX], or [REFUSE]. After the tag: the answer (SIMPLE), the plan (COMPLEX), or the one-sentence refusal (REFUSE).\n\n${skillPrompt("melchior")}\n\n${mcp}\n\nOutput clean Markdown. ${noWrap}\n\n${grounding}${fileContext}`,
    prompt: historyBlock ? `${historyBlock}Current request:\n${prompt}` : prompt,
    maxTokens: 900,
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

  // COMPLEX → the opener is the Architect's PLAN; the chain builds from it.
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
      system: `${productContext}\n\n${route}\n\nYou are Balthasar, the Maverick — the builder. You receive the Architect's plan and write the actual deliverable from it: cover every section and requirement in the plan, in full, concrete prose (or code/tables as fitting). As you build, add what a conventional execution would miss — a sharper framing, a non-obvious insight, or a real differentiator — at least one, and only where it genuinely strengthens the work, never as decoration. Follow the plan's structure; do not drop its requirements.\n\n${skillPrompt("balthasar")}\n\n${mcp}\n\nReturn the COMPLETE deliverable in Markdown. ${noWrap}\n\n${grounding}${fileContext}`,
      prompt: `Original request:\n${prompt}\n\nArchitect's plan to build from:\n${architectText}`,
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
  let adversaryText = "";
  let adversaryCost = 0;
  try {
    const adversary = await generateText({
      ...getModelPlan(mode, "casper", geminiModel),
      system: `${productContext}\n\n${route}\n\nYou are Casper, the Adversary — a ruthless devil's advocate. You do NOT rewrite the deliverable. Read it as a skeptical customer, tough investor, and tired operator would, and output a sharp CRITIQUE: a numbered list of its real weaknesses — what is fragile, naive, unsupported, missing, or over-promised — and any claim the sources below do not support. Be specific; point to where each problem is. List only genuine problems; if something is solid, do not invent a complaint.\n\n${skillPrompt("casper")}\n\n${mcp}\n\nOutput ONLY the numbered critique — no rewritten deliverable, no preamble. ${noWrap}\n\n${grounding}${fileContext}`,
      prompt: `Original request:\n${prompt}\n\nDeliverable to critique:\n${maverickText}`,
      maxTokens: 800,
      signal,
    });
    adversaryText = adversary.text || "";
    adversaryCost = adversary.cost ?? 0;
    emit({ type: "node", name: `Adversary (${adversary.provider})`, text: preview(adversary.text) });
  } catch {
    /* no critique; Synthesis just finalizes the build */
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
        system: `${productContext}\n\n${route}\n\nYou are the Synthesis — the final voice the user sees. You receive the builder's deliverable and the Adversary's critique. Produce the finished deliverable: keep everything strong in the build, and FIX every valid point in the critique — correct or remove unsupported claims, fill the gaps, answer the objections. Ignore critique points that are wrong or pedantic. Read as one confident author.\n\n${skillPrompt("judge")}\n\nReturn ONLY the single finished deliverable in Markdown — not a list of changes, not the critique. ${noWrap} If sources are provided below, keep inline [n] citations for sourced claims.\n\n${grounding}${fileContext}`,
        // Synthesis is the final voice, so it (not just the Architect) gets the
        // conversation history — follow-ups like "make it shorter" or "now as an
        // email" keep their context all the way to the answer the user sees.
        prompt: `${historyBlock}Original request:\n${prompt}\n\nDeliverable:\n${maverickText}\n\nAdversary critique to resolve (fix valid points, ignore wrong ones):\n${adversaryText || "(no critique returned — finalize the deliverable as-is)"}`,
        maxTokens: 2200,
        signal,
      },
      (piece) => emit({ type: "delta", text: piece })
    );
    synthesisText = synthesis.text;
    synthesisCost = synthesis.cost ?? 0;
  } catch {
    /* fall back to the builder's deliverable */
  }
  if (!synthesisText) synthesisText = maverickText;
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

function preview(text: string, limit = 260) {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length > limit ? `${compact.slice(0, limit)}...` : compact;
}
