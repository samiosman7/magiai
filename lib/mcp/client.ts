import "server-only";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { getMcpServerConfigs, type McpServerConfig, type McpServerStatus } from "./config";

type McpTextContent = {
  type: "text";
  text: string;
};

export async function getMcpServerStatuses(): Promise<McpServerStatus[]> {
  const configs = getMcpServerConfigs();

  if (configs.length === 0) return [];

  const statuses = await Promise.all(configs.map(readMcpServerStatus));
  return statuses;
}

export async function queryContext7Docs(prompt: string): Promise<string | null> {
  const libraryName = inferLibraryName(prompt);
  if (!libraryName) return null;

  const config = getMcpServerConfigs().find(
    (server) =>
      server.enabled &&
      server.name.toLowerCase().includes("context7") &&
      server.url.includes("context7")
  );
  if (!config) return null;

  const client = new Client({ name: "magi-context7-client", version: "0.1.0" });
  const transport = new StreamableHTTPClientTransport(new URL(config.url), {
    requestInit: {
      headers: config.headers,
    },
  });

  try {
    await client.connect(transport, { timeout: 12_000 });
    const query = redactSensitiveText(prompt).slice(0, 800);
    const resolved = await client.callTool(
      {
        name: "resolve-library-id",
        arguments: { libraryName, query },
      },
      undefined,
      { timeout: 12_000 }
    );
    const resolvedText = extractText(resolved.content);
    const libraryId = resolvedText.match(/Context7-compatible library ID:\s*(\/[^\s]+)/)?.[1];
    if (!libraryId) return null;

    const docs = await client.callTool(
      {
        name: "query-docs",
        arguments: { libraryId, query },
      },
      undefined,
      { timeout: 16_000 }
    );
    const docsText = extractText(docs.content).slice(0, 6000);
    if (!docsText.trim()) return null;

    return [
      `Executed MCP tool: Context7 resolve-library-id for ${libraryName}.`,
      `Resolved library ID: ${libraryId}`,
      "Executed MCP tool: Context7 query-docs.",
      docsText,
    ].join("\n");
  } catch {
    return null;
  } finally {
    await client.close().catch(() => undefined);
  }
}

export async function queryMagicUiInspiration(prompt: string): Promise<string | null> {
  if (!isUiPrompt(prompt)) return null;

  const config = getMcpServerConfigs().find(
    (server) =>
      server.enabled &&
      /(21st|magic)/i.test(server.name) &&
      !server.url.includes("context7")
  );
  if (!config) return null;

  const client = new Client({ name: "magi-magic-client", version: "0.1.0" });
  const transport = new StreamableHTTPClientTransport(new URL(config.url), {
    requestInit: {
      headers: config.headers,
    },
  });

  try {
    await client.connect(transport, { timeout: 120_000 });
    const tools = await client.listTools(undefined, { timeout: 120_000 });
    const hasInspirationTool = tools.tools?.some(
      (tool) => tool.name === "21st_magic_component_inspiration"
    );
    if (!hasInspirationTool) return null;

    const result = await client.callTool(
      {
        name: "21st_magic_component_inspiration",
        arguments: {
          message: redactSensitiveText(prompt).slice(0, 1200),
          searchQuery: inferMagicSearchQuery(prompt),
        },
      },
      undefined,
      { timeout: 120_000 }
    );

    const text = extractText(result.content).slice(0, 6000);
    if (!text.trim()) return null;

    return [
      "Executed MCP tool: 21st.dev Magic 21st_magic_component_inspiration.",
      text,
    ].join("\n");
  } catch {
    return null;
  } finally {
    await client.close().catch(() => undefined);
  }
}

