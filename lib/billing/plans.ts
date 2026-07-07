// MAGI subscription plans — the single source of truth for pricing and limits.
// Pure data + pure helpers (no I/O) so limit logic is unit-testable.

export type PlanId = "free" | "pro" | "studio";

export type Plan = {
  id: PlanId;
  name: string;
  priceUsd: number; // display price, $/month (Stripe price is authoritative for billing)
  monthlyCredits: number; // credits reset to this at each cycle start (not additive)
  dailyRuns: number; // per-user runs per UTC day
  dailyUsd: number; // per-user model spend per UTC day (abuse backstop, not a sales lever)
  premiumRouting: boolean; // access to the premium (frontier-model) mode
  priceEnv?: string; // env var holding the Stripe monthly price id
  blurb: string;
};

export const plans: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    priceUsd: 0,
    monthlyCredits: 10,
    dailyRuns: 20,
    dailyUsd: 0.5,
    premiumRouting: false,
    blurb: "Try real verified answers",
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceUsd: 15,
    monthlyCredits: 200,
    dailyRuns: 100,
    dailyUsd: 5,
    premiumRouting: true,
    priceEnv: "STRIPE_PRICE_PRO",
    blurb: "For people who ship work with it",
  },
  studio: {
    id: "studio",
    name: "Studio",
    priceUsd: 40,
    monthlyCredits: 600,
    dailyRuns: 300,
    dailyUsd: 15,
    premiumRouting: true,
    priceEnv: "STRIPE_PRICE_STUDIO",
    blurb: "Heavy, daily, team-grade usage",
  },
};

const CYCLE_DAYS = 30;

// Unknown/legacy plan strings (e.g. old 'paid') resolve to free limits — fail closed.
export function getPlan(planId: string | null | undefined): Plan {
  if (planId === "pro" || planId === "studio" || planId === "free") return plans[planId];
  return plans.free;
}

// Free plans have no Stripe invoice to reset them, so credits roll lazily:
// once a cycle is older than 30 days it resets on next use.
export function cycleExpired(cycleStartedAt: string | null | undefined, now = Date.now()): boolean {
  if (!cycleStartedAt) return true;
  const started = Date.parse(cycleStartedAt);
  if (!Number.isFinite(started)) return true;
  return now - started >= CYCLE_DAYS * 24 * 60 * 60 * 1000;
}

// Approximate next reset date for display ("resets Aug 5").
export function cycleResetsAt(cycleStartedAt: string | null | undefined): string | null {
  if (!cycleStartedAt) return null;
  const started = Date.parse(cycleStartedAt);
  if (!Number.isFinite(started)) return null;
  return new Date(started + CYCLE_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

// Maps a Stripe price id back to a plan (webhook: subscription created/updated).
export function planFromStripePrice(
  priceId: string | null | undefined,
  env: Record<string, string | undefined> = process.env
): PlanId | null {
  if (!priceId) return null;
  for (const plan of Object.values(plans)) {
    if (plan.priceEnv && env[plan.priceEnv] === priceId) return plan.id;
  }
  return null;
}
