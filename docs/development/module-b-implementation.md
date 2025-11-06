# Module B Implementation Guide — Echos

> **Status (2025-11-05)** — 轻量版 MVP 已上线：数据库 schema、生成器、API、前端体验、每日摘要自动触发链路均已落地。性能优化、视觉动效与更细的异常处理待下一阶段集中处理。

## Overview

Module B (Echos) provides AI-powered, structured reflections over three fixed periods — Day, Week, and Month — using existing data from Module A (Daily Summaries and Mood Check-ins). Output per card includes:

- Achievements (≤ 3)
- Commitments (≤ 3)
- Mood (overall + reason)
- Flashback (short, single-line hook)
- Optional stats (entryCount, emotion distribution, keywords)

Design principles:

- Trigger → Feedback (explicit, user-driven). No background cron or bulk recomputation.
- Near‑real‑time updates for “in‑progress” periods (current week and current month).
- Visual-first PWA experience with centered card and swipe navigation.
- Strict, structured output (stable JSON shape) with validation and graceful fallbacks.

Out of scope for MVP:

- Yearly reflections; arbitrary custom date ranges; background job scheduling.


## Scope & Constraints

- Periods: Day (up to last 30 days), Week (up to last 12 weeks), Month (up to last 12 months).
- Only the current week and current month auto-refresh after new daily content is generated; historical periods remain stable unless historical data is changed.
- Each day allows at most one successful “self-reflection sync” (to control cost and user expectations).
- PWA-first UI: one centered card; left/right swipe to adjacent cards in order.


## Data Model

We extend existing daily_summaries for day-level reflections, and add a new table for week/month reflections. An optional generation_runs table can be introduced later for fine-grained rate limiting, but MVP can rely on last_generated_at semantics.

### Extend daily_summaries (Day-level reflections)

New columns (all nullable for backward compatibility):

- achievements TEXT[] DEFAULT '{}'
- commitments TEXT[] DEFAULT '{}'
- mood_overall TEXT
- mood_reason TEXT
- flashback TEXT
- stats JSONB
- edited BOOLEAN DEFAULT false
- gen_version TEXT
- last_generated_at TIMESTAMPTZ

Rationale: reuse the canonical daily row as the storage for structured daily reflection; avoid splitting day data across tables.

### New table: period_reflections (Week/Month cards)

- id UUID PRIMARY KEY DEFAULT gen_random_uuid()
- user_id TEXT NOT NULL
- period_type TEXT CHECK (period_type IN ('weekly','monthly')) NOT NULL
- period_start DATE NOT NULL
- period_end DATE NOT NULL
- achievements TEXT[] DEFAULT '{}'
- commitments TEXT[] DEFAULT '{}'
- mood_overall TEXT
- mood_reason TEXT
- flashback TEXT
- stats JSONB
- edited BOOLEAN DEFAULT false
- gen_version TEXT
- last_generated_at TIMESTAMPTZ
- created_at TIMESTAMPTZ DEFAULT now()
- updated_at TIMESTAMPTZ DEFAULT now()
- UNIQUE(user_id, period_type, period_start)

Row Level Security (RLS): mirror existing policies — only the owner can read/write their reflections. Service role (server-side) is used for generation.

### Optional: generation_runs (not required for MVP)

For robust rate limiting and idempotency later:

- id UUID PRIMARY KEY DEFAULT gen_random_uuid()
- user_id TEXT NOT NULL
- run_date DATE NOT NULL
- kind TEXT NOT NULL -- e.g., 'self_reflection'
- status TEXT NOT NULL -- e.g., 'success' | 'failed'
- created_at TIMESTAMPTZ DEFAULT now()
- UNIQUE(user_id, run_date, kind)


## API Spec (MVP)

All endpoints require Clerk authentication. Server-side write operations use Supabase service role (admin client) and RLS-protected tables.

### POST /api/reflections/sync

Triggers on-demand generation for the specified period anchored to today (or an optional anchor date).

- Request body: { mode: 'daily' | 'weekly' | 'monthly', anchorDate?: 'YYYY-MM-DD' }
- Behavior:
  - daily: upsert structured fields into daily_summaries for the anchorDate (default: today). Enforce “one success per day”.
  - weekly/monthly: upsert into period_reflections only for the current week/month (or the week/month containing anchorDate). Historical periods are not recomputed.
- Response: normalized card JSON with achievements, commitments, mood, flashback, stats, timestamps.

### GET /api/reflections/daily?start=YYYY-MM-DD&limit=30

Returns up to `limit` day cards starting from `start` going backwards in time. Used for swipe prefetch.

