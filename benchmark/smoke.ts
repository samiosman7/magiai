import { readFileSync } from "node:fs";
import { join } from "node:path";
const raw = readFileSync(join(process.cwd(), ".env.local"), "utf8");
for (const line of raw.split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
import("../lib/magi/providers").then(async ({ generateText }) => {
  const r = await generateText({
    provider: "vercel",
    model: "anthropic/claude-sonnet-4.5",
    system: "You are terse.",
    prompt: "Reply with exactly: MAGI ONLINE",
    maxTokens: 20,
  });
  console.log("OK:", JSON.stringify(r.text), "| isMock:", r.isMock);
});
