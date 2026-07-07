import "server-only";
import { getSupabaseAdmin, hasSupabaseConfig } from "@/lib/supabase/server";

// Spend control: a global daily cap, a per-user daily cap, and a hard kill switch.
// The kill switch (MAGI_EMERGENCY_STOP) is env-only so it works with zero dependencies.
// The dollar caps require the magi_spend table; if it's missing/unreachable we fail OPEN
// (availability over strictness) — the kill switch is the guaranteed backstop.

function num(value: string | undefined, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function today() {
  return new Date().toISOString().slice(0, 10); // UTC YYYY-MM-DD
}

export type SpendDecision = { allowed: boolean; reason?: string };

// Per-plan overrides for the per-user caps (from lib/billing/plans.ts).
// Omitted (or partial) → env defaults, so anonymous/legacy callers keep working.
export type PlanLimits = { dailyRuns?: number; dailyUsd?: number };

export async function checkSpendLimits(userId: string, planLimits?: PlanLimits): Promise<SpendDecision> {
  if (process.env.MAGI_EMERGENCY_STOP === "true") {
    return { allowed: false, reason: "MAGI is paused for maintenance. Please try again shortly." };
  }

  if (!hasSupabaseConfig()) return { allowed: true };

  const globalCap = num(process.env.MAGI_DAILY_USD_CAP, 25);
  const userCap = planLimits?.dailyUsd ?? num(process.env.MAGI_USER_DAILY_USD_CAP, 2);
  const userRunCap = planLimits?.dailyRuns ?? num(process.env.MAGI_USER_DAILY_RUNS, 50);

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("magi_spend")
      .select("user_id,spent_usd,run_count")
      .eq("day", today());

    if (error) return { allowed: true }; // fail open on read error
    const rows = data ?? [];
    const globalSpent = rows.reduce((sum, r) => sum + Number(r.spent_usd || 0), 0);
    const userRows = rows.filter((r) => r.user_id === userId);
    const userSpent = userRows.reduce((sum, r) => sum + Number(r.spent_usd || 0), 0);
    const userRuns = userRows.reduce((sum, r) => sum + Number(r.run_count || 0), 0);

    if (globalSpent >= globalCap) {
      return { allowed: false, reason: "MAGI is at capacity for today. Service resumes after the daily reset." };
    }
    if (userSpent >= userCap) {
      return { allowed: false, reason: "You've reached today's usage limit. It resets at 00:00 UTC." };
    }
    // Durable per-user daily request cap (Supabase-backed, survives serverless restarts —
    // unlike the in-memory hourly limiter, which stays only as a coarse burst guard).
    if (userRuns >= userRunCap) {
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
