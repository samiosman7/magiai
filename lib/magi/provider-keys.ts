import type { ProviderName } from "./types";

export function getProviderKeys(provider: ProviderName) {
  if (provider === "google") {
    return uniqueKeys(process.env.GOOGLE_API_KEYS, process.env.GOOGLE_API_KEY);
  }

  if (provider === "openai") return uniqueKeys(process.env.OPENAI_API_KEY);
  if (provider === "anthropic") return uniqueKeys(process.env.ANTHROPIC_API_KEY);
  if (provider === "deepseek") return uniqueKeys(process.env.DEEPSEEK_API_KEY);
  if (provider === "qwen") return uniqueKeys(process.env.QWEN_API_KEY);

  return [];
}

export function hasProviderKeys(provider: ProviderName) {
  if (process.env.MAGI_MOCK_MODE === "true") return false;
  return getProviderKeys(provider).length > 0;
}

function uniqueKeys(...values: Array<string | undefined>) {
  const keys = values
    .flatMap((value) => value?.split(",") ?? [])
    .map((value) => value.trim())
    .filter(Boolean);

  return [...new Set(keys)];
}
