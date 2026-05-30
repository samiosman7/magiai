import type { MagiMode } from "@/lib/magi/types";
import { hasSupabaseConfig, getSupabaseAdmin } from "@/lib/supabase/server";

export type CreditCheck = {
  allowed: boolean;
  creditsRequired: number;
  reason?: string;
};

export type RunRecordInput = {
  clerkUserId: string;
  mode: MagiMode;
  prompt: string;
  finalAnswer?: string;
  creditsCharged: number;
  dossier: unknown[];
  providerUsage?: unknown[];
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

export async function recordRunAndChargeCredits(input: RunRecordInput) {
  if (!hasSupabaseConfig()) return { saved: false, charged: false };

  const supabase = getSupabaseAdmin();
  const shouldCharge = process.env.MAGI_REQUIRE_BILLING === "true" && input.creditsCharged > 0;

  if (shouldCharge) {
    const { data: profile, error: lookupError } = await supabase
      .from("magi_profiles")
      .select("credits")
      .eq("clerk_user_id", input.clerkUserId)
      .maybeSingle();

    if (lookupError || !profile) {
      return { saved: false, charged: false, error: lookupError?.message || "Missing profile." };
    }

    const nextCredits = Math.max(0, Number(profile.credits) - input.creditsCharged);
    const { error: updateError } = await supabase
      .from("magi_profiles")
      .update({ credits: nextCredits, updated_at: new Date().toISOString() })
      .eq("clerk_user_id", input.clerkUserId);

    if (updateError) {
      return { saved: false, charged: false, error: updateError.message };
    }

    await supabase.from("magi_credit_events").insert({
      clerk_user_id: input.clerkUserId,
      delta: -input.creditsCharged,
      reason: "magi_run",
      metadata: {
        mode: input.mode,
        promptLength: input.prompt.length,
      },
    });
  }

  const { error: runError } = await supabase.from("magi_runs").insert({
    clerk_user_id: input.clerkUserId,
    mode: input.mode,
    prompt: input.prompt,
    final_answer: input.finalAnswer ?? null,
    credits_charged: shouldCharge ? input.creditsCharged : 0,
    provider_usage: input.providerUsage ?? [],
    dossier: input.dossier,
  });

  if (runError) {
    return { saved: false, charged: shouldCharge, error: runError.message };
  }

  return { saved: true, charged: shouldCharge };
}
