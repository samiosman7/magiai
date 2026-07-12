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

### 4. Real per-user auth — CODE DONE (July 2026), configure in Supabase
Supabase Auth is wired: `/login` offers **email+password (primary) and magic link**,
sessions live in cookies, and every API route resolves the real account first
(anonymous operator ids remain only while billing is off — with `MAGI_REQUIRE_BILLING=true`,
`/api/magi` and Stripe checkout return 401 until the user signs in).

Remaining config (Supabase Dashboard → Authentication):
- **URL Configuration**: set Site URL to your prod domain and add
  `https://<domain>/auth/callback` to Redirect URLs (magic links break without this).
- **Sign In / Up**: email provider is on by default. Decide "Confirm email":
  OFF = invited users start instantly; ON = they confirm first (needs working email).
- **SMTP**: the built-in sender is rate-limited (~2-4 emails/hour) — fine for a tiny
  beta, but plug in custom SMTP (e.g. Resend free tier) before real volume.
- Vercel env: add `NEXT_PUBLIC_SUPABASE_ANON_KEY` (already in `.env.local` locally).

### 5. Stripe subscriptions (code is done — just configure)
Plans are **monthly subscriptions** (defined in `lib/billing/plans.ts`):
Free $0 (10 credits/mo, 20 runs/day, no premium routing) · Pro $15/mo (200 credits,
100 runs/day) · Studio $40/mo (600 credits, 300 runs/day). Credits **reset** to the
allowance each cycle (Stripe invoice for paid; lazy 30-day roll for free).

- In Stripe: create two products with **recurring monthly prices** ($15 Pro, $40 Studio).
- Vercel env: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `STRIPE_PRICE_PRO`, `STRIPE_PRICE_STUDIO` (the recurring price ids).
- Webhook at `https://<domain>/api/stripe/webhook` listening for:
  `checkout.session.completed`, `invoice.paid`,
  `customer.subscription.updated`, `customer.subscription.deleted`.
- Enable the **customer portal** (Settings → Billing → Customer portal) —
  "Manage billing" in the console uses it for cancel/upgrade/card changes.
- Set `MAGI_REQUIRE_BILLING=true` to enforce credits + plan gates
  (premium mode requires Pro; anonymous callers get 401 on runs/checkout).
  `MAGI_FREE_CREDITS` optionally overrides the free monthly allowance.
- Test in Stripe test mode first (test cards + `stripe listen` for the webhook).

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

## The "feels like an AI" layer (added — Fable 5 session)
Five fixes that turn MAGI from a form-that-returns-a-report into a collaborator:

- **Conversational revision fast-path** — refinement follow-ups ("make it shorter",
  "turn this into an email") skip the 4-node chain and run ONE streamed revision call
  seeded with the prior deliverable: seconds, not 40s. Post-answer follow-up chips
  invite iteration. (`isRevisionRequest` in pipeline.ts.)
- **Operator memory** — MAGI learns durable facts about each user from runs (cheap
  extraction pass after success) + user-set standing instructions; both injected into
  every run and fully visible/editable in the console's "MAGI memory" panel
  (`/api/memory`, `lib/magi/memory.ts`). **Needs the `magi_memory` table — re-run
  `supabase/schema.sql`** (idempotent). Fails open until then.
- **Visible verification** — every full-chain answer carries a "✓ Verified" panel:
  the Adversary's objections (resolved by Synthesis) + how many sources grounded it.
- **Real Word export** — every answer downloads as a native .docx
  (`lib/export/docx.ts`, `/api/export/docx`; headings/bold/lists/quotes styled).
- **Thread persistence** — the conversation survives reloads (localStorage).

## Public freemium & spend guardrails (added — Fable 5 session)
**The release-day money protection.** Three layers so a stampede can't drain your wallet:

1. **Free-trial wall** — in **public mode** (no `MAGI_BETA_CODE`), unsigned visitors get
   `MAGI_FREE_TRIAL_RUNS` (default **5**) successful runs, counted per IP (durable, in
   `magi_rate_limits`) so clearing localStorage doesn't reset it. Then `/api/magi` returns
   `402 {signupRequired}` and the console shows a signup wall → Free plan (10 credits/mo) →
   subscribe. Only successful runs burn a slot. Private beta (`MAGI_BETA_CODE` set) skips the
   wall. Toggle count with `MAGI_FREE_TRIAL_RUNS`, window with `MAGI_TRIAL_WINDOW_DAYS` (30).
