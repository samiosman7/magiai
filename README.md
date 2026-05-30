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
- Universal task router for coding, research, writing, strategy, data, automation, websites, and general prompts
- Artifact planning for code, reports, documents, plans, data packages, projects, and direct answers
- Downloadable universal artifact ZIPs at `/api/artifacts/download`
- Local workspace history in the UI for recent runs
- Supabase schema support for persisted artifacts
- Optional run saving and credit deduction after `/api/magi` completes
- Agentic website ZIP generation using MAGI skills and MCP context

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
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_PRICE_STARTER=
STRIPE_PRICE_PRO=
STRIPE_PRICE_STUDIO=
NEXT_PUBLIC_APP_URL=
MCP_SERVERS_JSON=
MAGI_MOCK_MODE=false
MAGI_REQUIRE_BILLING=false
MAGI_FREE_CREDITS=5
MAGI_RUN_RATE_LIMIT=30
MAGI_ARTIFACT_RATE_LIMIT=20
```

Leave `MAGI_MOCK_MODE=true` if you want to test the app without calling paid model APIs.
Leave `MAGI_REQUIRE_BILLING=false` until auth and Stripe checkout are connected. When enabled with Supabase configured, MAGI checks and deducts credits.

For Gemini key rotation, put keys in `.env.local` as one comma-separated line:

```text
GOOGLE_API_KEYS=first_key,second_key,third_key
```

Do not commit `.env.local`. If a key is pasted into chat or a public place, rotate it.

## Next Functional Milestones

- Add Stripe Checkout and webhook credit top-ups
- Run `supabase/schema.sql` in Supabase SQL editor
- Add auth and signup webhook to create `magi_profiles` rows
- Replace `local-test-user` with real Supabase Auth user ids
- Store generated artifact files in Supabase Storage
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

Useful operational endpoints:

```text
/api/providers
/api/runs
/api/artifacts
/api/artifacts/download
/api/stripe/checkout
/api/stripe/webhook
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

Website downloads are now generated through the agentic project builder path:

- loads MAGI `SKILL.md` files from `magi-skills/`
- includes configured MCP server/tool context
- asks the model for a JSON file manifest
- validates/sanitizes files
- falls back to a deterministic starter only if live generation fails
