export type MagiMode = "economy" | "standard" | "premium";

export type GeminiModel =
  | "gemini-2.5-flash"
  | "gemini-2.5-pro"
  | "gemini-2.0-flash"
  | "gemini-1.5-flash"
  | "gemini-1.5-pro";

export type PipelineStep =
  | "scan"
  | "melchior"
  | "balthasar"
  | "casper"
  | "judge"
  | "final";

export type ProviderName = "openai" | "anthropic" | "google" | "deepseek" | "qwen" | "mock";

export type ModelCall = {
  provider: ProviderName;
  model: string;
  system: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
};

export type ModelResult = {
  text: string;
  provider: ProviderName;
  model: string;
  isMock: boolean;
};

export type DifficultyResult = {
  complex: boolean;
  score: number;
  reason: string;
};

export type JudgeResult = {
  passed: boolean;
  issue: string | null;
  rationale: string;
};

export type MagiEvent =
  | { type: "status"; step: PipelineStep; message: string }
  | { type: "node"; name: string; text: string }
  | { type: "skills"; node: string; skills: string[]; sourcePath?: string }
  | { type: "step"; step: PipelineStep; state: "" | "active" | "done" }
  | { type: "final"; answer: string }
  | { type: "error"; message: string };
