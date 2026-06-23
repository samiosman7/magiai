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

// Node keys are kept stable (melchior/balthasar/casper/judge) so model routing and skill
// loading keep working, but each is now a PERSPECTIVE, not a pipeline stage:
//   melchior  = The Architect (by the book)
//   balthasar = The Maverick  (outside the box)
//   casper    = The Adversary (red-team)
//   judge     = The Synthesis (final integrator)
export const magiSkills: Record<MagiNode, MagiSkill[]> = {
  melchior: [
    { id: "requirements-extraction", label: "Requirements Extraction", instruction: "Surface every explicit and implied requirement before drafting; separate must-haves from nice-to-haves." },
    { id: "structure-first", label: "Structure-First Drafting", instruction: "Lay out the complete skeleton — all required sections present — before filling detail." },
    { id: "constraint-mapping", label: "Constraint Mapping", instruction: "Map every technical, cost, timing, scope, and user-stated constraint and honor each one." },
    { id: "specificity-discipline", label: "Specificity Discipline", instruction: "Replace generalities with concrete numbers, names, and steps. No vague placeholders." },
    { id: "completeness", label: "Completeness Enforcement", instruction: "Check that nothing the task asked for is silently dropped." },
    { id: "soundness", label: "Soundness Check", instruction: "Verify each claim and step actually follows. No leaps." },
    { id: "standard-practice", label: "Standard-Practice Grounding", instruction: "Anchor in how a competent professional in this field would actually do it." },
  ],
  balthasar: [
    { id: "reframe-hunting", label: "Reframe Hunting", instruction: "Find the angle that recasts the whole problem — what is this really about?" },
    { id: "contrarian-angle", label: "Contrarian Angle", instruction: "Identify where the obvious answer is shallow or wrong, and say so." },
    { id: "differentiation", label: "Differentiation Injection", instruction: "Add the move that makes this stand out from what every competitor or generic AI would produce." },
    { id: "analogy-transfer", label: "Analogy Transfer", instruction: "Import what works from a different domain or industry." },
    { id: "assumption-inversion", label: "Assumption Inversion", instruction: "Flip a default assumption and see if the better answer lives on the other side." },
    { id: "edge-voice", label: "Edge & Voice", instruction: "Give it a confident, specific, memorable point of view — not committee-speak." },
  ],
  casper: [
    { id: "objection-surfacing", label: "Objection Surfacing", instruction: "Name the hardest objection a smart skeptic would raise, then address it in the work." },
    { id: "failure-mode-probing", label: "Failure-Mode Probing", instruction: "Ask what makes this fail in real use, and repair around those points." },
    { id: "hype-removal", label: "Hype Removal", instruction: "Cut unsupported superlatives and replace them with defensible specifics." },
    { id: "gap-filling", label: "Gap Filling", instruction: "Find what is conspicuously missing and add it." },
    { id: "assumption-stress-test", label: "Assumption Stress-Test", instruction: "Pressure every load-bearing assumption; flag the ones that will not hold." },
    { id: "risk-exposure", label: "Risk Exposure", instruction: "Make hidden trade-offs, costs, and risks explicit instead of buried." },
  ],
  judge: [
    { id: "layer-integration", label: "Layer Integration", instruction: "Weave rigor, edge, and robustness into one piece, not three stapled together." },
    { id: "contradiction-resolution", label: "Contradiction Resolution", instruction: "Where the prior voices disagree, decide in favor of the user's actual goal." },
    { id: "edge-preservation", label: "Edge Preservation", instruction: "Protect the Maverick's sharp moves from being sanded down into a gray median." },
    { id: "coherence", label: "Coherence Pass", instruction: "Make it read as one confident author, with no seams." },
    { id: "final-polish", label: "Final Polish", instruction: "Clean structure, clean prose, ready to hand over." },
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
