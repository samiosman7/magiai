export type MagiMode = "economy" | "standard" | "premium" | "benchmark" | "benchmark-max";

export type GeminiModel =
  | "gemini-3.1-pro-preview"
  | "gemini-3.1-flash-lite-preview"
  | "gemini-3-pro-preview"
  | "gemini-3-flash-preview"
  | "gemini-2.5-pro"
  | "gemini-2.5-flash"
  | "gemini-2.5-flash-lite"
  | "gemini-2.5-flash-lite-preview-06-17"
  | "gemini-2.5-flash-lite-preview-09-2025"
  | "gemini-2.0-flash-001"
  | "gemini-2.0-flash"
  | "gemini-2.0-flash-lite"
  | "gemini-2.0-flash-lite-001"
  | "gemini-1.5-flash"
  | "gemini-1.5-flash-8b"
  | "gemini-1.5-pro";

export type PipelineStep =
  | "scan"
  | "route"
  | "melchior"
  | "balthasar"
  | "casper"
  | "judge"
  | "final";

export type ProviderName = "openai" | "anthropic" | "google" | "deepseek" | "qwen" | "openrouter" | "vercel" | "mock";

export type ModelCall = {
  provider: ProviderName;
  model: string;
  system: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal; // aborts the underlying fetch (client cancel stops spend)
};

export type ModelResult = {
  text: string;
  provider: ProviderName;
  model: string;
  isMock: boolean;
  cost?: number; // actual billed USD for this call, when the provider reports it
};

export type TaskKind =
  | "general"
  | "coding"
  | "research"
  | "writing"
  | "analysis"
  | "data"
  | "website"
  | "automation"
  | "legal";

export type TaskProfile = {
  kind: TaskKind;
  label: string;
  complexityBoost: number;
  artifactType: MagiArtifact["type"];
  skillPacks: string[];
  judgeRubric: string;
  toolHints: string[];
  secondaryKinds: TaskKind[];
};

export type MagiArtifact = {
  id: string;
  type: "answer" | "document" | "report" | "code" | "project" | "data" | "plan";
  title: string;
  status: "planned" | "drafted" | "ready_for_export";
  summary: string;
  actions: Array<{
    label: string;
    action: "download_website" | "save_planned";
  }>;
};

export type MagiEvent =
  | { type: "status"; step: PipelineStep; message: string }
  | { type: "node"; name: string; text: string }
  | { type: "skills"; node: string; skills: string[]; sourcePath?: string }
  | { type: "task"; profile: TaskProfile }
  | { type: "artifact"; artifact: MagiArtifact }
  | { type: "step"; step: PipelineStep; state: "" | "active" | "done" }
  | { type: "cost"; total: number; mode: string; breakdown: Array<{ node: string; cost: number }> }
  | { type: "answer_start" }
  | { type: "delta"; text: string }
  // How the answer was verified: the Adversary's objections (resolved by Synthesis)
  // and how many real sources grounded it. Rendered as the per-answer trust panel.
  | { type: "verification"; objections: string[]; sourceCount: number; revised: boolean }
  | { type: "final"; answer: string }
  | { type: "error"; message: string };
