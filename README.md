# MAGI Web

NERV-inspired multi-model AI orchestration app.

## Run Locally

```powershell
npm install
npm run dev
```

Then open:

```text
http://localhost:3000
```

## What Works Now

- Next.js app UI
- Economy / Standard / Premium MAGI mode selector
- Backend `/api/magi` route
- Streamed pipeline updates
- Simple prompt fast path
- Complex prompt MAGI pipeline
- Melchior, Balthasar, Casper, and Fact Judge passes
- Dual-signal reprompt loop
- Mock mode for local development without paid API calls
- Credit gate stub before model routing
- File-based MAGI skill packs in `magi-skills/`

## Provider Setup

Copy `.env.example` to `.env.local` and add server-side keys:

```text
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_API_KEY=
GOOGLE_API_KEYS=
DEEPSEEK_API_KEY=
QWEN_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
MCP_SERVERS_JSON=
MAGI_MOCK_MODE=false
MAGI_REQUIRE_BILLING=false
```

Leave `MAGI_MOCK_MODE=true` if you want to test the app without calling paid model APIs.
Leave `MAGI_REQUIRE_BILLING=false` until auth, Stripe, and the credit ledger are connected.

For Gemini key rotation, put keys in `.env.local` as one comma-separated line:

```text
GOOGLE_API_KEYS=first_key,second_key,third_key
```

Do not commit `.env.local`. If a key is pasted into chat or a public place, rotate it.

## Next Functional Milestones

- Add Stripe Checkout and webhooks
- Run `supabase/schema.sql` in Supabase SQL editor
- Add auth and signup webhook to create `magi_profiles` rows
- Deduct credits and save runs after `/api/magi` completes
- Store dossiers and provider usage per run
- Add per-user rate limits and monthly spend caps

## MCP Servers

MAGI supports remote Streamable HTTP MCP servers through `MCP_SERVERS_JSON`.

Example:

```json
[
  {
    "name": "docs",
    "url": "https://example.com/mcp",
    "enabled": true
  }
]
```

Check configured MCP servers at:

```text
/api/mcp/servers
```

Check the curated MCP catalog at:

```text
/api/mcp/catalog
```

Included catalog entries:

- 21st.dev Magic MCP for UI generation: https://github.com/21st-dev/magic-mcp
- Microsoft Playwright MCP for browser automation: https://github.com/microsoft/playwright-mcp
- Supabase MCP for database/backend operations: https://supabase.com/mcp
- Context7 MCP for current documentation: https://github.com/truefoundry/context7-mcp-server
- GitHub MCP for repository automation: https://github.com/github/github-mcp-server

Stdio MCP servers are not enabled for Vercel production because serverless functions should not spawn long-lived local tool processes.

For local IDE clients, see `mcp.local.example.json`.

## MAGI Skill Packs

- `magi-skills/melchior-diagnostics/SKILL.md`
- `magi-skills/balthasar-builder/SKILL.md`
- `magi-skills/casper-guardian/SKILL.md`
- `magi-skills/fact-judge-auditor/SKILL.md`
- `magi-skills/ui-ux-product-design/SKILL.md`
- `magi-skills/agentic-project-builder/SKILL.md`
- `magi-skills/mcp-tool-orchestration/SKILL.md`
- `magi-skills/product-strategy-growth/SKILL.md`

Format references are listed in `magi-skills/REFERENCES.md`.
