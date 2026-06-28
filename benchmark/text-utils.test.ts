/**
 * Unit tests for the pure pipeline text helpers. No API calls.
 * Run: npx tsx benchmark/text-utils.test.ts   (exit 0 = pass, 1 = fail)
 */
import assert from "node:assert";
import { parseTriage, cleanFinalAnswer, stripDanglingCitations } from "../lib/magi/text-utils";

let passed = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (e) {
    console.error(`FAIL  ${name}: ${(e as Error).message}`);
    process.exitCode = 1;
  }
}

// parseTriage
check("triage: [SIMPLE] tag", () => {
  const r = parseTriage("[SIMPLE]\nParis is the capital.");
  assert.equal(r.decision, "simple");
  assert.equal(r.body, "Paris is the capital.");
});
check("triage: [COMPLEX] tag", () => {
  assert.equal(parseTriage("[COMPLEX]\n# Plan").decision, "complex");
});
check("triage: [REFUSE] tag", () => {
  const r = parseTriage("[REFUSE] I can't help with that.");
  assert.equal(r.decision, "refuse");
  assert.equal(r.body, "I can't help with that.");
});
check("triage: case-insensitive + no brackets", () => {
  assert.equal(parseTriage("simple: hello").decision, "simple");
});
check("triage: defaults to complex when untagged", () => {
  const r = parseTriage("Here is a long answer with no tag.");
  assert.equal(r.decision, "complex");
  assert.equal(r.body, "Here is a long answer with no tag.");
});

// cleanFinalAnswer
check("clean: unwraps {final_answer} envelope", () => {
  assert.equal(cleanFinalAnswer('{"final_answer":"Hello world"}'), "Hello world");
});
check("clean: unwraps ```json fenced envelope", () => {
  assert.equal(cleanFinalAnswer('```json\n{"final_answer":"Hi"}\n```'), "Hi");
});
check("clean: passes through plain markdown", () => {
  assert.equal(cleanFinalAnswer("# Title\n\nBody."), "# Title\n\nBody.");
});

// stripDanglingCitations
check("citations: removes [n] past source count", () => {
  assert.equal(stripDanglingCitations("A [1] B [7] C", 3), "A [1] B  C");
});
check("citations: keeps valid [n]", () => {
  assert.equal(stripDanglingCitations("A [1] B [3]", 3), "A [1] B [3]");
});
check("citations: no-op when no sources", () => {
  assert.equal(stripDanglingCitations("A [9] B", 0), "A [9] B");
});

console.log(`\n${passed} passed${process.exitCode ? ", with failures" : ""}`);
