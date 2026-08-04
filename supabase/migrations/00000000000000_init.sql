-- EchoJournal initial schema (5 core tables + indexes + RLS).
-- Extracted from the README DDL so the schema is versioned in the repo.
--
-- IMPORTANT: the RLS policies below use auth.uid(), which only works with
-- Supabase Auth sessions. This app authenticates with Clerk and currently
-- accesses data server-side via the service-role client (which bypasses RLS).
-- To make RLS effective, wire up Clerk as a Supabase third-party auth
-- provider and rewrite the policies to:
--   (select auth.jwt()->>'sub') = user_id
-- See: https://supabase.com/docs/guides/auth/third-party/clerk

create extension if not exists "pgcrypto";

-- audio_files
create table if not exists public.audio_files (
  id           uuid primary key default gen_random_uuid(),
  user_id      text not null,
  storage_path text not null,
  mime_type    text,
  duration_ms  integer,
  created_at   timestamptz default now()
);

-- transcripts
create table if not exists public.transcripts (
  id             uuid primary key default gen_random_uuid(),
  user_id        text not null,
  audio_id       uuid not null references public.audio_files (id) on delete cascade,
  text           text,
  rephrased_text text,
  language       text,
  created_at     timestamptz default now()
);

-- daily_question (daily mood)
create table if not exists public.daily_question (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  day_quality text not null,
  emotions    text[] not null default '{}'::text[],
  created_at  timestamptz default now(),
  updated_at  timestamptz
);

create index if not exists daily_question_user_date_idx
  on public.daily_question (user_id, created_at);

-- daily_summaries
create table if not exists public.daily_summaries (
  id                uuid primary key default gen_random_uuid(),
  user_id           text not null,
  date              date not null,
  summary           text not null,
  entry_count       integer,
  mood_quality      text,
  mood_overall      text,
  mood_reason       text,
  dominant_emotions text[],
  achievements      text[],
  commitments       text[],
  flashback         text,
  stats             jsonb,
  gen_version       text,
  edited            boolean default false,
  created_at        timestamptz default now(),
  updated_at        timestamptz,
  last_generated_at timestamptz,
  constraint daily_summaries_user_date_unique unique (user_id, date)
);

create index if not exists daily_summaries_user_date_idx
  on public.daily_summaries (user_id, date);

-- period_reflections (Echos)
create table if not exists public.period_reflections (
  id                uuid primary key default gen_random_uuid(),
  user_id           text not null,
  period_type       text not null, -- 'daily' | 'weekly' | 'monthly'
  period_start      date not null,
  period_end        date not null,
  mood_overall      text,
  mood_reason       text,
  achievements      text[],
  commitments       text[],
  flashback         text,
  stats             jsonb,
  gen_version       text,
  edited            boolean default false,
  created_at        timestamptz default now(),
  updated_at        timestamptz,
  last_generated_at timestamptz,
  constraint period_reflections_unique
    unique (user_id, period_type, period_start, period_end)
);

create index if not exists period_reflections_user_period_idx
  on public.period_reflections (user_id, period_type, period_start, period_end);

-- Row-Level Security (see header note: requires Clerk third-party auth to be
-- effective; with the current service-role-only access these are inert).
alter table public.audio_files enable row level security;
create policy "Audio owners can CRUD" on public.audio_files
  for all using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);

alter table public.transcripts enable row level security;
create policy "Transcript owners can CRUD" on public.transcripts
  for all using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);

alter table public.daily_summaries enable row level security;
create policy "Daily summaries owners can CRUD" on public.daily_summaries
  for all using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);

alter table public.period_reflections enable row level security;
create policy "Period reflections owners can CRUD" on public.period_reflections
  for all using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);

alter table public.daily_question enable row level security;
create policy "Daily question owners can CRUD" on public.daily_question
  for all using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);

-- Storage: create a private bucket named 'audio-files' (Dashboard > Storage).