2. **Per-user caps** apply ALWAYS now (not just when billing is on): anonymous callers resolve
   to the **Free plan**, so even the free beta is bounded to free-tier daily limits ($/runs).
3. **Global ceilings** — `MAGI_DAILY_USD_CAP` (default $20/day) and the NEW
   **`MAGI_MONTHLY_USD_CAP` (default $100/month)** — the hard wallet cap; daily alone allowed
   ~30× that. Plus `MAGI_USER_MONTHLY_USD_CAP` (default $5). All fail open only if Supabase is
   down; the `MAGI_EMERGENCY_STOP` kill switch is the zero-dependency backstop.

**Going public:** unset `MAGI_BETA_CODE` (that alone makes `/console` publicly reachable; the
trial wall then gates). Keep it set to stay invite-only. Landing has a "Try 5 free runs" CTA → `/console`.

## Rate limiting (added — Fable 5 session)
- **Public endpoints** are IP-limited: `/api/access` (beta-code brute-force guard,
  10 / IP / 10 min) and `/api/waitlist` (spam guard, 8 / IP / hour). Authenticated
  endpoints (`/api/magi`, file/artifact downloads) keep their per-user hourly limits.
- **Two layers** (`lib/security/rate-limit.ts`): an in-memory burst floor (instant,
  per-instance) plus a **durable Supabase-backed** fixed-window counter so limits hold
  across serverless instances — essential for brute-force protection. The durable layer
  **fails open** if its table is missing, so nothing breaks before you create it.
- **ACTION**: the durable layer needs the new `magi_rate_limits` table. Re-run
  `supabase/schema.sql` (idempotent — safe to run again; it only adds the missing table).
  Until then the in-memory floor still protects within each instance.

## File uploads & document/legal analysis (added — Fable 5 session)
- **Upload** any of: PDF, DOCX, TXT/MD/CSV/JSON/etc., and images (PNG/JPG/WEBP).
  Attach via the 📎 button in the console composer (up to 6 files, 15 MB each).
- **Extraction** (`lib/magi/attachments.ts` + `/api/files/extract`): text files decode
  directly, DOCX is unzipped, PDF uses `unpdf` (serverless-safe, no native deps), and
  images/scanned docs are OCR'd via the AI gateway vision model
  (`MAGI_VISION_MODEL`, default `openai/gpt-4o-mini`).
- **Pipeline**: extracted text is injected into **every** node's prompt (survives the
  whole chain, unlike chat history which only the Architect sees). A run with only a
  file and no prompt defaults to "summarize what matters."
- **Legal mode**: when the prompt or a document looks legal (contract/NDA/lease/etc.),
  the run routes as `legal` and every node gets a clause-review directive — parties,
  obligations, dates, liability, termination, governing law, risky/missing terms — plus
  a mandatory "not legal advice" disclaimer. `looksLegal` in attachments.ts.
- **Limits**: per-file 24k chars into the model; `MAGI_FILE_RATE_LIMIT` (default 40/hr).
- Extraction is client-agnostic: the console holds the parsed text and sends it back
  with the run; `/api/magi` re-validates and re-caps it server-side.

## Full env-var reference
| Var | Purpose |
| --- | --- |
| `AI_GATEWAY_API_KEY` | model calls (Vercel AI Gateway) |
| `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SECRET_KEY` | Supabase (server) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | real per-user auth (`/login`, sessions) — wired |
| `TAVILY_API_KEY` | grounding / sources |
| `MAGI_BETA_CODE` | locks `/console` (unset = open) |
| `MAGI_DAILY_USD_CAP` / `MAGI_USER_DAILY_USD_CAP` | daily $ caps (default 25 / 2) |
| `MAGI_USER_DAILY_RUNS` | per-user daily run cap (default 50) |
| `MAGI_EMERGENCY_STOP` | `true` halts all complex runs |
| `MAGI_STREAM_IDLE_MS` | stalled-stream abort (default 30000) |
| `MAGI_REQUIRE_BILLING` + `STRIPE_*` | activate subscriptions (code ready) |
| `MAGI_FREE_CREDITS` | override free plan's monthly credits (default 10) |
| `MAGI_FILE_RATE_LIMIT` | file uploads per user per hour (default 40) |
| `MAGI_VISION_MODEL` | gateway model for image/scanned-doc OCR (default `openai/gpt-4o-mini`) |
