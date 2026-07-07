# MAGI Plans & Usage Limits

Last updated: 2026-07-06 (supersedes the 2026-06-01 hidden-capacity proposal —
decision: **visible credits and limits**, not Claude-style capacity states).

## Plans (source of truth: `lib/billing/plans.ts`)

| Plan | Price | Credits/mo | Runs/day | $/day cap | Premium routing |
| --- | --- | --- | --- | --- | --- |
| Free | $0 | 10 | 20 | $0.50 | no |
| Pro | $15/mo | 200 | 100 | $5 | yes |
| Studio | $40/mo | 600 | 300 | $15 | yes |

Credit prices per run: economy 0.5 · standard 1 · premium 3 (+1 surcharge for
prompts over 6k chars). Credits **reset** to the plan allowance each cycle —
they do not accumulate.

## Cycle mechanics

- **Paid plans**: the Stripe webhook is authoritative. `checkout.session.completed`
  starts the plan, `invoice.paid` (subscription_cycle) resets credits monthly,
  `customer.subscription.updated` handles plan switches, `…deleted` drops to free.
  Paid cycles never reset lazily, so a missed webhook can't double-grant.
- **Free plan**: no invoices, so the cycle rolls lazily — on first use after 30
  days, credits reset to the allowance (`cycleExpired` in plans.ts).

## Enforcement order on `/api/magi`

1. `MAGI_REQUIRE_BILLING=true` + anonymous caller → 401 (sign in).
2. Plan gate: premium mode on a free plan → blocked with upgrade message.
3. Credit gate: balance < run estimate → blocked with reset/upgrade message.
4. Spend guard (`checkSpendLimits`): kill switch → global $/day cap →
   per-user $/day and runs/day using the **plan's** limits (env defaults for
   anonymous callers). Blocked runs return a clean capacity message, never spend.
5. Failed runs are never charged; real cost is still recorded for caps.

## What users see

- Console "Plan & usage" panel: plan name/price, credit meter (X / allowance),
  runs-today meter (X / daily cap), reset date, upgrade + manage-billing buttons.
- `/api/me` exposes the same snapshot (`billing.*`).
- Landing page `#pricing` section shows the three tiers.

## Hard safety backstops (env, unchanged)

- `MAGI_EMERGENCY_STOP=true` — kill switch, blocks all runs
- `MAGI_DAILY_USD_CAP` — global $/day across all users (default 25)
- `MAGI_USER_DAILY_USD_CAP` / `MAGI_USER_DAILY_RUNS` — per-user fallbacks when
  no plan is known (default 2 / 50)
- Max prompt length 12k chars; in-memory hourly rate limiter as burst guard
