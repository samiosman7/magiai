import "server-only";

export type SearchResult = { title: string; url: string; content: string };

// Small in-memory TTL cache so identical queries don't re-hit Tavily (cost + latency).
const searchCache = new Map<string, { at: number; results: SearchResult[] }>();
const SEARCH_TTL_MS = 5 * 60 * 1000;

// Tavily web search (built for LLM grounding). Returns clean extracted content.
// Fails soft: returns [] if no key or on any error, so the pipeline can proceed ungrounded.
export async function webSearch(query: string, maxResults = 5): Promise<SearchResult[]> {
  const key = process.env.TAVILY_API_KEY;
  if (!key || !query.trim()) return [];

  const cacheKey = `${maxResults}:${query.trim().toLowerCase()}`;
  const hit = searchCache.get(cacheKey);
  if (hit && Date.now() - hit.at < SEARCH_TTL_MS) return hit.results;

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        query: query.slice(0, 400),
        max_results: maxResults,
        search_depth: "basic",
        include_answer: false,
        include_raw_content: true, // fuller page text so verification has real evidence, not a snippet
      }),
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      results?: Array<{ title?: string; url?: string; content?: string; raw_content?: string }>;
    };
    const results = (data.results ?? [])
      .filter((r) => r.url)
      .map((r) => ({
        title: (r.title || r.url || "").slice(0, 160),
        url: r.url!,
        // Prefer fuller extracted page text; cap to bound tokens/cost across sources.
        content: (r.raw_content || r.content || "").replace(/\s+/g, " ").trim().slice(0, 1200),
      }));
    searchCache.set(cacheKey, { at: Date.now(), results });
    return results;
  } catch {
    return [];
  }
}

// Build the grounding block injected into node prompts, plus a Sources markdown list.
export function buildGrounding(results: SearchResult[]): { block: string; sourcesList: string } {
  if (results.length === 0) return { block: "", sourcesList: "" };
  const block =
    "RESEARCHED SOURCES — base every factual claim ONLY on these; cite inline as [n]; do not invent facts beyond them:\n" +
    results.map((r, i) => `[${i + 1}] ${r.title} — ${r.url}\n${r.content}`).join("\n\n");
  const n = results.length;
  const note = `_Checked against ${n} source${n > 1 ? "s" : ""}; claims they don't support were flagged or cut._`;
  const sourcesList =
    `${note}\n\n## Sources\n` + results.map((r, i) => `${i + 1}. [${r.title}](${r.url})`).join("\n");
  return { block, sourcesList };
}
