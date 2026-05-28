---
name: mcp-tool-orchestration
description: MCP tool orchestration skill pack for MAGI. Use when selecting, configuring, listing, invoking, or reasoning about Model Context Protocol servers and tools, including remote HTTP MCP servers and local stdio MCP servers.
---

# MCP Tool Orchestration

Use this skill when MAGI needs external tools or data through MCP.

## Workflow

1. Determine whether the needed capability is tool use, current docs, browser automation, database access, design generation, filesystem access, or deployment.
2. Prefer remote Streamable HTTP MCP servers in production serverless environments.
3. Use local stdio MCP servers only for local IDE/desktop agents that can spawn processes.
4. Keep secrets in environment variables or vaults; never expose them to browser code.
5. List available tools before assuming a tool exists.
6. Treat MCP tools as high-trust/high-risk: verify server source, permissions, and write scope.

## Output Contract

Return:

```json
{
  "needed_capability": "",
  "recommended_servers": [],
  "transport": "streamable-http|stdio",
  "required_secrets": [],
  "security_notes": [],
  "fallback_plan": ""
}
```

## Checklist

- MCP server selection
- Remote vs local transport choice
- Tool discovery
- Secret handling
- Permission scoping
- Server provenance review
- Write-action safeguards
- Fallback path
