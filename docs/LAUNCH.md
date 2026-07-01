# MAGI — Go-Live Runbook

Everything is built and verified. What remains is **configuration only** — credentials and
decisions the code can't supply itself. This is the exact, ordered checklist.

---

## A. Free invited beta (safe to do today)

No charging, but secured, capped, grounded, moderated.

### 1. Create the database tables
In the Supabase SQL editor, run the full **`supabase/schema.sql`** once. It creates:
`magi_profiles`, `magi_runs`, `magi_credit_events`, `magi_artifacts`, `magi_spend`, `magi_waitlist`.

### 2. Set Vercel env vars (Project → Settings → Environment Variables)
| Var | Purpose |
| --- | --- |
| `AI_GATEWAY_API_KEY` | model calls (confirm it's set) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SECRET_KEY` | Supabase service key |
| `TAVILY_API_KEY` | grounding / sources |
| `MAGI_BETA_CODE` | **locks `/console`** — share with invited users |
| `MAGI_DAILY_USD_CAP` | global $/day kill ceiling (e.g. `25`) |
| `MAGI_USER_DAILY_USD_CAP` | per-user $/day (e.g. `2`) |
| `MAGI_USER_DAILY_RUNS` | per-user runs/day (e.g. `50`) |
| `MAGI_EMERGENCY_STOP` | set `true` to instantly halt all complex runs |

### 3. Invite
Email approved waitlist users the `MAGI_BETA_CODE`. They enter it once at `/access`.

**Result:** gated access, hard spend caps + kill switch, grounded+cited answers,
harmful prompts refused, failed runs don't charge. Defensible private beta.

---

## B. Turn on charging (the literal goal)

Two things the code is waiting on:

### 4. Real per-user auth — needs input from you
The only remaining **code** gap. Give the assistant your **Supabase anon/publishable key**
(`NEXT_PUBLIC_SUPABASE_ANON_KEY`) and pick email magic-link vs password. Then it wires
Supabase Auth so credits/charges attach to real accounts (today they key off the access-gate
identity). Cannot be built/tested without that key.

### 5. Stripe (code is done — just configure)
- In Stripe: create products + prices for the credit packs.
- Vercel env: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_STUDIO`.
- Set `MAGI_REQUIRE_BILLING=true` (enforces credits) and `MAGI_FREE_CREDITS` (e.g. `5`).
- Point the Stripe webhook at `https://<domain>/api/stripe/webhook`.
- Test in Stripe test mode first.

### 6. Domain + final checks
Point a domain at the Vercel project; verify `/`, `/access`, `/console` in prod;
confirm a capped/blocked run shows the clean capacity message.

---

## What's already built & verified

- **Spend safety:** kill switch + global/per-user daily $ caps + durable per-user run cap (Supabase).
- **Access:** `/console` + `/api/magi` gated behind `MAGI_BETA_CODE`.
- **Safety:** harmful-prompt moderation (refuses before spending); graceful failure (clean message, no charge).
- **The wedge:** grounding — research/analysis answers cite real Tavily sources, verified against them.
- **UX:** streamed answers, sanitized Markdown, multi-turn context, stop/cancel (stops spend),
  copy + `.md` export, mobile layout, onboarding examples, dev panels hidden (`?dev=1` to show).
- **Legal:** `/terms` + `/privacy`.
- **Billing code:** credit checks, deduction, Stripe checkout + webhook (inert until configured above).

---

## Reliability (added — Fable 5 session)
- **CI**: `.github/workflows/ci.yml` runs typecheck + `vitest` + build on every push/PR. Keep it green — it's the gate before auto-deploy.
- **Tests**: `npm test` (vitest). Covers text-utils + spend-cap logic. Add tests with new logic.
- **Logs**: `/api/magi` emits structured `magi.start` / `magi.done` / `magi.error` lines (request id, mode, cost, latency) — greppable in Vercel logs.

## Full env-var reference
| Var | Purpose |
| --- | --- |
| `AI_GATEWAY_API_KEY` | model calls (Vercel AI Gateway) |
| `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SECRET_KEY` | Supabase (server) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **needed for real auth** (not yet wired) |
| `TAVILY_API_KEY` | grounding / sources |
| `MAGI_BETA_CODE` | locks `/console` (unset = open) |
| `MAGI_DAILY_USD_CAP` / `MAGI_USER_DAILY_USD_CAP` | daily $ caps (default 25 / 2) |
| `MAGI_USER_DAILY_RUNS` | per-user daily run cap (default 50) |
| `MAGI_EMERGENCY_STOP` | `true` halts all complex runs |
| `MAGI_STREAM_IDLE_MS` | stalled-stream abort (default 30000) |
| `MAGI_REQUIRE_BILLING` + `STRIPE_*` | activate charging (code ready) |
