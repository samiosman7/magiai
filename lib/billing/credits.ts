import type { MagiMode } from "@/lib/magi/types";
import { hasSupabaseConfig, getSupabaseAdmin } from "@/lib/supabase/server";

export type CreditCheck = {
  allowed: boolean;
  creditsRequired: number;
  reason?: string;
};

const creditCostByMode: Record<MagiMode, number> = {
  economy: 0.5,
  standard: 1,
  premium: 3,
};

export function estimateCredits(mode: MagiMode, prompt: string) {
  const base = creditCostByMode[mode];
  const longPromptSurcharge = prompt.length > 6000 ? 1 : 0;
  return base + longPromptSurcharge;
}

export async function checkCreditAccess(
  clerkUserId: string,
  mode: MagiMode,
  prompt: string
): Promise<CreditCheck> {
  const creditsRequired = estimateCredits(mode, prompt);

  if (process.env.MAGI_REQUIRE_BILLING !== "true") {
    return { allowed: true, creditsRequired };
  }

  if (!hasSupabaseConfig()) {
    return {
      allowed: false,
      creditsRequired,
      reason: "Billing is required, but Supabase is not configured.",
    };
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("magi_profiles")
    .select("credits")
    .eq("clerk_user_id", clerkUserId)
    .maybeSingle();

  if (error) {
    return {
      allowed: false,
      creditsRequired,
      reason: `Credit lookup failed: ${error.message}`,
    };
  }

  if (!data) {
    return {
      allowed: false,
      creditsRequired,
      reason: "No MAGI credit profile exists for this user.",
    };
  }

  const availableCredits = Number(data.credits);
  if (availableCredits < creditsRequired) {
    return {
      allowed: false,
      creditsRequired,
      reason: `Insufficient credits. Required ${creditsRequired}, available ${availableCredits}.`,
    };
  }

  return { allowed: true, creditsRequired };
}
