import "server-only";

// Build a real .docx from MAGI's Markdown deliverable — no heavyweight deps,
// a DOCX is just a zip of OOXML parts and jszip is already here. Covers what
// MAGI actually emits: headings, paragraphs, bold/italic, bullets, numbered
// lists, code blocks, blockquotes, and simple tables.

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Inline markdown (**bold**, *italic*, `code`) → OOXML runs. Exported for tests.
export function inlineRuns(text: string, baseMono = false): string {
  const out: string[] = [];
  // Tokenize on bold / italic / code spans; keep the delimiters' inner text.
  const tokens = text.split(/(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`)/g).filter(Boolean);
  for (const tok of tokens) {
    let t = tok;
    let bold = false;
    let italic = false;
    let mono = baseMono;
    if (t.startsWith("**") && t.endsWith("**") && t.length > 4) {
      bold = true;
      t = t.slice(2, -2);
    } else if (t.startsWith("`") && t.endsWith("`") && t.length > 2) {
      mono = true;
      t = t.slice(1, -1);
    } else if (t.startsWith("*") && t.endsWith("*") && t.length > 2) {
      italic = true;
      t = t.slice(1, -1);
    }
    // Strip markdown links to their text: [label](url) → label (url)
    t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)");
    const props = [
      bold ? "<w:b/>" : "",
      italic ? "<w:i/>" : "",
      mono ? '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="20"/>' : "",
    ].join("");
    out.push(`<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ""}<w:t xml:space="preserve">${esc(t)}</w:t></w:r>`);
  }
  return out.join("") || `<w:r><w:t xml:space="preserve"></w:t></w:r>`;
}

function para(content: string, style?: string, indent = false): string {
  const pPr =
    style || indent
      ? `<w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ""}${indent ? '<w:ind w:left="360"/>' : ""}</w:pPr>`
      : "";
  return `<w:p>${pPr}${content}</w:p>`;
}

// Markdown block structure → the document body XML. Exported for tests.
export function markdownToDocxBody(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const body: string[] = [];
  let inCode = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim().startsWith("```")) {
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      body.push(para(inlineRuns(line, true)));
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed) continue;

    // Tables: header row + separator → emit rows as tab-joined text lines
    // (a full w:tbl is overkill for v1; tabbed rows keep the data intact).
    if (/^\|.+\|$/.test(trimmed)) {
      if (/^\|[\s:|-]+\|$/.test(trimmed)) continue; // separator row
      const cells = trimmed.slice(1, -1).split("|").map((c) => c.trim());
      body.push(para(inlineRuns(cells.join("   —   "))));
      continue;
    }

    const h = trimmed.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      body.push(para(inlineRuns(h[2].replace(/#+\s*$/, "").trim()), `Heading${Math.min(h[1].length, 3)}`));
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) continue; // horizontal rule
    const bullet = trimmed.match(/^[-*+]\s+(.*)$/);
    if (bullet) {
      body.push(para(`<w:r><w:t xml:space="preserve">• </w:t></w:r>${inlineRuns(bullet[1])}`, undefined, true));
      continue;
    }
    const numbered = trimmed.match(/^(\d+)[.)]\s+(.*)$/);
    if (numbered) {
      body.push(
        para(`<w:r><w:t xml:space="preserve">${numbered[1]}. </w:t></w:r>${inlineRuns(numbered[2])}`, undefined, true)
      );
      continue;
    }
    const quote = trimmed.match(/^>\s?(.*)$/);
    if (quote) {
      body.push(para(inlineRuns(quote[1]), "Quote", true));
      continue;
    }
    body.push(para(inlineRuns(trimmed)));
  }

  return body.join("");
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;

const DOC_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;

// Minimal style sheet: three heading levels, quote, and sane body defaults.
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:pPr><w:spacing w:before="320" w:after="120"/></w:pPr><w:rPr><w:b/><w:sz w:val="34"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:pPr><w:spacing w:before="280" w:after="100"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:pPr><w:spacing w:before="240" w:after="80"/></w:pPr><w:rPr><w:b/><w:sz w:val="24"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:rPr><w:i/><w:color w:val="595959"/></w:rPr></w:style>
</w:styles>`;

export async function buildDocx(markdown: string, title?: string): Promise<Uint8Array> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();

  const titleXml = title ? para(inlineRuns(title), "Heading1") : "";
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${titleXml}${markdownToDocxBody(
    markdown
  )}<w:sectPr><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`;

  zip.file("[Content_Types].xml", CONTENT_TYPES);
  zip.file("_rels/.rels", ROOT_RELS);
  zip.file("word/document.xml", document);
  zip.file("word/styles.xml", STYLES);
  zip.file("word/_rels/document.xml.rels", DOC_RELS);

  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
