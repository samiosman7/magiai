import "server-only";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { getMcpServerConfigs, type McpServerConfig, type McpServerStatus } from "./config";

export async function getMcpServerStatuses(): Promise<McpServerStatus[]> {
  const configs = getMcpServerConfigs();

  if (configs.length === 0) return [];

  const statuses = await Promise.all(configs.map(readMcpServerStatus));
  return statuses;
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
    await client.connect(transport, { timeout: 12_000 });
    const response = await client.listTools(undefined, { timeout: 12_000 });
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
