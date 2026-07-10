import { describe, it, expect } from "vitest";
import { classifyTask } from "@/lib/magi/task-router";

describe("classifyTask", () => {
  it("routes a legal prompt to the legal kind", () => {
    expect(classifyTask("review this employment contract").kind).toBe("legal");
    expect(classifyTask("what are the liability clauses in this NDA").kind).toBe("legal");
  });

  it("routes website, research, and coding prompts", () => {
    expect(classifyTask("build me a landing page").kind).toBe("website");
    expect(classifyTask("research the latest on solid-state batteries with sources").kind).toBe("research");
    expect(classifyTask("debug this typescript build error").kind).toBe("coding");
  });

  it("falls back to general when nothing matches", () => {
    expect(classifyTask("tell me a joke about penguins").kind).toBe("general");
  });

  it("forceLegal promotes the legal rule even for a terse prompt", () => {
    // A bare "review this" with a legal-looking attachment must still route legal.
    expect(classifyTask("review this", { forceLegal: true }).kind).toBe("legal");
    expect(classifyTask("summarize", { forceLegal: true }).label).toBe("Legal document review");
  });

  it("does not force legal when the flag is off", () => {
    expect(classifyTask("review this").kind).not.toBe("legal");
  });

  it("raises complexityBoost as more task signals appear", () => {
    const simple = classifyTask("hello there");
    const layered = classifyTask("analyze the market, compare pricing, and plan a strategy");
    expect(layered.complexityBoost).toBeGreaterThan(simple.complexityBoost);
    expect(layered.secondaryKinds.length).toBeGreaterThan(0);
  });
});