async function readMcpServerStatus(config: McpServerConfig): Promise<McpServerStatus> {
  if (!config.enabled) {
    return {
      name: config.name,
      url: config.url,
      enabled: false,
      connected: false,
      tools: [],
    };
  }

  const client = new Client({ name: "magi-mcp-client", version: "0.1.0" });
  const transport = new StreamableHTTPClientTransport(new URL(config.url), {
    requestInit: {
      headers: config.headers,
    },
  });

  try {
    const timeout = isMagicServer(config) ? 120_000 : 12_000;
    await client.connect(transport, { timeout });
    const response = await client.listTools(undefined, { timeout });
    await client.close();

    return {
      name: config.name,
      url: config.url,
      enabled: true,
      connected: true,
      tools:
        response.tools?.map((tool) => ({
          name: tool.name,
          description: tool.description,
        })) ?? [],
    };
  } catch (error) {
    await client.close().catch(() => undefined);

    return {
      name: config.name,
      url: config.url,
      enabled: true,
      connected: false,
      tools: [],
      error: error instanceof Error ? error.message : "MCP connection failed.",
    };
  }
}

function inferLibraryName(prompt: string) {
  const lower = prompt.toLowerCase();
  const candidates: Array<[RegExp, string]> = [
    [/\bnext(?:\.js|js)?\b/, "Next.js"],
    [/\breact\b/, "React"],
    [/\bsupabase\b/, "Supabase"],
    [/\bstripe\b/, "Stripe"],
    [/\bvercel\b/, "Vercel"],
    [/\bprisma\b/, "Prisma"],
    [/\btailwind\b/, "Tailwind CSS"],
    [/\bthree(?:\.js|js)?\b/, "Three.js"],
    [/\bplaywright\b/, "Playwright"],
    [/\bclerk\b/, "Clerk"],
    [/\bgemini\b|\bgoogle ai\b/, "Google Gemini"],
    [/\banthropic\b|\bclaude\b/, "Anthropic"],
    [/\bopenai\b|\bgpt\b/, "OpenAI"],
  ];

  return candidates.find(([pattern]) => pattern.test(lower))?.[1] ?? null;
}

function isMagicServer(config: McpServerConfig) {
  return /(21st|magic)/i.test(config.name) && !config.url.includes("context7");
}

function isUiPrompt(prompt: string) {
  const lower = prompt.toLowerCase();
  return (
    /\b(ui|ux|interface|component|button|card|modal|dialog|form|table|dashboard|sidebar|navbar|landing page|website|homepage|pricing|hero)\b/.test(
      lower
    ) &&
    /\b(build|create|make|generate|design|improve|refine|redesign|inspiration|website|page|component)\b/.test(
      lower
    )
  );
}

function inferMagicSearchQuery(prompt: string) {
  const lower = prompt.toLowerCase();
  const matches: Array<[RegExp, string]> = [
    [/\bpricing\b/, "pricing cards"],
    [/\bdashboard\b/, "dashboard ui"],
    [/\bsidebar\b/, "sidebar navigation"],
    [/\bnavbar|navigation\b/, "navbar"],
    [/\bhero\b/, "hero section"],
    [/\bform|booking|contact\b/, "booking form"],
    [/\bmodal|dialog\b/, "modal dialog"],
    [/\bcard|cards\b/, "feature cards"],
    [/\btable\b/, "data table"],
    [/\blanding page|homepage|website\b/, "landing page"],
  ];

  return matches.find(([pattern]) => pattern.test(lower))?.[1] ?? "modern ui";
}

function redactSensitiveText(value: string) {
  return value
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, "[REDACTED_GOOGLE_KEY]")
    .replace(/sk_[0-9A-Za-z_-]{20,}/g, "[REDACTED_SECRET_KEY]")
    .replace(/sb_secret_[0-9A-Za-z_-]+/g, "[REDACTED_SUPABASE_SECRET]")
    .replace(/Bearer\s+[0-9A-Za-z._-]+/gi, "Bearer [REDACTED]");
}

function extractText(content: unknown) {
  if (!Array.isArray(content)) return "";
  return content
    .filter((item): item is McpTextContent => Boolean(item) && item.type === "text")
    .map((item) => item.text)
    .join("\n");
}