### GET /api/reflections/weekly?limit=12

Returns the most recent N week cards (including the in‑progress week card), ordered descending by period_start.

### GET /api/reflections/monthly?limit=12

Returns the most recent N month cards (including the in‑progress month card), ordered descending by period_start.

### PATCH /api/reflections/daily/:date

Allows light editing of daily card’s achievements, commitments, mood_reason, or flashback; sets edited=true.

### PATCH /api/reflections/period/:id

Allows light editing of a week/month card; sets edited=true.


## Generator Architecture

### Aggregation

- Day window: that specific date. Sources: daily_summaries.summary (primary), daily_question (day_quality, emotions), transcripts.rephrased_text snippets if needed.
- Week window: ISO week [Mon..Sun] of anchorDate. Merge daily_summaries + mood data across the window.
- Month window: calendar month of anchorDate. Merge daily_summaries + mood data across the month.
- Input pruning: concise context to control tokens (e.g., cap total daily summary characters, keep top entries by simple heuristics).

### AI & Schema

- Model: GPT‑4o‑mini or equivalent cost‑effective model.
- Output: strictly structured JSON (achievements ≤3, commitments ≤3, mood_overall enum, mood_reason ≤120 chars, flashback ≤120 chars, stats optional with entryCount/topEmotions/keywords).
- Validation: zod (or equivalent) on server side; reject/repair strategies if schema fails.

### Idempotency & Edits

- If edited=true on an existing card, do not overwrite edited fields on regeneration; either update only non-edited fields or require explicit “override edits”.
- For daily, enforce at-most-one successful generation per calendar day.

### Fallbacks

- If AI fails or times out, generate a minimal card from heuristics over daily_summaries.summary and mood distributions so the UI never shows an empty card.


## Triggers & Consistency

- Daily flow: after the user creates today’s content and daily summary is saved (existing A1/A2 pipeline), the app triggers daily reflection generation. Upon success, immediately refresh the “current week” and “current month” cards only.
- Weekly/Monthly views: when user navigates to these tabs, if the in‑progress card is stale (e.g., last_generated_at older than 1 hour), auto‑refresh; otherwise use stored results. Always provide a manual “Refresh” action.
- Historical week/month cards remain stable unless historical daily data was changed (then selectively regenerate impacted periods).


## Frontend UX

### Page: /dashboard/achievements

- Segmented control: Day | Week | Month (default: Day).
- Centered card: single card view optimized for mobile PWA; left/right swipe to previous/next.
- Prefetch: load ±1–2 adjacent cards for smooth swiping.
- Actions:
  - Generate (if not generated today)
  - Refresh (for week/month in‑progress card)
  - Edit (light editing; sets edited=true)
- Visual cues:
  - In‑progress badge for current week/month
  - last_generated_at timestamp
  - Edited badge
  - Minimal charts/tags for mood (can be iterated later)


## User Stories

- As a user, after journaling today, I can generate today’s reflection card within a few seconds; my current week and month cards are also updated.
- As a user, I can swipe left/right to browse up to 30 daily cards; if I reach a day without a card, I can generate it on demand.
- As a user, in Week/Month views I see up to 12 cards including the current in‑progress card; I can refresh the in‑progress card to include new content.
- As a user, I can lightly edit commitments/reasons without losing them on future regenerations.


## Functional Details

### Updates (2025‑11‑06)

1) Non‑blocking generation
- 音频保存成功后，录音接口不再同步等待“日总结 + Echos 同步”。二者在后台顺序执行，前端更快得到成功反馈。
- 参考：src/app/api/transcribe/route.ts
```ts
// kick off in background (non-blocking)
(async () => {
  const summaryData = await generateDailySummary(userId, supabase, openai);
  if (summaryData?.date) {
    await syncReflectionsForDate({ supabase, openai, userId, anchorDate: summaryData.date });
  }
})();
```
- 手动生成日总结接口也改为“同步返回 summary，Echos 同步后台触发”。

2) 周/月周期边界改为“本地时区日界”
- 修复原来 UTC 导致“11 月内容显示成 10 月卡片”的问题。
- 参考：src/lib/reflections/aggregate.ts
```ts
// local YYYY-MM-DD
export const localYmd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

export const getPeriodBounds = (mode, anchorDate) => {
  const date = new Date(anchorDate);
  if (mode === 'weekly') {
    const dow = date.getDay();               // 0..6 local
    const diffToMonday = dow === 0 ? -6 : 1 - dow;
    const monday = addDays(new Date(date), diffToMonday);
    const sunday = addDays(new Date(monday), 6);
    return { start: localYmd(monday), end: localYmd(sunday) };
  }
  const start = startOfMonth(date), end = endOfMonth(date);
  return { start: localYmd(start), end: localYmd(end) };
};
```

