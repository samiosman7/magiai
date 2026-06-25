create extension if not exists pgcrypto;

create table if not exists public.magi_profiles (
  clerk_user_id text primary key,
  email text,
  plan text not null default 'free',
  credits numeric(10, 2) not null default 5,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
