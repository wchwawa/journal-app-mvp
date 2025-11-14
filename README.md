## EchoJournal Web App – Local Development Setup

This README describes how to run the EchoJournal web application locally from cloning the repository to having all core features working with `pnpm dev`.

The application is built with Next.js 15 (App Router), React 19, Supabase, Clerk, and OpenAI (Whisper, GPT, and Realtime Agents).

---

## 1. Prerequisites

Before you start, make sure you have:

- **Node.js**: Recommended LTS version 20 or higher.
- **pnpm**: Installed globally, for example:

  ```bash
  corepack enable
  corepack prepare pnpm@latest --activate
  ```

- **Modern browser** with microphone access (for audio journaling and voice companion).
- Accounts / projects for the following services (you can start some parts in “keyless” mode, see below):
  - **Supabase** – PostgreSQL + Storage for audio, transcripts, and summaries.
  - **Clerk** – Authentication and user management (supports keyless development).
  - **OpenAI** – API key for Whisper, GPT models, and Realtime Agents.

---

## 2. Clone the Repository

From your terminal:

```bash
git clone https://github.com/SmokeKillerAI/web-app-mvp.git
cd web-app-mvp/webapp
```

If your directory structure is different, adjust the `cd` path accordingly.

---

## 3. Install Dependencies

Install all project dependencies using `pnpm`:

```bash
pnpm install
```

This project assumes `pnpm` as the package manager and uses a lockfile (`pnpm-lock.yaml`) to ensure reproducible installs.

---

## 4. Configure Environment Variables

The project ships with an example environment file `env.example.txt`. For local development, create a `.env.local` file from it:

```bash
cp env.example.txt .env.local
```

Then open `.env.local` in your editor and fill in the values as described below.

### 4.1 Clerk (Authentication)

Clerk supports **keyless mode** for quick local start. You can:

- **Option A – Keyless mode (fastest way to get started)**  
  Leave the following values empty to let Clerk run in keyless mode locally:

  ```bash
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
  CLERK_SECRET_KEY=
  ```

  When the app is running, use the Clerk popup to claim and configure your application if needed.

- **Option B – Use your own Clerk application**  
  If you already have a Clerk app, set:

  ```bash
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
  CLERK_SECRET_KEY=sk_...
  ```

In both cases, keep the redirect URLs pointing to the app routes:

```bash
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/auth/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/auth/sign-up"
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL="/dashboard/overview"
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL="/dashboard/overview"
```

These values should work as long as your app runs at `http://localhost:3000`.

---

### 4.2 Supabase (Database & Storage)

Create a Supabase project at <https://supabase.com> if you do not already have one.

In the Supabase dashboard, go to **Settings → API** and copy:

- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (server-side only)

Set them in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_PUBLIC_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
```

> **Important:**  
> `SUPABASE_SERVICE_ROLE_KEY` has admin privileges and is only used on the server. Never expose it in browser code or client-side bundles.

#### 4.2.1 Database schema (DDL)

EchoJournal relies on a small set of core tables.  
The schema below is aligned with `src/types/supabase.ts` and can be applied to a fresh Supabase project.

> **Note on RLS (Row-Level Security)**  
> The DDL includes **recommended** RLS configuration for each table.  
> You should review and configure RLS policies yourself, but it is **strongly encouraged** to enable them for any shared or production environment to protect user data.

```sql
-- Enable required extension for UUID generation
create extension if not exists "pgcrypto";

-- ============================================
-- audio_files
-- ============================================
create table if not exists public.audio_files (
  id           uuid primary key default gen_random_uuid(),
  user_id      text not null,
  storage_path text not null,
  mime_type    text,
  duration_ms  integer,
  created_at   timestamptz default now()
);

-- ============================================
-- transcripts
-- ============================================
create table if not exists public.transcripts (
  id             uuid primary key default gen_random_uuid(),
  user_id        text not null,
  audio_id       uuid not null references public.audio_files (id) on delete cascade,
  text           text,
  rephrased_text text,
  language       text,
  created_at     timestamptz default now()
);

-- ============================================
-- daily_question (daily mood)
-- ============================================
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

-- ============================================
-- daily_summaries
-- ============================================
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

