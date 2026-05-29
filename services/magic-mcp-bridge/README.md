# MAGI 21st.dev Magic MCP Bridge

This service exposes the local stdio-only `@21st-dev/magic` MCP server as a remote Streamable HTTP MCP endpoint.

MAGI on Vercel cannot run long-lived stdio MCP processes inside serverless functions. Host this bridge on an always-on Node platform such as Render, Fly.io, Railway, or a small VPS, then add its `/mcp` URL to `MCP_SERVERS_JSON`.

## Required Env

```bash
MAGIC_API_KEY=your_21st_dev_magic_key
BRIDGE_TOKEN=long_random_token
PORT=8787
```

`MAGIC_API_KEY` is passed to `@21st-dev/magic` as `API_KEY`, `TWENTY_FIRST_API_KEY`, and `TWENTYFIRST_API_KEY` for compatibility.

Optional:

```bash
MAGIC_COMMAND=npx
MAGIC_ARGS=["-y","@21st-dev/magic@latest"]
```

## Run Locally

```bash
cd services/magic-mcp-bridge
npm install
MAGIC_API_KEY=... BRIDGE_TOKEN=dev-token npm start
```

Health check:

```bash
curl http://localhost:8787/health
```

MCP endpoint:

```text
http://localhost:8787/mcp
```

## Add To MAGI

Set this on the MAGI Vercel project:

```json
[
  {
    "name": "Context7",
    "url": "https://mcp.context7.com/mcp",
    "enabled": true
  },
  {
    "name": "21st.dev Magic",
    "url": "https://YOUR-BRIDGE-HOST/mcp",
    "enabled": true,
    "headers": {
      "Authorization": "Bearer YOUR_BRIDGE_TOKEN"
    }
  }
]
```

Then redeploy MAGI.

## Deploy Notes

- Use an always-on service. Free tiers that sleep may make the first MAGI request slow or fail.
- Keep `BRIDGE_TOKEN` enabled because this bridge can spend your 21st.dev Magic credits.
- The bridge forwards `tools/list` and `tools/call` to `@21st-dev/magic`.
- The bridge does not store generated components. It only proxies MCP traffic.

## Render Quick Deploy

This folder includes `render.yaml`. Create a Render Blueprint from the GitHub repo, set `MAGIC_API_KEY`, let Render generate `BRIDGE_TOKEN`, and deploy.

After deploy, copy the generated token and service URL into MAGI's `MCP_SERVERS_JSON`, then redeploy MAGI.
