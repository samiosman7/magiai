import type { GeminiModel, MagiMode, ModelCall, ProviderName } from "./types";
import { hasProviderKeys } from "./provider-keys";

type NodeName = "direct" | "melchior" | "balthasar" | "casper" | "judge";

const plans: Record<MagiMode, Record<NodeName, Pick<ModelCall, "provider" | "model">>> = {
  // CHEAP BUILD + SMART VERIFY — the "minimum expensive model" thesis.
  // Cheap models diagnose and build; Sonnet verifies (and fixes via the correction loop).
  // Question: does a cheap builder with a smart checker match a single Sonnet, for less money?
  benchmark: {
    direct: { provider: "vercel", model: "deepseek/deepseek-v3" },
    melchior: { provider: "vercel", model: "deepseek/deepseek-r1" },
    balthasar: { provider: "vercel", model: "deepseek/deepseek-v3" },
    casper: { provider: "vercel", model: "anthropic/claude-sonnet-4.5" },
    judge: { provider: "vercel", model: "anthropic/claude-sonnet-4.5" },
  },
  // Sonnet in every slot — architecture ceiling, all via Vercel AI Gateway
  "benchmark-max": {
    direct: { provider: "vercel", model: "anthropic/claude-sonnet-4.5" },
    melchior: { provider: "vercel", model: "anthropic/claude-sonnet-4.5" },
    balthasar: { provider: "vercel", model: "anthropic/claude-sonnet-4.5" },
    casper: { provider: "vercel", model: "anthropic/claude-sonnet-4.5" },
    judge: { provider: "vercel", model: "anthropic/claude-sonnet-4.5" },
  },
  // Nodes are the angle roles: melchior=Architect, balthasar=Maverick, casper=Adversary, judge=Synthesis.
  // economy + standard run the validated all-cheap chain (DeepSeek via the gateway).
  economy: {
    direct: { provider: "vercel", model: "deepseek/deepseek-v3" },
    melchior: { provider: "vercel", model: "deepseek/deepseek-v3" },
    balthasar: { provider: "vercel", model: "deepseek/deepseek-v3" },
    casper: { provider: "vercel", model: "deepseek/deepseek-v3" },
    judge: { provider: "vercel", model: "deepseek/deepseek-v3" },
  },
  // standard: three different cheap AIs building on each other, plus a reliable synthesizer.
  standard: {
    direct: { provider: "vercel", model: "deepseek/deepseek-v3" },
    melchior: { provider: "vercel", model: "deepseek/deepseek-v3" }, // Architect
    balthasar: { provider: "vercel", model: "alibaba/qwen3-next-80b-a3b-instruct" }, // Maverick
    casper: { provider: "vercel", model: "meta/llama-3.3-70b" }, // Adversary
    judge: { provider: "vercel", model: "deepseek/deepseek-v3" }, // Synthesis
  },
  // premium: latest frontier models, one vendor per angle, Opus forging the final.
  premium: {
    direct: { provider: "vercel", model: "anthropic/claude-sonnet-4.6" },
    melchior: { provider: "vercel", model: "openai/gpt-5.3-chat" }, // Architect — ChatGPT
    balthasar: { provider: "vercel", model: "google/gemini-3.1-pro-preview" }, // Maverick — Gemini
    casper: { provider: "vercel", model: "anthropic/claude-sonnet-4.6" }, // Adversary — Sonnet
    judge: { provider: "vercel", model: "anthropic/claude-opus-4.8" }, // Synthesis — Opus
  },
};

export function getModelPlan(mode: MagiMode, node: NodeName, geminiModel?: GeminiModel) {
  const target = plans[mode][node];
  if (hasProviderKey(target.provider)) return applyGeminiOverride(target, geminiModel);

  if (hasProviderKey("openai")) {
    return { provider: "openai" as const, model: "gpt-4o-mini" };
  }

  if (hasProviderKey("google")) {
    return { provider: "google" as const, model: geminiModel ?? "gemini-2.5-flash" };
  }

  if (hasProviderKey("anthropic")) {
    return { provider: "anthropic" as const, model: "claude-3-5-haiku-latest" };
  }

  return { provider: "mock" as const, model: "magi-mock" };
}

function applyGeminiOverride(
  target: Pick<ModelCall, "provider" | "model">,
  geminiModel?: GeminiModel
) {
  if (target.provider !== "google" || !geminiModel) return target;
  return { ...target, model: geminiModel };
}

function hasProviderKey(provider: ProviderName) {
  return hasProviderKeys(provider);
}
