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

export async function checkSpendLimits(userId: string): Promise<SpendDecision> {
  if (process.env.MAGI_EMERGENCY_STOP === "true") {
    return { allowed: false, reason: "MAGI is paused for maintenance. Please try again shortly." };
  }

  if (!hasSupabaseConfig()) return { allowed: true };

  const globalCap = num(process.env.MAGI_DAILY_USD_CAP, 25);
  const userCap = num(process.env.MAGI_USER_DAILY_USD_CAP, 2);

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("magi_spend")
      .select("user_id,spent_usd")
      .eq("day", today());

    if (error) return { allowed: true }; // fail open on read error
    const rows = data ?? [];
    const globalSpent = rows.reduce((sum, r) => sum + Number(r.spent_usd || 0), 0);
    const userSpent = rows
      .filter((r) => r.user_id === userId)
      .reduce((sum, r) => sum + Number(r.spent_usd || 0), 0);

    if (globalSpent >= globalCap) {
      return { allowed: false, reason: "MAGI is at capacity for today. Service resumes after the daily reset." };
    }
    if (userSpent >= userCap) {
      return { allowed: false, reason: "You've reached today's usage limit. It resets at 00:00 UTC." };
    }
    return { allowed: true };
  } catch {
    return { allowed: true };
  }
}

export async function recordSpend(userId: string, costUsd: number): Promise<void> {
  if (!hasSupabaseConfig() || !(costUsd > 0)) return;
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
        spent_usd: Number(data?.spent_usd || 0) + costUsd,
        run_count: Number(data?.run_count || 0) + 1,
      },
      { onConflict: "user_id,day" }
    );
  } catch {
    // best-effort; never block a completed run on a write failure
  }
}
