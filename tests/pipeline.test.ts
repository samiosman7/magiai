import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { MagiEvent } from "@/lib/magi/types";
import type { Attachment } from "@/lib/magi/attachments";

// Keep the pipeline hermetic and offline: stub runtime context (MCP/skills) and
// search (Tavily). Model calls go through mock mode (MAGI_MOCK_MODE).
vi.mock("@/lib/magi/runtime-context", () => ({
  buildMagiRuntimeContext: async () => ({
    nodeSkillContext: { melchior: "", balthasar: "", casper: "", judge: "" },
    projectSkillContext: "",
    mcpContext: "",
    mcpToolContext: "",
    connectedMcpCount: 0,
    configuredMcpCount: 0,
  }),
}));

vi.mock("@/lib/magi/search", () => ({
  webSearch: async () => [],
  buildGrounding: () => ({ block: "", sourcesList: "" }),
}));

import { runMagiPipeline, isRevisionRequest, parseObjections } from "@/lib/magi/pipeline";

async function run(prompt: string, attachments: Attachment[] = []): Promise<MagiEvent[]> {
  const events: MagiEvent[] = [];
  await runMagiPipeline(prompt, "standard", (e) => events.push(e), { attachments });
  return events;
}

function att(over: Partial<Attachment>): Attachment {
  return { id: "a1", name: "f.txt", kind: "text", chars: 0, truncated: false, ok: true, text: "", ...over };
}

describe("runMagiPipeline", () => {
  beforeEach(() => {
    process.env.MAGI_MOCK_MODE = "true";
  });
  afterEach(() => {
    delete process.env.MAGI_MOCK_MODE;
  });

  it("answers greetings instantly with no model call", async () => {
    const events = await run("hi");
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("final");
    expect((events[0] as { answer: string }).answer).toContain("Hello. MAGI is online.");
  });

  it("computes plain arithmetic instantly", async () => {
    const events = await run("2+2");
    const final = events.find((e) => e.type === "final") as { answer: string };
    expect(final.answer).toContain("4");
  });

  it("runs the full ensemble for real work and always emits a final answer", async () => {
    const events = await run("Draft a go-to-market plan for a B2B SaaS");
    const types = events.map((e) => e.type);
    expect(types).toContain("task");
    expect(types).toContain("cost");
    expect(types).toContain("final");
    // step lifecycle drove the trace
    expect(events.some((e) => e.type === "step" && e.state === "done")).toBe(true);
  });

  it("skips the instant shortcut when a file is attached and surfaces it", async () => {
    const events = await run("hi", [att({ name: "contract.pdf", kind: "pdf", text: "This Agreement...", chars: 17 })]);
    // Not the 1-event quick path anymore.
    expect(events.length).toBeGreaterThan(1);
    const attachNode = events.find((e) => e.type === "node" && e.name === "Attachments");
    expect(attachNode).toBeTruthy();
    expect(events.some((e) => e.type === "final")).toBe(true);
  });

  it("routes an attached contract as a legal task", async () => {
    const events = await run("what should I watch out for", [
      att({ name: "nda.txt", text: "WHEREAS the parties agree; the Receiving Party shall indemnify...", chars: 60 }),
    ]);
    const task = events.find((e) => e.type === "task") as { profile: { kind: string } } | undefined;
    expect(task?.profile.kind).toBe("legal");
  });

  it("emits a verification event on full-chain runs", async () => {
    const events = await run("Draft a go-to-market plan for a B2B SaaS");
    const verification = events.find((e) => e.type === "verification");
    expect(verification).toBeTruthy();
    expect((verification as { revised: boolean }).revised).toBe(false);
  });

  it("takes the single-call revision path for a refinement follow-up", async () => {
    const prior = "# Plan\n" + "Detailed prior deliverable content. ".repeat(20);
    const events: MagiEvent[] = [];
    await runMagiPipeline("make it shorter", "standard", (e) => events.push(e), {
      history: [
        { role: "user", text: "Draft a plan" },
        { role: "assistant", text: prior },
      ],
    });
    // Revision path: no task/artifact events (no router), one Revision cost node.
    expect(events.some((e) => e.type === "task")).toBe(false);
    const cost = events.find((e) => e.type === "cost") as { breakdown: Array<{ node: string }> };
    expect(cost.breakdown.map((b) => b.node)).toEqual(["Revision"]);
    const verification = events.find((e) => e.type === "verification") as { revised: boolean };
    expect(verification.revised).toBe(true);
    expect(events.some((e) => e.type === "final")).toBe(true);
  });
});

describe("isRevisionRequest", () => {
  const prior = "x".repeat(300);

  it("detects refinement phrasing against a prior answer", () => {
    expect(isRevisionRequest("make it shorter", prior)).toBe(true);
    expect(isRevisionRequest("turn this into an email", prior)).toBe(true);
    expect(isRevisionRequest("rewrite in a formal tone", prior)).toBe(true);
  });

  it("never fires without a substantial prior answer", () => {
    expect(isRevisionRequest("make it shorter", null)).toBe(false);
    expect(isRevisionRequest("make it shorter", "short")).toBe(false);
  });

  it("does not hijack new work or long requests", () => {
    expect(isRevisionRequest("research solid-state batteries with sources", prior)).toBe(false);
    expect(isRevisionRequest("what's the capital of France", prior)).toBe(false);
    expect(isRevisionRequest(`make it shorter ${"and better ".repeat(40)}`, prior)).toBe(false);
  });
});

describe("parseObjections", () => {
  it("splits a numbered critique into discrete objections", () => {
    const critique =
      "1. The pricing claim is unsupported by any source.\n2) The timeline ignores onboarding.\n3. No competitor analysis.";
    const objections = parseObjections(critique);
    expect(objections).toHaveLength(3);
    expect(objections[0]).toContain("pricing claim");
    expect(objections[1]).toContain("timeline");
  });

  it("returns empty for prose without numbering", () => {
    expect(parseObjections("Looks solid overall.")).toEqual([]);
    expect(parseObjections("")).toEqual([]);
  });
});
