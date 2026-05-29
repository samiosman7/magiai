import "server-only";

import { getMcpServerStatuses, queryContext7Docs } from "@/lib/mcp/client";
import { mcpCatalog } from "@/lib/mcp/catalog";
import { skillPackPaths, type MagiNode } from "./skills";
import { loadSkillPacks } from "./skill-loader";

export const projectSkillPaths = [
  skillPackPaths.melchior,
  skillPackPaths.balthasar,
  skillPackPaths.casper,
  skillPackPaths.judge,
  "magi-skills/ui-ux-product-design/SKILL.md",
  "magi-skills/agentic-project-builder/SKILL.md",
  "magi-skills/mcp-tool-orchestration/SKILL.md",
  "magi-skills/product-strategy-growth/SKILL.md",
];

export type MagiRuntimeContext = {
  nodeSkillContext: Record<MagiNode, string>;
  projectSkillContext: string;
  mcpContext: string;
  mcpToolContext: string;
  connectedMcpCount: number;
  configuredMcpCount: number;
};

export async function buildMagiRuntimeContext(prompt: string): Promise<MagiRuntimeContext> {
  const [melchior, balthasar, casper, judge, projectSkillContext, mcp, mcpToolContext] =
    await Promise.all([
      loadSkillPacks([skillPackPaths.melchior]),
      loadSkillPacks([skillPackPaths.balthasar]),
      loadSkillPacks([skillPackPaths.casper]),
      loadSkillPacks([skillPackPaths.judge]),
      loadSkillPacks(projectSkillPaths),
      buildMcpContext(),
      queryContext7Docs(prompt).catch(() => null),
    ]);

  return {
    nodeSkillContext: {
      melchior,
      balthasar,
      casper,
      judge,
    },
    projectSkillContext,
    mcpContext: mcp.context,
    mcpToolContext: mcpToolContext || "No MCP tool execution was needed or available for this prompt.",
    connectedMcpCount: mcp.connectedCount,
    configuredMcpCount: mcp.configuredCount,
  };
}

export async function buildMcpContext() {
  const statuses = await getMcpServerStatuses().catch(() => []);
  const configured = statuses
    .map((server) => ({
      name: server.name,
      connected: server.connected,
      enabled: server.enabled,
      tools: server.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
      })),
      error: server.error,
    }))
    .slice(0, 12);

  const connectedCount = configured.filter((server) => server.connected).length;

  return {
    connectedCount,
    configuredCount: configured.length,
    context: [
      "MCP runtime context:",
      JSON.stringify(
        {
          configuredMcpServers: configured,
          recommendedMcpCatalog: mcpCatalog.map((entry) => ({
            id: entry.id,
            name: entry.name,
            category: entry.category,
            transport: entry.transport,
            productionReadyOnVercel: entry.productionReadyOnVercel,
            notes: entry.notes,
          })),
        },
        null,
        2
      ),
      "Use connected MCP server tool listings as available capability context.",
      "Do not claim an MCP tool was executed unless this request path explicitly executed it.",
      "If no MCP servers are connected, say what would be needed to enable the relevant server instead of pretending it ran.",
    ].join("\n"),
  };
}
