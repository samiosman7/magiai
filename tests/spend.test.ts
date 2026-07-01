import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock Supabase so the cap logic is testable without a live DB.
vi.mock("@/lib/supabase/server", () => ({
  hasSupabaseConfig: () => true,
  getSupabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        eq: () =>
          Promise.resolve({ data: [{ user_id: "u1", spent_usd: 0, run_count: 0 }], error: null }),
      }),
    }),
  }),
}));

import { checkSpendLimits } from "@/lib/billing/spend";

describe("checkSpendLimits", () => {
  beforeEach(() => {
    delete process.env.MAGI_EMERGENCY_STOP;
    process.env.MAGI_DAILY_USD_CAP = "25";
    process.env.MAGI_USER_DAILY_USD_CAP = "2";
    process.env.MAGI_USER_DAILY_RUNS = "50";
  });

  it("allows a normal request under caps", async () => {
    expect((await checkSpendLimits("u1")).allowed).toBe(true);
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
