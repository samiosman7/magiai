export type MagiNode = "melchior" | "balthasar" | "casper" | "judge";

export type MagiSkill = {
  id: string;
  label: string;
  instruction: string;
};

export const skillPackPaths: Record<MagiNode, string> = {
  melchior: "magi-skills/melchior-diagnostics/SKILL.md",
  balthasar: "magi-skills/balthasar-builder/SKILL.md",
  casper: "magi-skills/casper-guardian/SKILL.md",
  judge: "magi-skills/fact-judge-auditor/SKILL.md",
};

export const magiSkills: Record<MagiNode, MagiSkill[]> = {
  melchior: [
    {
      id: "requirements-extraction",
      label: "Requirements Extraction",
      instruction:
        "Extract explicit and implied requirements before drafting. Separate must-have requirements from nice-to-have details.",
    },
    {
      id: "missing-step-detection",
      label: "Missing-Step Detection",
      instruction:
        "Identify skipped reasoning, setup steps, dependencies, or decisions that would make the answer incomplete.",
    },
    {
      id: "assumption-tracking",
      label: "Assumption Tracking",
      instruction:
        "List assumptions that are necessary to proceed, and keep them conservative unless the user gave stronger evidence.",
    },
    {
      id: "edge-case-discovery",
      label: "Edge-Case Discovery",
      instruction:
        "Look for boundary cases, failure modes, unusual inputs, and cases where the proposed answer would break.",
    },
    {
      id: "ambiguity-resolution",
      label: "Ambiguity Resolution",
      instruction:
        "Resolve ambiguity with the most likely interpretation, and name any interpretation that would materially change the answer.",
    },
    {
      id: "constraint-mapping",
      label: "Constraint Mapping",
      instruction:
        "Map technical, product, timing, cost, safety, style, and user-specified constraints before proposing a path.",
    },
    {
      id: "risk-identification",
      label: "Risk Identification",
      instruction:
        "Call out risks that could make the answer wrong, expensive, slow, unsafe, or misaligned with the user goal.",
    },
    {
      id: "architecture-critique",
      label: "Architecture Critique",
      instruction:
        "Critique the structure of the solution: interfaces, dependencies, ownership boundaries, scalability, and maintainability.",
    },
    {
      id: "root-cause-analysis",
      label: "Root-Cause Analysis",
      instruction:
        "For bugs or failures, distinguish symptoms from root causes and avoid patching only the visible surface.",
    },
    {
      id: "failure-analysis",
      label: "Failure Analysis",
      instruction:
        "Ask what would make this fail in real use, then repair the answer around those failure points.",
    },
  ],
  balthasar: [
    {
      id: "final-answer-synthesis",
      label: "Final Answer Synthesis",
      instruction:
        "Convert analysis into one coherent, user-facing answer with a clear recommendation and no visible internal debate.",
    },
    {
      id: "code-file-generation",
      label: "Code/File Generation",
      instruction:
        "When the task asks for build output, produce complete file-level artifacts with filenames, contents, and integration notes.",
    },
    {
      id: "ui-generation",
      label: "UI Generation",
      instruction:
        "For interface tasks, generate usable UI structure, responsive layout decisions, states, controls, and polished copy.",
    },
    {
      id: "refactoring",
      label: "Refactoring",
      instruction:
        "Improve implementation shape without unnecessary churn. Preserve behavior unless the user requested a behavior change.",
    },
    {
      id: "implementation-planning",
      label: "Implementation Planning",
      instruction:
        "Break the answer into practical build steps ordered by dependency, risk, and user value.",
    },
    {
      id: "api-integration",
      label: "API Integration",
      instruction:
        "Define server-only secrets, request/response contracts, error handling, rate limits, and provider fallback behavior.",
    },
    {
      id: "product-copywriting",
      label: "Product Copywriting",
      instruction:
        "Write concise product copy that communicates the offer clearly without hype or vague claims.",
    },
    {
      id: "project-scaffolding",
      label: "Project Scaffolding",
      instruction:
        "Create sensible project structure, dependency choices, scripts, and README guidance for generated apps or websites.",
    },
    {
      id: "deployment-preparation",
      label: "Deployment Preparation",
      instruction:
        "Include deploy-critical setup: env vars, build commands, output settings, runtime constraints, and verification steps.",
    },
    {
      id: "usability-hardening",
      label: "Usability Hardening",
      instruction:
        "Make the result actually usable: fill gaps, remove ambiguity, add defaults, and include a realistic next action.",
    },
  ],
  casper: [
    {
      id: "intent-preservation",
      label: "Intent Preservation",
      instruction:
        "Check whether the candidate answer preserves the original ask, priority, constraints, and implied desired outcome.",
    },
    {
      id: "scope-creep-detection",
      label: "Scope Creep Detection",
      instruction:
        "Flag additions that make the answer larger, slower, more expensive, or less focused than the user requested.",
    },
    {
      id: "tone-style-matching",
      label: "Tone/Style Matching",
      instruction:
        "Check whether the answer matches the user's requested tone, format, level of detail, and product personality.",
    },
    {
      id: "constraint-enforcement",
      label: "Constraint Enforcement",
      instruction:
        "Verify that user-stated constraints are followed exactly unless there is a clear reason to warn or refuse.",
    },
    {
      id: "dramatic-change-detection",
      label: "Dramatic-Change Detection",
      instruction:
        "Flag sudden direction changes, overcorrections, reframes, or substitutions that the user did not ask for.",
    },
    {
      id: "actual-answer-check",
      label: "Actual Answer Check",
      instruction:
        "Ask whether the candidate actually answers the user's question or merely talks around it.",
    },
    {
      id: "ux-coherence-review",
      label: "UX Coherence Review",
      instruction:
        "For product/UI answers, check workflow clarity, screen hierarchy, text fit, predictable controls, and user effort.",
    },
    {
      id: "brand-consistency-review",
      label: "Brand Consistency Review",
      instruction:
        "Check that naming, language, visual direction, and product claims remain consistent with MAGI's brand.",
    },
    {
      id: "cost-speed-sanity",
      label: "Cost/Speed Sanity",
      instruction:
        "Flag choices that unnecessarily increase latency, model spend, operational complexity, or user wait time.",
    },
    {
      id: "user-trust-check",
      label: "User Trust Check",
      instruction:
        "Flag behavior that would surprise the user, hide tradeoffs, overpromise, or make the system feel unreliable.",
    },
  ],
  judge: [
    {
      id: "factual-verification",
      label: "Factual Verification",
      instruction:
        "Check factual claims for correctness, uncertainty, and whether they require current external verification.",
    },
    {
      id: "logic-checking",
      label: "Logic Checking",
      instruction:
        "Check whether the reasoning, sequence, math, and conclusions follow from the inputs.",
    },
    {
      id: "build-test-interpretation",
      label: "Build/Test Interpretation",
      instruction:
        "For engineering tasks, treat build/test results as primary evidence and flag unresolved failures.",
    },
    {
      id: "security-review",
      label: "Security Review",
      instruction:
        "Check for leaked secrets, unsafe auth assumptions, injection risks, permission issues, and abusive usage paths.",
    },
    {
      id: "provider-compatibility",
      label: "Provider Compatibility",
      instruction:
        "Check whether provider model names, env vars, API contracts, and fallback rules are compatible with the implementation.",
    },
    {
      id: "pricing-cost-sanity",
      label: "Pricing/Cost Sanity",
      instruction:
        "Check token, model, subscription, and infrastructure cost claims for plausibility and hidden margin risk.",
    },
    {
      id: "citation-requirement",
      label: "Citation Requirement Check",
      instruction:
        "Flag answers that need sources, links, dates, or evidence but provide none.",
    },
    {
      id: "hallucination-detection",
      label: "Hallucination Detection",
      instruction:
        "Flag invented facts, fake APIs, fake files, fake test results, or unsupported claims.",
    },
    {
      id: "math-token-cost-validation",
      label: "Math/Token/Cost Validation",
      instruction:
        "Recalculate numeric claims, token estimates, limits, rates, and pricing examples before passing the answer.",
    },
    {
      id: "runtime-verification",
      label: "Runtime Verification",
      instruction:
        "Check whether the proposed answer can actually run in the target environment and names any missing runtime requirement.",
    },
  ],
};

export function skillLabels(node: MagiNode) {
  return magiSkills[node].map((skill) => skill.label);
}

export function skillPrompt(node: MagiNode) {
  return [
    `Skill pack source: ${skillPackPaths[node]}`,
    "Active skill stack:",
    ...magiSkills[node].map((skill) => `- ${skill.label}: ${skill.instruction}`),
  ].join("\n");
}
