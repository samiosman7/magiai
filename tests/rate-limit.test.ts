import { describe, it, expect, vi } from "vitest";

// Force the durable layer off so guardByIp exercises the in-memory floor only.
vi.mock("@/lib/supabase/server", () => ({
  hasSupabaseConfig: () => false,
  getSupabaseAdmin: () => {
    throw new Error("should not be called when Supabase is unconfigured");
  },
}));

import {
  checkRateLimit,
  getClientIp,
  guardByIp,
  getAnonymousTrialUsed,
  recordAnonymousTrialRun,
  FREE_TRIAL_RUNS,
} from "@/lib/security/rate-limit";

function req(headers: Record<string, string>): Request {
  return new Request("http://localhost/api/x", { method: "POST", headers });
}

describe("getClientIp", () => {
  it("takes the first hop of x-forwarded-for", () => {
    expect(getClientIp(req({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" }))).toBe("203.0.113.9");
  });
  it("falls back to x-real-ip, then unknown", () => {
    expect(getClientIp(req({ "x-real-ip": "198.51.100.4" }))).toBe("198.51.100.4");
    expect(getClientIp(req({}))).toBe("unknown");
  });
});

describe("checkRateLimit window", () => {
  it("allows up to the limit then blocks", () => {
    const key = `test-${Math.random()}`;
    const opts = { key, limit: 3, windowMs: 60_000 };
    expect(checkRateLimit(opts).allowed).toBe(true);
    expect(checkRateLimit(opts).allowed).toBe(true);
    expect(checkRateLimit(opts).allowed).toBe(true);
    expect(checkRateLimit(opts).allowed).toBe(false);
  });
});

describe("guardByIp", () => {
  it("passes under the limit and 429s over it, keyed per IP", async () => {
    const ip = `9.9.9.${Math.floor(Math.random() * 250)}`;
    const headers = { "x-forwarded-for": ip };
    const opts = { limit: 2, windowMs: 60_000 };

    expect(await guardByIp(req(headers), "unit", opts)).toBeNull();
    expect(await guardByIp(req(headers), "unit", opts)).toBeNull();
    const blocked = await guardByIp(req(headers), "unit", opts);
    expect(blocked).not.toBeNull();
    expect(blocked!.status).toBe(429);
    expect(blocked!.headers.get("Retry-After")).toBeTruthy();

    // A different IP has its own budget.
    expect(await guardByIp(req({ "x-forwarded-for": "1.1.1.1" }), "unit", opts)).toBeNull();
  });
});

describe("anonymous free-trial metering", () => {
  it("defaults to 5 free runs", () => {
    expect(FREE_TRIAL_RUNS).toBe(5);
  });

  it("fails open (0 used, no throw) when Supabase is unconfigured", async () => {
    // Mocked hasSupabaseConfig=false → the trial gate is inactive, never blocks.
    expect(await getAnonymousTrialUsed("203.0.113.1")).toBe(0);
    await expect(recordAnonymousTrialRun("203.0.113.1")).resolves.toBeUndefined();
  });
});
