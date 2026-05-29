export type McpCatalogEntry = {
  id: string;
  name: string;
  category: string;
  description: string;
  transport: "streamable-http" | "stdio" | "both";
  productionReadyOnVercel: boolean;
  sourceUrl: string;
  install?: {
    command?: string;
    args?: string[];
    url?: string;
  };
  notes: string[];
};

export const mcpCatalog: McpCatalogEntry[] = [
  {
    id: "21st-dev-magic",
    name: "21st.dev Magic MCP",
    category: "UI/UX design",
    description:
      "Generates modern frontend UI components from natural language prompts. Strong fit for Balthasar's UI generation skill.",
    transport: "stdio",
    productionReadyOnVercel: false,
    sourceUrl: "https://github.com/21st-dev/magic-mcp",
    install: {
      command: "npx",
      args: ["-y", "@21st-dev/magic"],
    },
    notes: [
      "Best used in local IDE agents such as Cursor, Windsurf, Cline, or Claude Desktop.",
      "Not enabled directly on Vercel because it is stdio/local-process oriented.",
      "Can be used by MAGI in production through the services/magic-mcp-bridge remote HTTP bridge.",
    ],
  },
  {
    id: "playwright",
    name: "Microsoft Playwright MCP",
    category: "Browser automation and QA",
    description:
      "Lets agents inspect and interact with web pages through Playwright. Useful for visual QA, flows, forms, and generated-site verification.",
    transport: "both",
    productionReadyOnVercel: false,
    sourceUrl: "https://github.com/microsoft/playwright-mcp",
    install: {
      command: "npx",
      args: ["@playwright/mcp@latest"],
    },
    notes: [
      "Can run as stdio locally or with an HTTP port for local MCP clients.",
      "For Vercel production, prefer a remote hosted browser service instead of spawning browsers inside serverless functions.",
    ],
  },
  {
    id: "supabase",
    name: "Supabase MCP",
    category: "Database and backend",
    description:
      "Exposes Supabase database, logs, advisors, Edge Functions, and project metadata tools for backend development.",
    transport: "both",
    productionReadyOnVercel: true,
    sourceUrl: "https://supabase.com/mcp",
    notes: [
      "Use for schema inspection, migrations, logs, advisors, and generated TypeScript types.",
      "Scope access carefully because database tools can mutate production data.",
    ],
  },
  {
    id: "context7",
    name: "Context7 MCP",
    category: "Current documentation",
    description:
      "Fetches up-to-date library documentation and code examples for coding agents.",
    transport: "both",
    productionReadyOnVercel: true,
    sourceUrl: "https://github.com/truefoundry/context7-mcp-server",
    notes: [
      "Useful for avoiding stale API usage in generated code.",
      "Pair with Fact Judge's provider compatibility and hallucination detection skills.",
    ],
  },
  {
    id: "github",
    name: "GitHub MCP",
    category: "Repository automation",
    description:
      "Repository, issue, pull request, and code-search automation for agentic development workflows.",
    transport: "both",
    productionReadyOnVercel: true,
    sourceUrl: "https://github.com/github/github-mcp-server",
    notes: [
      "Use for branch, issue, PR, and repo automation once auth and user permissions are ready.",
      "Requires careful write-action confirmations.",
    ],
  },
];
