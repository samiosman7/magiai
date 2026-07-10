import type { MagiArtifact, TaskKind, TaskProfile } from "./types";

type TaskRule = {
  kind: TaskKind;
  label: string;
  pattern: RegExp;
  artifactType: MagiArtifact["type"];
  skills: string[];
  judge: string;
  toolHints: string[];
};

const taskRules: TaskRule[] = [
  {
    kind: "legal",
    label: "Legal document review",
    pattern: /\b(contract|agreement|lease|nda|clause|legal|liabilit|indemnif|tenant|landlord|settlement|waiver|terms of service|privacy policy|obligation|non-disclosure)\b/,
    artifactType: "report",
    skills: ["melchior-diagnostics", "fact-judge-auditor", "casper-guardian"],
    judge:
      "Clause coverage, accuracy of obligations/dates/liabilities, unusual or risky terms flagged, nothing invented beyond the document, and a not-legal-advice disclaimer present.",
    toolHints: ["clause extraction", "obligation map", "risk flags", "plain-English summary"],
  },
  {
    kind: "website",
    label: "Website or UI build",
    pattern: /\b(website|site|landing page|homepage|web page|ui|component|portfolio)\b/,
    artifactType: "project",
    skills: ["ui-ux-product-design", "agentic-project-builder", "mcp-tool-orchestration"],
    judge: "Visual, responsive, copy, accessibility, and prompt-adherence review.",
    toolHints: ["21st.dev Magic inspiration", "browser preview", "screenshot critique", "ZIP export"],
  },
  {
    kind: "coding",
    label: "Coding or debugging",
    pattern: /\b(code|bug|debug|fix|implement|refactor|repo|api|typescript|javascript|python|build error|test)\b/,
    artifactType: "code",
    skills: ["melchior-diagnostics", "balthasar-builder", "fact-judge-auditor"],
    judge: "Compile, test, runtime, security, regression, and integration review.",
    toolHints: ["repo inspection", "patch generation", "build/test commands", "diff review"],
  },
  {
    kind: "research",
    label: "Research or fact finding",
    pattern: /\b(research|find sources|latest|current|compare|cite|citation|sources|look up|market)\b/,
    artifactType: "report",
    skills: ["melchior-diagnostics", "fact-judge-auditor", "product-strategy-growth"],
    judge: "Source quality, recency, claim support, uncertainty, and citation coverage.",
    toolHints: ["web search", "source extraction", "citation table", "recency checks"],
  },
  {
    kind: "writing",
    label: "Writing or editing",
    pattern: /\b(write|rewrite|edit|copy|email|essay|script|post|tone|story|proposal)\b/,
    artifactType: "document",
    skills: ["balthasar-builder", "casper-guardian"],
    judge: "Audience fit, tone, structure, clarity, and instruction adherence.",
    toolHints: ["outline", "draft variants", "style pass", "final polish"],
  },
  {
    kind: "analysis",
    label: "Analysis or strategy",
    pattern: /\b(analyze|strategy|plan|pricing|business|roadmap|risk|metrics|forecast|model)\b/,
    artifactType: "plan",
    skills: ["product-strategy-growth", "melchior-diagnostics", "fact-judge-auditor"],
    judge: "Assumptions, feasibility, cost, tradeoffs, risk, and decision quality.",
    toolHints: ["assumption map", "risk matrix", "option scoring", "execution plan"],
  },
  {
    kind: "data",
    label: "Data or document processing",
    pattern: /\b(csv|spreadsheet|excel|data|dataset|chart|graph|pdf|table|calculate|statistics)\b/,
    artifactType: "data",
    skills: ["melchior-diagnostics", "fact-judge-auditor", "balthasar-builder"],
    judge: "Calculation correctness, schema fit, missing data, and reproducibility.",
    toolHints: ["file parser", "calculation check", "chart generation", "data export"],
  },
  {
    kind: "automation",
    label: "Automation or workflow",
    pattern: /\b(automate|automation|remind|monitor|schedule|workflow|agent|run every|notify)\b/,
    artifactType: "plan",
    skills: ["mcp-tool-orchestration", "balthasar-builder", "fact-judge-auditor"],
    judge: "Trigger correctness, permissions, failure handling, idempotency, and cost.",
    toolHints: ["scheduled job", "connector setup", "webhook plan", "execution log"],
  },
];

export function classifyTask(prompt: string, options?: { forceLegal?: boolean }): TaskProfile {
  const lower = prompt.toLowerCase();
  let matches = taskRules.filter((rule) => rule.pattern.test(lower));
  // Attachments can look legal even when the prompt is terse ("review this"):
  // pull the legal rule to the front so the run routes and rubrics as legal.
  if (options?.forceLegal) {
    const legalRule = taskRules.find((rule) => rule.kind === "legal");
    if (legalRule) matches = [legalRule, ...matches.filter((rule) => rule.kind !== "legal")];
  }
  const primary = matches[0] ?? {
    kind: "general" as const,
    label: "General assistant task",
    artifactType: "answer" as const,
    skills: ["melchior-diagnostics", "balthasar-builder", "casper-guardian", "fact-judge-auditor"],
    judge: "Helpfulness, correctness, intent preservation, and completeness.",
    toolHints: ["direct answer", "structured reasoning", "final verification"],
  };

  return {
    kind: primary.kind,
    label: primary.label,
    complexityBoost: matches.length * 4,
    artifactType: primary.artifactType,
    skillPacks: primary.skills,
    judgeRubric: primary.judge,
    toolHints: primary.toolHints,
    secondaryKinds: matches.slice(1).map((rule) => rule.kind),
  };
}

export function createPlannedArtifact(profile: TaskProfile, prompt: string): MagiArtifact {
  const title = inferArtifactTitle(profile, prompt);

  return {
    id: `artifact-${Date.now().toString(36)}`,
    type: profile.artifactType,
    title,
    status: profile.artifactType === "project" ? "ready_for_export" : "planned",
    summary:
      profile.artifactType === "project"
        ? "Generated project artifacts can be exported when the task asks for downloadable files."
        : "This run is routed as a universal MAGI task. Persistent saved artifacts are the next storage layer.",
    actions:
      profile.kind === "website"
        ? [{ label: "Generate ZIP", action: "download_website" }]
        : [{ label: "Save artifact", action: "save_planned" }],
  };
}

function inferArtifactTitle(profile: TaskProfile, prompt: string) {
  const cleaned = prompt.replace(/\s+/g, " ").trim();
  const prefix = profile.label;
  return `${prefix}: ${cleaned.length > 54 ? `${cleaned.slice(0, 54)}...` : cleaned}`;
}
