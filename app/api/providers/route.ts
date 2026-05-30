import { getProviderKeys } from "@/lib/magi/provider-keys";
import type { ProviderName } from "@/lib/magi/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const providers: ProviderName[] = ["openai", "anthropic", "google", "deepseek", "qwen"];

export async function GET() {
  return Response.json({
    mockMode: process.env.MAGI_MOCK_MODE === "true",
    providers: providers.map((provider) => ({
      provider,
      configured: getProviderKeys(provider).length > 0 && process.env.MAGI_MOCK_MODE !== "true",
      keyCount: provider === "google" ? getProviderKeys(provider).length : Math.min(getProviderKeys(provider).length, 1),
    })),
  });
}
