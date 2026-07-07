import type { MagiMode } from "@/lib/magi/types";
import { hasSupabaseConfig, getSupabaseAdmin } from "@/lib/supabase/server";
import { cycleExpired, cycleResetsAt, getPlan, type Plan } from "@/lib/billing/plans";

export type CreditCheck = {
  allowed: boolean;
  creditsRequired: number;
  plan: Plan;
  reason?: string;
};

export type BillingProfile = {
  plan: Plan;
  credits: number;
  cycleStartedAt: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
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
  benchmark: 0,
  "benchmark-max": 0,
};

export function estimateCredits(mode: MagiMode, prompt: string) {
  const base = creditCostByMode[mode];
  const longPromptSurcharge = prompt.length > 6000 ? 1 : 0;
  return base + longPromptSurcharge;
}

function freeMonthlyCredits() {
  const fromEnv = Number(process.env.MAGI_FREE_CREDITS);
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : getPlan("free").monthlyCredits;
}

function monthlyAllowance(plan: Plan) {
  return plan.id === "free" ? freeMonthlyCredits() : plan.monthlyCredits;
}

// Loads (or creates) the billing profile. Free plans have no Stripe invoice to
// reset their cycle, so an expired free cycle rolls lazily here: credits reset
// to the monthly allowance. Paid cycles reset only via the Stripe webhook —
// never lazily — so a missed webhook can't turn into a double grant.
export async function getBillingProfile(userId: string): Promise<BillingProfile | null> {
  if (!hasSupabaseConfig()) return null;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("magi_profiles")
    .select("plan, credits, cycle_started_at, stripe_customer_id, stripe_subscription_id")
    .eq("clerk_user_id", userId)
    .maybeSingle();

  if (error) return null;

  if (!data) {
    const plan = getPlan("free");
    const credits = monthlyAllowance(plan);
    const nowIso = new Date().toISOString();
    await supabase.from("magi_profiles").insert({
      clerk_user_id: userId,
      plan: plan.id,
      credits,
      cycle_started_at: nowIso,
    });
    return {
      plan,
      credits,
      cycleStartedAt: nowIso,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
    };
  }

  const plan = getPlan(data.plan);
  let credits = Number(data.credits);
  let cycleStartedAt: string | null = data.cycle_started_at ?? null;

  if (plan.id === "free" && cycleExpired(cycleStartedAt)) {
    credits = monthlyAllowance(plan);
    cycleStartedAt = new Date().toISOString();
    await supabase
      .from("magi_profiles")
      .update({ credits, cycle_started_at: cycleStartedAt, updated_at: cycleStartedAt })
      .eq("clerk_user_id", userId);
  }

  return {
    plan,
    credits,
    cycleStartedAt,
    stripeCustomerId: data.stripe_customer_id ?? null,
    stripeSubscriptionId: data.stripe_subscription_id ?? null,
  };
}

export async function checkCreditAccess(
  userId: string,
  mode: MagiMode,
  prompt: string
): Promise<CreditCheck> {
  const creditsRequired = estimateCredits(mode, prompt);
  const profile = await getBillingProfile(userId);
  const plan = profile?.plan ?? getPlan("free");

  if (process.env.MAGI_REQUIRE_BILLING !== "true") {
    return { allowed: true, creditsRequired, plan };
  }

  if (!profile) {
    return {
      allowed: false,
      creditsRequired,
      plan,
      reason: "Billing is required, but Supabase is not configured.",
    };
  }

  // Plan gate before the credit gate: premium routing is a paid feature even
  // when the user still has free credits to spend.
  if (mode === "premium" && !plan.premiumRouting) {
    return {
      allowed: false,
      creditsRequired,
      plan,
      reason: "Premium routing is a Pro feature. Upgrade to run frontier models.",
    };
  }

  if (profile.credits < creditsRequired) {
    return {
      allowed: false,
      creditsRequired,
      plan,
      reason: `Not enough credits. This run needs ${creditsRequired}, you have ${profile.credits}. Credits reset each cycle — or upgrade for a bigger allowance.`,
    };
  }

  return { allowed: true, creditsRequired, plan };
}

// Snapshot for /api/me and the console billing panel.
export async function getBillingSnapshot(userId: string) {
  const profile = await getBillingProfile(userId);
  if (!profile) return null;
  return {
    plan: profile.plan.id,
    planName: profile.plan.name,
    priceUsd: profile.plan.priceUsd,
    credits: profile.credits,
    monthlyCredits: monthlyAllowance(profile.plan),
    dailyRuns: profile.plan.dailyRuns,
    premiumRouting: profile.plan.premiumRouting,
    cycleResetsAt: cycleResetsAt(profile.cycleStartedAt),
    hasStripeCustomer: Boolean(profile.stripeCustomerId),
  };
}

export async function recordRunAndChargeCredits(input: RunRecordInput) {
  if (!hasSupabaseConfig()) return { saved: false, charged: false };

  const supabase = getSupabaseAdmin();
  const profile = await getBillingProfile(input.clerkUserId);
  const shouldCharge = process.env.MAGI_REQUIRE_BILLING === "true" && input.creditsCharged > 0;

  if (shouldCharge) {
    if (!profile) {
      return { saved: false, charged: false, error: "Missing profile." };
    }

    const nextCredits = Math.max(0, profile.credits - input.creditsCharged);
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

// Applies a plan change / cycle renewal: sets the plan, resets credits to the
// new allowance, stamps the cycle, and logs a ledger event. Used by the Stripe
// webhook for subscribe, renew, plan switch, and cancel (back to free).
export async function applyPlanCycle(options: {
  userId: string;
  planId: string;
  reason: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  if (!hasSupabaseConfig()) return { applied: false };

  const supabase = getSupabaseAdmin();
  const plan = getPlan(options.planId);
  const credits = monthlyAllowance(plan);
  const nowIso = new Date().toISOString();

  const update: Record<string, unknown> = {
    clerk_user_id: options.userId,
    plan: plan.id,
    credits,
    cycle_started_at: nowIso,
    updated_at: nowIso,
  };
  if (options.stripeCustomerId !== undefined) update.stripe_customer_id = options.stripeCustomerId;
  if (options.stripeSubscriptionId !== undefined)
    update.stripe_subscription_id = options.stripeSubscriptionId;

  const { error } = await supabase
    .from("magi_profiles")
    .upsert(update, { onConflict: "clerk_user_id" });

  if (error) return { applied: false, error: error.message };

  await supabase.from("magi_credit_events").insert({
    clerk_user_id: options.userId,
    delta: credits,
    reason: options.reason,
    metadata: { plan: plan.id, ...options.metadata },
  });

  return { applied: true, plan: plan.id, credits };
}

// Finds which MAGI user a Stripe customer belongs to (renewal/cancel webhooks
// arrive keyed by customer id, not by our user id).
export async function findUserByStripeCustomer(customerId: string): Promise<string | null> {
  if (!hasSupabaseConfig() || !customerId) return null;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("magi_profiles")
    .select("clerk_user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (error) return null;
  return data?.clerk_user_id ?? null;
}
