import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock Supabase so the cap logic is testable without a live DB. The query builder
// is chainable + awaitable so it supports both `.gte(...)` (month scan) and
// `.eq(...).eq(...).maybeSingle()` shapes.
const TODAY = new Date().toISOString().slice(0, 10);
let mockRows: Array<{ user_id: string; spent_usd: number; run_count: number; day: string }> = [
  { user_id: "u1", spent_usd: 0, run_count: 0, day: TODAY },
];

vi.mock("@/lib/supabase/server", () => {
  const makeChain = () => {
    const result = Promise.resolve({ data: mockRows, error: null });
    const chain: Record<string, unknown> = {
      eq: () => chain,
      gte: () => chain,
      maybeSingle: () => Promise.resolve({ data: mockRows[0] ?? null, error: null }),
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => result.then(res, rej),
    };
    return chain;
  };
  return {
    hasSupabaseConfig: () => true,
    getSupabaseAdmin: () => ({ from: () => ({ select: () => makeChain() }) }),
  };
});

import { checkSpendLimits } from "@/lib/billing/spend";

describe("checkSpendLimits", () => {
  beforeEach(() => {
    delete process.env.MAGI_EMERGENCY_STOP;
    process.env.MAGI_DAILY_USD_CAP = "25";
    process.env.MAGI_USER_DAILY_USD_CAP = "2";
    process.env.MAGI_USER_DAILY_RUNS = "50";
    process.env.MAGI_MONTHLY_USD_CAP = "100";
    process.env.MAGI_USER_MONTHLY_USD_CAP = "5";
    mockRows = [{ user_id: "u1", spent_usd: 0, run_count: 0, day: TODAY }];
  });

  it("allows a normal request under caps", async () => {
    expect((await checkSpendLimits("u1")).allowed).toBe(true);
  });

  it("blocks when the global monthly cap is exceeded", async () => {
    // Spread across the month by other users — daily is fine, monthly is not.
    mockRows = [
      { user_id: "u2", spent_usd: 60, run_count: 1, day: "2000-01-01" },
      { user_id: "u3", spent_usd: 50, run_count: 1, day: "2000-01-02" },
    ];
    const r = await checkSpendLimits("u1");
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/month/i);
  });

  it("blocks when the per-user monthly cap is exceeded", async () => {
    mockRows = [{ user_id: "u1", spent_usd: 6, run_count: 3, day: "2000-01-01" }];
    const r = await checkSpendLimits("u1");
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/month/i);
  });

  it("blocks when the kill switch is on", async () => {
    process.env.MAGI_EMERGENCY_STOP = "true";
    const r = await checkSpendLimits("u1");
    expect(r.allowed).toBe(false);
    expect(r.reason).toBeTruthy();
  });

  it("blocks at a $0 global daily cap", async () => {
    process.env.MAGI_DAILY_USD_CAP = "0";
    expect((await checkSpendLimits("u1")).allowed).toBe(false);
  });

  it("blocks at a 0 per-user daily run cap", async () => {
    process.env.MAGI_USER_DAILY_RUNS = "0";
    expect((await checkSpendLimits("u1")).allowed).toBe(false);
  });
});
