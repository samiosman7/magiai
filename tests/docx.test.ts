import { describe, it, expect } from "vitest";
import { buildDocx, inlineRuns, markdownToDocxBody } from "@/lib/export/docx";

describe("inlineRuns", () => {
  it("emits bold and italic runs", () => {
    const xml = inlineRuns("plain **bold** and *italic*");
    expect(xml).toContain("<w:b/>");
    expect(xml).toContain("<w:i/>");
    expect(xml).toContain(">bold<");
  });

  it("escapes XML-hostile characters", () => {
    const xml = inlineRuns("a < b & c > d");
    expect(xml).toContain("a &lt; b &amp; c &gt; d");
    expect(xml).not.toMatch(/<w:t[^>]*>[^<]*&(?!amp;|lt;|gt;|quot;)/);
  });
});

describe("markdownToDocxBody", () => {
  it("maps headings, bullets, and paragraphs", () => {
    const xml = markdownToDocxBody("# Title\n\nSome text.\n\n- point one\n- point two\n\n## Section");
    expect(xml).toContain('w:val="Heading1"');
    expect(xml).toContain('w:val="Heading2"');
    expect(xml).toContain("• ");
    expect(xml).toContain("Some text.");
  });

  it("keeps numbered lists and skips table separators", () => {
    const xml = markdownToDocxBody("1. first\n2) second\n\n| A | B |\n|---|---|\n| 1 | 2 |");
    expect(xml).toContain("1. ");
    expect(xml).toContain("first");
    expect(xml).not.toContain("---");
  });
});

describe("buildDocx", () => {
  it("produces a valid docx zip with the expected parts", async () => {
    const bytes = await buildDocx("# Report\n\nHello **world**.", "My Report");
    // PK zip magic
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);

    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(bytes);
    expect(zip.file("[Content_Types].xml")).toBeTruthy();
    expect(zip.file("word/document.xml")).toBeTruthy();
    expect(zip.file("word/styles.xml")).toBeTruthy();

    const doc = await zip.file("word/document.xml")!.async("string");
    expect(doc).toContain("My Report");
    expect(doc).toContain("Hello");
    expect(doc).toContain("<w:b/>");
  });
});
