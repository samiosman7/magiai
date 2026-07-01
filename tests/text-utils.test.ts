import { describe, it, expect } from "vitest";
import { parseTriage, cleanFinalAnswer, stripDanglingCitations } from "@/lib/magi/text-utils";

describe("parseTriage", () => {
  it("reads a SIMPLE tag and strips it", () => {
    const r = parseTriage("[SIMPLE]\nParis is the capital of France.");
    expect(r.decision).toBe("simple");
    expect(r.body).toBe("Paris is the capital of France.");
  });

  it("reads COMPLEX and REFUSE (case-insensitive, tolerant of brackets/spacing)", () => {
    expect(parseTriage("[COMPLEX] here is a plan").decision).toBe("complex");
    expect(parseTriage("refuse: I can't help with that").decision).toBe("refuse");
  });

  it("defaults to complex when no tag is present (protects quality)", () => {
    const r = parseTriage("no tag here, just prose");
    expect(r.decision).toBe("complex");
    expect(r.body).toBe("no tag here, just prose");
  });
});

describe("cleanFinalAnswer", () => {
  it("unwraps a {\"final_answer\"} JSON envelope", () => {
    const wrapped = '```json\n{"final_answer": "the real answer"}\n```';
    expect(cleanFinalAnswer(wrapped)).toBe("the real answer");
  });

  it("appends files_to_create as code blocks", () => {
    const wrapped = JSON.stringify({
      final_answer: "done",
      files_to_create: [{ filename: "a.js", content: "x=1" }],
    });
    const out = cleanFinalAnswer(wrapped);
    expect(out).toContain("done");
    expect(out).toContain("**a.js**");
    expect(out).toContain("x=1");
  });

  it("passes plain prose through untouched (trimmed)", () => {
    expect(cleanFinalAnswer("  just prose  ")).toBe("just prose");
  });
});

describe("stripDanglingCitations", () => {
  it("removes citations that point past the real source count", () => {
    expect(stripDanglingCitations("a[1] b[2] c[7]", 2)).toBe("a[1] b[2] c");
  });

  it("keeps all citations in range", () => {
    expect(stripDanglingCitations("a[1] b[3]", 3)).toBe("a[1] b[3]");
  });

  it("leaves text alone when there are no sources", () => {
    expect(stripDanglingCitations("a[1] b[2]", 0)).toBe("a[1] b[2]");
  });
});