-- ============================================
-- period_reflections (Echos)
-- ============================================
create table if not exists public.period_reflections (
  id                uuid primary key default gen_random_uuid(),
  user_id           text not null,
  period_type       text not null, -- e.g. 'daily' | 'weekly' | 'monthly'
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

-- ============================================
-- Recommended Row-Level Security (RLS)
-- ============================================
-- IMPORTANT:
-- - Review these policies before applying them.
-- - They assume `auth.uid()` matches the `user_id` field (stored as text).
-- - Enable them in Supabase for any non-local / shared environment.

-- audio_files RLS
alter table public.audio_files enable row level security;

create policy "Audio owners can CRUD"
  on public.audio_files
  for all
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

-- transcripts RLS
alter table public.transcripts enable row level security;

create policy "Transcript owners can CRUD"
  on public.transcripts
  for all
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

-- daily_summaries RLS
alter table public.daily_summaries enable row level security;

create policy "Daily summaries owners can CRUD"
  on public.daily_summaries
  for all
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

-- period_reflections RLS
alter table public.period_reflections enable row level security;

create policy "Period reflections owners can CRUD"
  on public.period_reflections
  for all
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

-- (Optional, but recommended) daily_question RLS
-- Enable this once you are ready to route all writes through
-- authenticated contexts and server-side APIs.
alter table public.daily_question enable row level security;

create policy "Daily question owners can CRUD"
  on public.daily_question
  for all
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);
```

If you regenerate Supabase types using:

```bash
pnpm supabase:generate-types
```

make sure the resulting `src/types/supabase.ts` remains compatible with this schema (or adjust the SQL accordingly).

#### 4.2.2 Storage bucket

Create a bucket in Supabase Storage to store user audio:

- Bucket name: `audio-files`

Ensure your storage policies allow the backend to upload and read audio using the configured service role key.

---

### 4.3 OpenAI (Models & Realtime)

Create an API key from <https://platform.openai.com> and set:

```bash
OPENAI_API_KEY=sk-...
```

This key is used for:

- Whisper-1 transcription in `/api/transcribe`
- GPT models for summarization and reflections
- Realtime Agents for the voice companion

You can also configure optional model overrides:

```bash
OPENAI_REFLECTION_MODEL=gpt-5
```

Keep this aligned with your OpenAI account/model availability.

---

### 4.4 Timezone

EchoJournal uses a local timezone for daily and period boundaries (today, week, month, etc.).

Set the timezone in `.env.local`:

```bash
NEXT_PUBLIC_APP_TIMEZONE=Australia/Sydney
APP_TIMEZONE=Australia/Sydney
```

You can change `Australia/Sydney` to your own IANA timezone (for example, `America/Los_Angeles` or `Europe/London`) if needed.

---

### 4.5 Optional: Sentry (Error Tracking)

If you want full error tracking locally or in staging, configure:

```bash
NEXT_PUBLIC_SENTRY_DSN=...
NEXT_PUBLIC_SENTRY_ORG=...
NEXT_PUBLIC_SENTRY_PROJECT=...
SENTRY_AUTH_TOKEN=...
NEXT_PUBLIC_SENTRY_DISABLED="false"
```

For pure local development, you can leave these empty; Sentry integration is optional for the app to run.

---

### 4.6 Optional: Development Auth Override

For some development scenarios, you may want to temporarily loosen authentication. The project supports a development-only flag (see `docs/security-doc.md` for details).

If you use such a flag (for example, `DEV_DISABLE_AUTH`), make sure:

- It is **only set in local `.env.local`**.
- It is **never set in production or any shared environment**.

---

## 5. Start the Development Server

Once dependencies and environment variables are set, start the dev server:

```bash
pnpm dev
```

By default, the application runs at:

<http://localhost:3000>

If the server fails to start:

- Re-check `.env.local` for typos or missing values.
- Ensure your Node.js version matches the recommended LTS.
- Re-run `pnpm install` if your dependency installation previously failed.

---

## 6. Quick Local Smoke Test

After `pnpm dev` is running and the app has loaded in the browser, you can verify core flows:

1. **Sign in / Sign up**
   - Open <http://localhost:3000>.
   - Use the Clerk UI to create or sign into a user account (or use keyless mode popup).

2. **Daily mood check-in**
   - Navigate to `/dashboard/overview`.
   - Confirm you see the “Mood” card.
   - Click it to open the mood modal, select your mood and emotions, then submit.

3. **Audio journaling**
   - On the same overview page, find the audio journaling panel.
   - Allow microphone access in your browser.
   - Record a short audio clip, stop, and wait for processing to complete without errors.

4. **Journals list**
   - Go to `/dashboard/journals`.
   - Verify your recent audio/transcript appears in the list and can be filtered by date or mood.

5. **Echos (reflections)**
   - Go to `/dashboard/echos`.
   - Generate or refresh a Daily/Weekly/Monthly echo card.
   - Confirm the content roughly reflects your recent entries and mood.

6. **Voice companion (Echo)**
   - Open the voice assistant entry point (floating action, when available).
   - Start a short conversation, e.g. “How has my mood been this week?”.
   - Confirm the agent responds using your data rather than failing with an error.

If all steps above work, your local EchoJournal environment is correctly configured.

---

## 7. Troubleshooting

If you encounter issues:

- **Authentication errors**
  - Verify `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, and URLs in the Clerk dashboard.
  - Confirm `NEXT_PUBLIC_APP_URL` (if present) and actual browser URL match.

- **Supabase errors (401/403 or missing data)**
  - Re-check `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.
  - Ensure tables and bucket (`audio-files`) are created correctly.

- **Audio recording issues**
  - Make sure the browser has microphone permission for `localhost:3000`.
  - Test in a modern browser (recent Chrome, Edge, or Firefox).

- **Build or TypeScript issues in development**
  - Delete `.next` cache and retry:

    ```bash
    rm -rf .next
    pnpm dev
    ```

For more detailed debugging notes, refer to the documents under `docs/` (for example, `docs/troubleshooting.md` and `docs/security-doc.md`).

Once `pnpm dev` runs without errors and the smoke tests above pass, your local EchoJournal environment is ready for development.
