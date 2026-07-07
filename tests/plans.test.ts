import { describe, it, expect } from "vitest";
import { cycleExpired, cycleResetsAt, getPlan, planFromStripePrice, plans } from "@/lib/billing/plans";

const DAY = 24 * 60 * 60 * 1000;

describe("getPlan", () => {
  it("resolves known plans", () => {
    expect(getPlan("pro").monthlyCredits).toBe(plans.pro.monthlyCredits);
    expect(getPlan("studio").premiumRouting).toBe(true);
  });

  it("fails closed to free limits for unknown or legacy plan strings", () => {
    expect(getPlan("paid").id).toBe("free");
    expect(getPlan(null).id).toBe("free");
    expect(getPlan(undefined).id).toBe("free");
    expect(getPlan("free").premiumRouting).toBe(false);
  });

  it("keeps paid limits above free limits", () => {
    expect(plans.pro.dailyRuns).toBeGreaterThan(plans.free.dailyRuns);
    expect(plans.studio.monthlyCredits).toBeGreaterThan(plans.pro.monthlyCredits);
  });
});

describe("cycleExpired", () => {
  const now = Date.parse("2026-07-06T12:00:00Z");

  it("is fresh within 30 days", () => {
    expect(cycleExpired(new Date(now - 29 * DAY).toISOString(), now)).toBe(false);
  });

  it("expires at 30 days", () => {
    expect(cycleExpired(new Date(now - 30 * DAY).toISOString(), now)).toBe(true);
  });

  it("treats missing or malformed timestamps as expired (forces a clean reset)", () => {
    expect(cycleExpired(null, now)).toBe(true);
    expect(cycleExpired("not-a-date", now)).toBe(true);
  });
});

describe("cycleResetsAt", () => {
  it("is 30 days after cycle start", () => {
    const start = "2026-07-01T00:00:00.000Z";
    expect(cycleResetsAt(start)).toBe(new Date(Date.parse(start) + 30 * DAY).toISOString());
  });

  it("returns null when there is no cycle", () => {
    expect(cycleResetsAt(null)).toBeNull();
  });
});

describe("planFromStripePrice", () => {
  const env = { STRIPE_PRICE_PRO: "price_pro_123", STRIPE_PRICE_STUDIO: "price_studio_456" };

  it("maps configured price ids to plans", () => {
    expect(planFromStripePrice("price_pro_123", env)).toBe("pro");
    expect(planFromStripePrice("price_studio_456", env)).toBe("studio");
  });

  it("returns null for unknown or missing price ids", () => {
    expect(planFromStripePrice("price_other", env)).toBeNull();
    expect(planFromStripePrice(null, env)).toBeNull();
    expect(planFromStripePrice("price_pro_123", {})).toBeNull();
  });
});