3) 模型 JSON 解析与超限裁剪
- 兼容 content 为空/分片数组，parse 前先拼接文本；对超限字段软裁剪再做 zod 校验，避免 ZodError。
- 参考：src/lib/reflections/generator.ts
```ts
const raw = completion.choices[0]?.message?.content as any;
const text = Array.isArray(raw) ? raw.map(c => c?.text ?? '').join('') : (raw ?? '');
const obj = JSON.parse(text || '{}');
if (Array.isArray(obj.achievements)) obj.achievements = obj.achievements.slice(0,3);
if (Array.isArray(obj.commitments)) obj.commitments = obj.commitments.slice(0,3);
if (obj.stats && Array.isArray(obj.stats.keywords)) obj.stats.keywords = obj.stats.keywords.slice(0,8);
const parsed = reflectionAISchema.parse(obj);
```

4) 刷新锚点逻辑优化
- 在 Echos 页（Week/Month）点击“Refresh current period”时，如果顶部卡片不是“进行中”，则以内“今天”为锚点生成当期卡，避免继续刷新历史月份。
- 参考：src/features/echos/components/echos-board.tsx
```ts
const todayISO = new Date().toISOString().split('T')[0];
const effectiveAnchor = mode === 'daily'
  ? (anchorDate ?? todayISO)
  : (activeCard && isCurrentPeriod(activeCard) ? activeCard.period.start : todayISO);
await fetch('/api/reflections/sync', { body: JSON.stringify({ mode, anchorDate: effectiveAnchor }) });
```

5) 历史错误数据清理
- 由于早期 UTC 边界问题，period_reflections 中可能存在“10/31 开头”的月卡但包含 11 月内容。建议按 Troubleshooting 文档的 Recovery Steps 进行只读核对与精确删除，再刷新生成当期卡。

### Period Windows & Timezone

- Use LOCAL timezone boundaries for week/month aggregation. Week = Monday..Sunday; Month = calendar month. Persist dates as local YYYY-MM-DD.

### Daily Card Generation

1) Aggregate today’s daily_summaries and mood data.
2) Build compact prompt context with pruning.
3) Call AI; validate JSON; apply edit‑preserving merge.
4) Upsert into daily_summaries; set last_generated_at, gen_version.
5) Trigger current week & month regeneration (sequentially) and return the daily card.

### Weekly/Monthly Generation

1) Compute period_start/period_end (ISO week or calendar month).
2) Aggregate daily summaries/mood across the window.
3) Call AI; validate; preserve edits.
4) Upsert into period_reflections with UNIQUE(user_id, period_type, period_start).

### Editing Rules

- Fields editable: achievements (items can be tweaked), commitments, mood_reason, flashback.
- edited=true guards against blind overwrite; regeneration should either not touch edited fields or prompt to override.

### Error Handling

- Schema validation failure → attempt repair; if unrecoverable, fallback minimal card.
- OpenAI errors/quota → show actionable error state; allow retry; fallback minimal card.
- Supabase errors → log via Sentry and expose safe message.


## API Shapes (Examples)

### Response card (normalized)

```json
{
  "period": {
    "type": "daily",
    "date": "2025-11-03",
    "start": "2025-11-03",
    "end": "2025-11-03"
  },
  "achievements": ["Finished my assignments"],
  "commitments": ["Prepare slides for Friday"],
  "mood": { "overall": "happy", "reason": "Got an internship offer" },
  "flashback": "A breakthrough that boosted my confidence.",
  "stats": { "entryCount": 3, "topEmotions": ["happy"], "keywords": ["offer","assignment"] },
  "edited": false,
  "lastGeneratedAt": "2025-11-03T10:25:00Z",
  "genVersion": "v1"
}
```


## Testing & Acceptance

- Acceptance criteria (MVP):
  - Generate a daily card within 2–5s; current week and month update as well.
  - Day view swipes through up to 30 cards; missing card can be generated on demand.
  - Week/Month views list up to 12 cards including the in‑progress one; refresh works and respects edits.
  - Fallback cards appear if AI fails; no blank states.

- Tests to cover:
  - Period window calculations (day/week/month) and timezone behavior.
  - JSON validation + fallback path.
  - Edit‑preserving merges.
  - Idempotent upserts and UNIQUE constraint handling.


## Observability & Costs

