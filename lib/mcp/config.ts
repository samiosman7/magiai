export type McpServerConfig = {
  name: string;
  url: string;
  enabled: boolean;
  headers?: Record<string, string>;
};

export type McpServerStatus = {
  name: string;
  url: string;
  enabled: boolean;
  connected: boolean;
  tools: Array<{ name: string; description?: string }>;
  error?: string;
};

export function getMcpServerConfigs(): McpServerConfig[] {
  const raw = process.env.MCP_SERVERS_JSON;
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map(normalizeServerConfig)
      .filter((server): server is McpServerConfig => Boolean(server));
  } catch {
    return [];
  }
}

function normalizeServerConfig(value: unknown): McpServerConfig | null {
  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  const name = typeof record.name === "string" ? record.name.trim() : "";
  const url = typeof record.url === "string" ? record.url.trim() : "";

  if (!name || !url) return null;

  return {
    name,
    url,
    enabled: record.enabled !== false,
    headers: normalizeHeaders(record.headers),
  };
}

function normalizeHeaders(value: unknown) {
  if (!value || typeof value !== "object") return undefined;

  const headers: Record<string, string> = {};
  for (const [key, headerValue] of Object.entries(value as Record<string, unknown>)) {
    if (typeof headerValue === "string") headers[key] = headerValue;
  }

  return Object.keys(headers).length > 0 ? headers : undefined;
}
