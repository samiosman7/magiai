import type { MagiMode, ModelCall, ProviderName } from "./types";
import { hasProviderKeys } from "./provider-keys";

type NodeName = "melchior" | "balthasar" | "casper" | "judge";

const plans: Record<MagiMode, Record<NodeName, Pick<ModelCall, "provider" | "model">>> = {
  economy: {
    melchior: { provider: "deepseek", model: "deepseek-chat" },
    balthasar: { provider: "qwen", model: "qwen-plus" },
    casper: { provider: "google", model: "gemini-1.5-flash" },
    judge: { provider: "deepseek", model: "deepseek-chat" },
  },
  standard: {
    melchior: { provider: "google", model: "gemini-1.5-flash" },
    balthasar: { provider: "openai", model: "gpt-4o-mini" },
    casper: { provider: "anthropic", model: "claude-3-5-haiku-latest" },
    judge: { provider: "google", model: "gemini-1.5-flash" },
  },
  premium: {
    melchior: { provider: "anthropic", model: "claude-3-5-sonnet-latest" },
    balthasar: { provider: "openai", model: "gpt-4o" },
    casper: { provider: "google", model: "gemini-1.5-pro" },
    judge: { provider: "anthropic", model: "claude-3-5-sonnet-latest" },
  },
};

export function getModelPlan(mode: MagiMode, node: NodeName) {
  const target = plans[mode][node];
  if (hasProviderKey(target.provider)) return target;

  if (hasProviderKey("openai")) {
    return { provider: "openai" as const, model: "gpt-4o-mini" };
  }

  if (hasProviderKey("google")) {
    return { provider: "google" as const, model: "gemini-1.5-flash" };
  }

  if (hasProviderKey("anthropic")) {
    return { provider: "anthropic" as const, model: "claude-3-5-haiku-latest" };
  }

  return { provider: "mock" as const, model: "magi-mock" };
}

function hasProviderKey(provider: ProviderName) {
  return hasProviderKeys(provider);
}
