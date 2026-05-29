import type { GeminiModel, MagiMode, ModelCall, ProviderName } from "./types";
import { hasProviderKeys } from "./provider-keys";

type NodeName = "direct" | "melchior" | "balthasar" | "casper" | "judge";

const plans: Record<MagiMode, Record<NodeName, Pick<ModelCall, "provider" | "model">>> = {
  economy: {
    direct: { provider: "google", model: "gemini-2.5-flash" },
    melchior: { provider: "deepseek", model: "deepseek-chat" },
    balthasar: { provider: "qwen", model: "qwen-plus" },
    casper: { provider: "google", model: "gemini-2.5-flash" },
    judge: { provider: "deepseek", model: "deepseek-chat" },
  },
  standard: {
    direct: { provider: "google", model: "gemini-2.5-flash" },
    melchior: { provider: "google", model: "gemini-2.5-flash" },
    balthasar: { provider: "openai", model: "gpt-4o-mini" },
    casper: { provider: "anthropic", model: "claude-3-5-haiku-latest" },
    judge: { provider: "google", model: "gemini-2.5-flash" },
  },
  premium: {
    direct: { provider: "google", model: "gemini-2.5-flash" },
    melchior: { provider: "anthropic", model: "claude-3-5-sonnet-latest" },
    balthasar: { provider: "openai", model: "gpt-4o" },
    casper: { provider: "google", model: "gemini-2.5-pro" },
    judge: { provider: "anthropic", model: "claude-3-5-sonnet-latest" },
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
