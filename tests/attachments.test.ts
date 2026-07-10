import { describe, it, expect } from "vitest";
import {
  buildAttachmentBlock,
  looksLegal,
  attachmentSummary,
  type Attachment,
} from "@/lib/magi/attachments";

function att(over: Partial<Attachment>): Attachment {
  return {
    id: "a1",
    name: "file.txt",
    kind: "text",
    chars: 0,
    truncated: false,
    ok: true,
    text: "",
    ...over,
  };
}

describe("buildAttachmentBlock", () => {
  it("returns empty when there is no usable file", () => {
    expect(buildAttachmentBlock([])).toBe("");
    expect(buildAttachmentBlock([att({ ok: false, text: "" })])).toBe("");
  });

  it("includes each usable file's name and text, numbered", () => {
    const block = buildAttachmentBlock([
      att({ name: "contract.pdf", kind: "pdf", text: "PARTY A agrees...", chars: 16 }),
      att({ name: "notes.txt", text: "some notes", chars: 10 }),
    ]);
    expect(block).toContain("FILE 1: contract.pdf");
    expect(block).toContain("PARTY A agrees...");
    expect(block).toContain("FILE 2: notes.txt");
    expect(block).toContain("PDF");
  });

  it("skips unreadable files but keeps readable ones", () => {
    const block = buildAttachmentBlock([
      att({ name: "scan.png", kind: "image", ok: false, text: "" }),
      att({ name: "ok.txt", text: "hello", chars: 5 }),
    ]);
    expect(block).not.toContain("scan.png");
    expect(block).toContain("ok.txt");
  });
});

describe("looksLegal", () => {
  it("detects legal intent from the prompt", () => {
    expect(looksLegal([], "review this contract for red flags")).toBe(true);
    expect(looksLegal([], "what is the capital of France")).toBe(false);
  });

  it("detects legal content from an attachment even with a terse prompt", () => {
    const legalDoc = att({
      name: "lease.pdf",
      kind: "pdf",
      text: "This Agreement is made between the parties. WHEREAS the Tenant shall indemnify the Landlord...",
      chars: 90,
    });
    expect(looksLegal([legalDoc], "read this")).toBe(true);
  });

  it("does not treat an ordinary attachment as legal", () => {
    const recipe = att({ name: "cake.txt", text: "Mix flour and sugar, bake at 350F.", chars: 34 });
    expect(looksLegal([recipe], "summarize this")).toBe(false);
  });
});

describe("attachmentSummary", () => {
  it("counts readable vs total and lists names", () => {
    const summary = attachmentSummary([
      att({ name: "a.pdf", text: "x", chars: 1 }),
      att({ name: "b.png", ok: false, text: "" }),
    ]);
    expect(summary).toContain("1/2 files read");
    expect(summary).toContain("a.pdf");
    expect(summary).toContain("b.png (unreadable)");
  });

  it("is empty with no attachments", () => {
    expect(attachmentSummary([])).toBe("");
  });
});
