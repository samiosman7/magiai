import "server-only";

export type SearchResult = { title: string; url: string; content: string };

// Tavily web search (built for LLM grounding). Returns clean extracted content.
// Fails soft: returns [] if no key or on any error, so the pipeline can proceed ungrounded.
export async function webSearch(query: string, maxResults = 5): Promise<SearchResult[]> {
  const key = process.env.TAVILY_API_KEY;
  if (!key || !query.trim()) return [];

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
      }),
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { results?: Array<{ title?: string; url?: string; content?: string }> };
    return (data.results ?? [])
      .filter((r) => r.url)
      .map((r) => ({
        title: (r.title || r.url || "").slice(0, 160),
        url: r.url!,
        content: (r.content || "").slice(0, 600),
      }));
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
  const sourcesList =
    "## Sources\n" + results.map((r, i) => `${i + 1}. [${r.title}](${r.url})`).join("\n");
  return { block, sourcesList };
}