- Sentry logging for AI errors, schema mismatches, DB conflicts.
- Latency budget: 2–5s per generation (shorter for day; week/month can be slightly higher).
- Cost control: rely primarily on daily_summaries.summary; prune inputs; cache/store results; only compute current week/month automatically.


## Implementation Plan (6‑hour MVP)

1) Types & Queries (30m)
   - Add optional fields to daily_summaries TS types.
   - Define types for period_reflections (TS placeholder until DB migration).

2) Generator & Sync Endpoint (75m)
   - `lib/reflections/schema.ts` (zod) and `lib/reflections/generator.ts` (aggregate → AI → validate → persist).
   - POST `/api/reflections/sync` for daily/weekly/monthly.

3) List Endpoints (45m)
   - GET `/api/reflections/daily|weekly|monthly` with pagination/limits.
   - PATCH editing for daily or period.

4) UI Page & Card (90m)
   - `/dashboard/achievements` page, segmented control, centered swipe card, loading/error states, Generate/Refresh actions.

5) Wire Up Daily Flow (30m)
   - After daily summary success (existing pipeline), call sync for current week/month.

6) Polish & Fallbacks (60m)
   - Schema repair attempts, clear user messaging, Sentry breadcrumbs, basic visual tags for mood/state.


## Future Enhancements

- Versioned prompts and side‑by‑side diff of regenerated cards.
- Rich visualizations (rose/pie charts for emotions, heatmaps for day_quality).
- Fine‑grained rate limiting via generation_runs.
- Multi‑language support; export/share; agent integration.


## Design Notes — Reasoning, Decisions, and Critical Thinking

This section documents the rationale behind Module B’s design choices, including constraints, trade‑offs, and how we arrived at a stable, demo‑ready plan in a short timeline.

1) Trigger model (no cron, no bulk recompute)
   - Problem: Scheduled jobs increase infra complexity, open attack surface, incur silent costs, and confuse users (“why did my data change?”).
   - Decision: Trigger → Feedback. Users explicitly initiate, or the app triggers as an immediate consequence of an explicit action (e.g., finishing today’s journal).
   - Trade‑off: Might miss background freshness for long inactivity; accepted for clarity, cost, and demo reliability.

2) Period scope (Day/Week/Month only)
   - Problem: Arbitrary date ranges multiply states, validation paths, and error possibilities.
   - Decision: Fixed periods (no yearly, no custom ranges). Day limited to last 30; week/month limited to last 12. Predictable data windows simplify UX and testing.
   - Trade‑off: Less flexibility; accepted to reduce complexity and ensure stability within the deadline.

3) In‑progress period consistency
   - Problem: Users expect week/month cards to reflect new content before the period ends.
   - Decision: Automatically regenerate only the current week and current month whenever today’s card is generated; allow manual refresh on those tabs and subtle auto‑refresh if stale.
   - Trade‑off: Slight extra cost (max 2 more cards). Bounds are tight and predictable, so cost is controlled.

4) Data model choices
   - Problem: Split vs. extend. Day reflections can live with daily summaries; week/month need aggregation persistence.
   - Decision: Extend daily_summaries for daily; add period_reflections for weekly/monthly with UNIQUE constraints and RLS. Optional generation_runs is deferred to keep MVP simple.
   - Trade‑off: Two storage locations; mitigated with clear query helpers and consistent card shapes.

5) Structured output reliability
   - Problem: LLM JSON drift can break the pipeline.
   - Decision: Strict schema (zod) + repair attempts; keep outputs short, enumerated, capped; fallback heuristics to ensure no blank UI.
   - Trade‑off: Slight engineering effort to validate/repair, but critical for demo stability.

6) UX form factor (PWA‑first)
   - Problem: Dense lists clash with mobile; cognitive load.
   - Decision: Centered single card, swipe navigation, minimal visual cues, and explicit Generate/Refresh CTA. Visual‑first over text‑heavy.
   - Trade‑off: Card‑by‑card navigation vs. bulk overview; acceptable for the “personal reflection” use case.

7) Delivery under time constraint
   - Problem: Two‑week project with a 6‑hour MVP session.
   - Decision: Build the shortest end‑to‑end path: daily generation → edit‑preserving upsert → auto current week/month → basic page + swipe. Defer advanced charts, rate‑limit tables, and full i18n.
   - Trade‑off: Some features ship later, but the core user value is demonstrable and defensible in the report.

Overall, this design optimizes for clarity, control, cost, and demo readiness while keeping future evolution straightforward (period tables, versioning, richer viz, agent tie‑in). It directly addresses the requirement that new important information should immediately reflect in the ongoing week/month, without introducing background complexity or user confusion.
