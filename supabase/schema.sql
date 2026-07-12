create extension if not exists pgcrypto;

-- plan: 'free' | 'pro' | 'studio'. Credits reset to the plan's monthly allowance
-- each billing cycle (Stripe invoice for paid plans, lazy 30-day roll for free).
create table if not exists public.magi_profiles (
  clerk_user_id text primary key,
  email text,
  plan text not null default 'free',
  credits numeric(10, 2) not null default 10,
  stripe_customer_id text,
  stripe_subscription_id text,
  cycle_started_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Safe to re-run on an existing database (columns added after the first deploy).
alter table public.magi_profiles add column if not exists stripe_customer_id text;
alter table public.magi_profiles add column if not exists stripe_subscription_id text;
alter table public.magi_profiles add column if not exists cycle_started_at timestamptz not null default now();

create index if not exists magi_profiles_stripe_customer_idx
  on public.magi_profiles(stripe_customer_id);

create table if not exists public.magi_credit_events (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null references public.magi_profiles(clerk_user_id) on delete cascade,
  delta numeric(10, 2) not null,
  reason text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.magi_runs (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null references public.magi_profiles(clerk_user_id) on delete cascade,
  mode text not null,
  prompt text not null,
  final_answer text,
  credits_charged numeric(10, 2) not null default 0,
  provider_usage jsonb not null default '[]'::jsonb,
  dossier jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.magi_artifacts (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.magi_runs(id) on delete cascade,
  clerk_user_id text not null references public.magi_profiles(clerk_user_id) on delete cascade,
  artifact_type text not null,
  title text not null,
  status text not null default 'planned',
  summary text,
  files jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.magi_profiles enable row level security;
alter table public.magi_credit_events enable row level security;
alter table public.magi_runs enable row level security;
alter table public.magi_artifacts enable row level security;

create index if not exists magi_credit_events_user_created_idx
  on public.magi_credit_events(clerk_user_id, created_at desc);

create index if not exists magi_runs_user_created_idx
  on public.magi_runs(clerk_user_id, created_at desc);

create index if not exists magi_artifacts_user_created_idx
  on public.magi_artifacts(clerk_user_id, created_at desc);

create index if not exists magi_artifacts_run_idx
  on public.magi_artifacts(run_id);

-- Waitlist for the pre-launch landing page. Inserts happen via the service role
-- (server-side API route), so no public RLS policy is granted.
create table if not exists public.magi_waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  source text,
  referrer text,
  created_at timestamptz not null default now()
);

alter table public.magi_waitlist enable row level security;

create index if not exists magi_waitlist_created_idx
  on public.magi_waitlist(created_at desc);

-- Daily spend tracking for cost caps (one row per user per UTC day).
-- Inserts/updates via the service role (server); no public RLS policy.
create table if not exists public.magi_spend (
  user_id text not null,
  day date not null default current_date,
  spent_usd numeric not null default 0,
  run_count integer not null default 0,
  primary key (user_id, day)
);

alter table public.magi_spend enable row level security;

create index if not exists magi_spend_day_idx on public.magi_spend(day);

-- MAGI's per-operator memory: durable facts learned from runs + the operator's
-- standing instructions. One row per user; written via the service role.
create table if not exists public.magi_memory (
  clerk_user_id text primary key,
  facts jsonb not null default '[]'::jsonb,
  standing_instructions text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.magi_memory enable row level security;

-- Durable fixed-window rate limiting for public endpoints (access code, waitlist),
-- so limits survive serverless instance churn. Written via the service role only;
-- fixed windows keyed by (bucket, window_start-epoch-ms). Fails open if absent.
create table if not exists public.magi_rate_limits (
  bucket text not null,
  window_start bigint not null,
  count integer not null default 0,
  primary key (bucket, window_start)
);

alter table public.magi_rate_limits enable row level security;

create index if not exists magi_rate_limits_window_idx on public.magi_rate_limits(window_start);
