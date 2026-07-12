import "server-only";
import { getSupabaseAdmin, hasSupabaseConfig } from "@/lib/supabase/server";

// Spend control — the wallet guardrails, checked before every run:
//   global monthly cap · global daily cap · per-user monthly cap ·
//   per-user daily cap · per-user daily run count · hard kill switch.
// Kill switch (MAGI_EMERGENCY_STOP) is env-only so it works with zero deps.
// Dollar caps need the magi_spend table; if it's missing/unreachable we fail OPEN
// (availability over strictness) — the kill switch is the guaranteed backstop.

function num(value: string | undefined, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function today() {
  return new Date().toISOString().slice(0, 10); // UTC YYYY-MM-DD
}

function monthStart() {
  return `${new Date().toISOString().slice(0, 7)}-01`; // first of this UTC month
}

export type SpendDecision = { allowed: boolean; reason?: string };

// Per-plan overrides for the per-user DAILY caps (from lib/billing/plans.ts).
// Free tier is the tightest, so even the free beta is bounded.
export type PlanLimits = { dailyRuns?: number; dailyUsd?: number };

export async function checkSpendLimits(userId: string, planLimits?: PlanLimits): Promise<SpendDecision> {
  if (process.env.MAGI_EMERGENCY_STOP === "true") {
    return { allowed: false, reason: "MAGI is paused for maintenance. Please try again shortly." };
  }

  if (!hasSupabaseConfig()) return { allowed: true };

  // Global ceilings protect YOU from a release-day stampede. Monthly is the true
  // wallet cap (daily alone would still allow ~30× per month).
  const globalMonthlyCap = num(process.env.MAGI_MONTHLY_USD_CAP, 100);
  const globalDailyCap = num(process.env.MAGI_DAILY_USD_CAP, 20);
  // Per-user caps: plan-driven where known (free = tight), env fallback otherwise.
  const userDailyCap = planLimits?.dailyUsd ?? num(process.env.MAGI_USER_DAILY_USD_CAP, 1);
  const userMonthlyCap = num(process.env.MAGI_USER_MONTHLY_USD_CAP, 5);
  const userRunCap = planLimits?.dailyRuns ?? num(process.env.MAGI_USER_DAILY_RUNS, 50);

  try {
    const supabase = getSupabaseAdmin();
    // One month-to-date scan powers every cap: today's slice is filtered in JS.
    // (At large scale, move the global sums to a counter row or RPC.)
    const { data, error } = await supabase
      .from("magi_spend")
      .select("user_id,spent_usd,run_count,day")
      .gte("day", monthStart());

    if (error) return { allowed: true }; // fail open on read error
    const rows = data ?? [];
    const day = today();

    let globalMonth = 0;
    let globalDay = 0;
    let userMonth = 0;
    let userDay = 0;
    let userRunsDay = 0;
    for (const r of rows) {
      const spent = Number(r.spent_usd || 0);
      globalMonth += spent;
      const isToday = r.day === day;
      if (isToday) globalDay += spent;
      if (r.user_id === userId) {
        userMonth += spent;
        if (isToday) {
          userDay += spent;
          userRunsDay += Number(r.run_count || 0);
        }
      }
    }

    if (globalMonth >= globalMonthlyCap) {
      return { allowed: false, reason: "MAGI is at capacity for this month. Service resumes at the start of next month." };
    }
    if (globalDay >= globalDailyCap) {
      return { allowed: false, reason: "MAGI is at capacity for today. Service resumes after the daily reset." };
    }
    if (userMonth >= userMonthlyCap) {
      return { allowed: false, reason: "You've reached this month's usage limit. It resets at the start of next month — or upgrade for a bigger allowance." };
    }
    if (userDay >= userDailyCap) {
      return { allowed: false, reason: "You've reached today's usage limit. It resets at 00:00 UTC — or upgrade for more." };
    }
    if (userRunsDay >= userRunCap) {
      return { allowed: false, reason: "You've reached today's request limit. It resets at 00:00 UTC." };
    }
    return { allowed: true };
  } catch {
    return { allowed: true };
  }
}

// Today's usage for the console billing panel ("14 / 100 runs today").
export async function getTodayUsage(userId: string): Promise<{ runsToday: number }> {
  if (!hasSupabaseConfig()) return { runsToday: 0 };
  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from("magi_spend")
      .select("run_count")
      .eq("user_id", userId)
      .eq("day", today())
      .maybeSingle();
    return { runsToday: Number(data?.run_count || 0) };
  } catch {
    return { runsToday: 0 };
  }
}

export async function recordSpend(userId: string, costUsd: number): Promise<void> {
  if (!hasSupabaseConfig()) return; // count every run (even $0) for the request cap
  try {
    const supabase = getSupabaseAdmin();
    const day = today();
    const { data } = await supabase
      .from("magi_spend")
      .select("spent_usd,run_count")
      .eq("user_id", userId)
      .eq("day", day)
      .maybeSingle();

    await supabase.from("magi_spend").upsert(
      {
        user_id: userId,
        day,
        spent_usd: Number(data?.spent_usd || 0) + (costUsd > 0 ? costUsd : 0),
        run_count: Number(data?.run_count || 0) + 1,
      },
      { onConflict: "user_id,day" }
    );
  } catch {
    // best-effort; never block a completed run on a write failure
  }
}
