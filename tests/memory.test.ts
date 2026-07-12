import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  hasSupabaseConfig: () => false,
  getSupabaseAdmin: () => {
    throw new Error("not needed");
  },
}));

import { mergeFacts, buildOperatorContext, MAX_FACTS } from "@/lib/magi/memory";

describe("mergeFacts", () => {
  it("appends new facts and trims whitespace", () => {
    expect(mergeFacts(["Works at Acme"], ["  Prefers   bullet points  "])).toEqual([
      "Works at Acme",
      "Prefers bullet points",
    ]);
  });

  it("dedupes case-insensitively, keeping the newest phrasing", () => {
    const merged = mergeFacts(["works at acme corp"], ["Works at Acme Corp"]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toBe("Works at Acme Corp");
  });

  it("drops junk fragments and caps the list at the newest facts", () => {
    const many = Array.from({ length: 30 }, (_, i) => `Durable fact number ${i} about the operator`);
    const merged = mergeFacts([], [...many, "ok"]); // "ok" too short → dropped
    expect(merged).toHaveLength(MAX_FACTS);
    expect(merged[merged.length - 1]).toContain("number 29");
    expect(merged.some((f) => f === "ok")).toBe(false);
  });
});

describe("buildOperatorContext", () => {
  it("is empty when nothing is known", () => {
    expect(buildOperatorContext({ facts: [], standingInstructions: "" })).toBe("");
  });

  it("includes standing instructions and remembered facts", () => {
    const ctx = buildOperatorContext({
      facts: ["Runs a design studio"],
      standingInstructions: "Always answer concisely.",
    });
    expect(ctx).toContain("STANDING INSTRUCTIONS");
    expect(ctx).toContain("Always answer concisely.");
    expect(ctx).toContain("Runs a design studio");
  });
});
