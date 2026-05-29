import { randomUUID } from "node:crypto";
import cors from "cors";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  isInitializeRequest,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "0.0.0.0";
const BRIDGE_TOKEN = process.env.BRIDGE_TOKEN || "";
const MAGIC_COMMAND = process.env.MAGIC_COMMAND || "npx";
const MAGIC_ARGS = parseArgs(process.env.MAGIC_ARGS) || ["-y", "@21st-dev/magic@latest"];
const MAGIC_API_KEY =
  process.env.MAGIC_API_KEY ||
  process.env.TWENTY_FIRST_API_KEY ||
  process.env.TWENTYFIRST_API_KEY ||
  process.env.API_KEY ||
  "";

const transports = new Map();

const app = createMcpExpressApp({ host: HOST });
app.use(cors({ origin: true }));

app.get("/", (_req, res) => {
  res.type("text/plain").send("MAGI 21st.dev Magic MCP bridge is online. Use /mcp.");
});

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "magi-magic-mcp-bridge",
    command: MAGIC_COMMAND,
    args: MAGIC_ARGS,
    hasMagicApiKey: Boolean(MAGIC_API_KEY),
    authEnabled: Boolean(BRIDGE_TOKEN),
    sessions: transports.size,
  });
});

app.post("/mcp", requireBridgeAuth, async (req, res) => {
  try {
    const sessionId = req.headers["mcp-session-id"];
    let transport = sessionId ? transports.get(sessionId) : undefined;

    if (!transport && !sessionId && isInitializeRequest(req.body)) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (newSessionId) => {
          transports.set(newSessionId, transport);
        },
      });

      const upstream = new MagicUpstream();
      const server = createBridgeServer(upstream);

      transport.onclose = async () => {
        if (transport.sessionId) transports.delete(transport.sessionId);
        await upstream.close();
      };

      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      return;
    }

    if (!transport) {
      res.status(400).json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Bad Request: No valid MCP session.",
        },
        id: null,
      });
      return;
    }

    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("MCP bridge request failed", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : "Internal bridge error.",
        },
        id: null,
      });
    }
  }
});

app.get("/mcp", requireBridgeAuth, async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  const transport = sessionId ? transports.get(sessionId) : undefined;

  if (!transport) {
    res.status(400).send("Invalid or missing MCP session ID.");
    return;
  }

  await transport.handleRequest(req, res);
});

const httpServer = app.listen(PORT, HOST, () => {
  console.log(`MAGI Magic MCP bridge listening on http://${HOST}:${PORT}/mcp`);
});

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

async function shutdown() {
  console.log("Shutting down MAGI Magic MCP bridge...");
  httpServer.close();
  await Promise.allSettled([...transports.values()].map((transport) => transport.close()));
  transports.clear();
  process.exit(0);
}

function createBridgeServer(upstream) {
  const server = new Server(
    { name: "magi-21st-dev-magic-bridge", version: "0.1.0" },
    {
      capabilities: {
        tools: {},
      },
      instructions:
        "Remote bridge for the 21st.dev Magic stdio MCP server. Calls are forwarded to @21st-dev/magic.",
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async (request) => {
    await upstream.connect();
    return upstream.client.listTools(request.params, { timeout: 30_000 });
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    await upstream.connect();
    return upstream.client.callTool(
      {
        name: request.params.name,
        arguments: request.params.arguments,
      },
      undefined,
      { timeout: 120_000 }
    );
  });

  return server;
}

class MagicUpstream {
  client = null;
  transport = null;
  connecting = null;

  async connect() {
    if (this.client) return;
    if (this.connecting) {
      await this.connecting;
      return;
    }

    this.connecting = this.open();
    await this.connecting;
    this.connecting = null;
  }

  async open() {
    if (!MAGIC_API_KEY) {
      throw new Error("Missing MAGIC_API_KEY, TWENTY_FIRST_API_KEY, TWENTYFIRST_API_KEY, or API_KEY.");
    }

    const env = {
      ...process.env,
      API_KEY: MAGIC_API_KEY,
      TWENTY_FIRST_API_KEY: MAGIC_API_KEY,
      TWENTYFIRST_API_KEY: MAGIC_API_KEY,
    };

    this.client = new Client({ name: "magi-magic-stdio-client", version: "0.1.0" });
    this.transport = new StdioClientTransport({
      command: MAGIC_COMMAND,
      args: MAGIC_ARGS,
      env,
      stderr: "pipe",
    });

    this.transport.onerror = (error) => {
      console.error("Magic stdio transport error", error);
    };

    this.transport.stderr?.on("data", (chunk) => {
      console.error(`[magic stderr] ${String(chunk).trim()}`);
    });

    await this.client.connect(this.transport, { timeout: 60_000 });
  }

  async close() {
    await this.client?.close().catch(() => undefined);
    this.client = null;
    this.transport = null;
    this.connecting = null;
  }
}

function requireBridgeAuth(req, res, next) {
  if (!BRIDGE_TOKEN) {
    next();
    return;
  }

  const expected = `Bearer ${BRIDGE_TOKEN}`;
  const authHeader = req.headers.authorization;
  const bridgeHeader = req.headers["x-bridge-token"];

  if (authHeader === expected || bridgeHeader === BRIDGE_TOKEN) {
    next();
    return;
  }

  res.status(401).json({
    error: "Unauthorized",
  });
}

function parseArgs(value) {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed) && parsed.every((entry) => typeof entry === "string")) {
      return parsed;
    }
  } catch {
    return value.split(" ").filter(Boolean);
  }

  return null;
}
