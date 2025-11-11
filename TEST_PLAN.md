# EchoJournal Test Plan

## 1. Goals & Scope
- Validate Modules A (Daily Record pipeline), B (Echos reflections), and C (AI voice companion) described in `docs/project-specs.md` and the module journals under `docs/development-journal/`.
- Cover the Supabase-backed data flows, OpenAI integrations, Clerk-authenticated UI flows, and security measures noted in `docs/security-doc.md`.
- Produce executable guidance for tests that live under `tests/` without touching `src/` during this review phase.

## 2. Architectural Summary (testing perspective)
| Layer | Key Assets | External Dependencies | Notes |
| --- | --- | --- | --- |
| Module A – Daily Record | `DailyMoodModal`, `AudioJournalPanel`, `/api/transcribe`, Supabase queries (`getTodayMoodEntry`, `getJournalsWithSummaries`) | Clerk, Supabase Storage/Postgres, OpenAI Whisper/GPT | Current implementation phase per `project-specs.md`; only Postgres writes are active.
| Module B – Echos | `lib/reflections/*`, `/api/reflections/*`, `EchosBoard` UI | OpenAI GPT-4o-mini, Supabase daily summaries | Structured reflections + editing; background sync triggered by Module A.
| Module C – Voice Companion | `useVoiceAgent`, `voice-agent-panel`, `/api/agent/*`, `lib/agent/context` | OpenAI Realtime, web search tool quota, Supabase context fetch | Push-to-talk UI with tool calling + quota enforcement.
| Shared | `lib/timezone`, `lib/security`, `lib/supabase/*`, `docs/security-doc` controls | Node/Intl APIs | Timezone math and CSRF protection impact every module.

## 3. Testing Priorities
- **P0 (mission critical / high risk)**
  - Module A data capture + `/api/transcribe` contract (costly OpenAI workflow and core journaling value).
  - Module B reflection generation & sync logic (AI output trust + user-facing summaries).
  - Module C realtime voice session state machine + agent tooling (complex external dependencies, quota enforcement).
  - Security helpers: `isTrustedOrigin`, search quota, CSRF + auth boundaries.
- **P1 (important, moderate risk)**
  - Journals listing/filtering (`getJournalsWithSummaries`, dashboard views).
  - Dashboard widgets (Daily mood widget, Echos widget) for state regression.
  - API editing endpoints (`PATCH /api/reflections/*`).
- **P2 (supporting / low risk)**
  - Visual polish components, layout shells, static pages.
  - Non-critical analytics cards and charts.
  - Optional cron-style scripts (not yet implemented per specs).

## 4. Test Type vs Module Matrix
| Module | Unit | Integration | E2E | Contract/API | Property-Based | Fuzz/Security | Performance/Regression | Snapshot |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Module A | `lib/timezone`, `lib/mood-utils`, Supabase query helpers, recorder state reducers | `DailyMoodModal` ↔ Supabase mock, `/api/transcribe` happy/error paths with mocked OpenAI & Storage | Voice capture + mood check-in happy path (Playwright mobile PWA run) | File upload validation, CSRF guard, OpenAI error handling | `getLocalDayRange` vs many timezones/dates (`fast-check`) | CSRF/origin parser, oversized audio, malicious MIME | Measure `/api/transcribe` pipeline budget (< 7s simulated) | Recorder/mood widget micro-copy (typewriter facts) |
| Module B | `getPeriodBounds`, `countEmotions`, schema validators | `generateReflection` with mocked OpenAI + Supabase, `/api/reflections/sync` ↔ DB | Generate day/week/month cards from seeded data, edit flows through UI | `PATCH /api/reflections/daily|period`, `GET /api/reflections/*` pagination | Entry aggregation vs random calendars, ensure bounds stable | Edited-card preservation, rate limits, RLS (negative tests) | Generation duration & token usage budgets | Card layout snapshots for Achievements/Commitments |
| Module C | `search-quota`, hook reducers, instructions builder | `useVoiceAgent` hook with stubbed RealtimeSession + tool execution, `/api/agent/tools/context` data shaping | Push-to-talk session start/end + voice selection (Playwright + mocked OpenAI) | `/api/agent/token`, `/api/agent/tools/context`, `/api/agent/tools/search` (quota) | Tool payload shaping vs random ranges | Origin enforcement, quota exhaustion attempts | Session timer accuracy, connection teardown | Voice panel UI states |
| Shared | `lib/security`, `lib/utils` helpers | Middleware/auth flows via Next test harness | Authenticated nav smoke test | N/A | `isTrustedOrigin` host parsing | Host header fuzz | N/A | Layout |

## 5. Toolchain & Environment
- **Unit/Integration**: `vitest` + `@testing-library/react` (jsdom) + `@testing-library/react`'s `renderHook`, `vi.mock`. Use `happy-dom` for faster Node env tests (Supabase/OpenAI logic) and `jsdom` for UI.
- **API/Contract**: `vitest` (node env) + `supertest` + Next.js `app-router` helpers (`next-test-api-route-handler`). Mock Supabase via `@supabase/supabase-js` typed stubs or `msw/node`.
- **E2E**: Playwright (mobile viewport config matching PWA-first design); seed Supabase via SQL fixture or Supabase CLI branch.
- **Property / fuzz**: `fast-check` for timezone math, custom host parser fuzz harness for `isTrustedOrigin`.
- **Mocking**: `msw` for OpenAI/Supabase HTTP surfaces, in-memory stubs for RealtimeSession, fake `MediaStream` for recorder tests.
- **CI**: GitHub Actions job with matrix (`unit`, `integration`, `contract`, `e2e-smoke`). Cache Playwright browsers. Use Supabase test branch spun up via CLI before contract/e2e steps.

Suggested scripts (to be added later):
```
"test:unit": "vitest run --config tests/vitest.unit.config.ts",
"test:integration": "vitest run --config tests/vitest.integration.config.ts",
"test:contract": "vitest run --config tests/vitest.contract.config.ts",
"test:e2e": "playwright test -c tests/e2e/playwright.config.ts",
"test:coverage": "vitest run --coverage"
```

## 6. Coverage Targets
| Area | Statement | Branch | Notes |
| --- | --- | --- | --- |
| Module A P0 code (timezone, recorder logic, `/api/transcribe`) | ≥ 85% | ≥ 80% | Recorder has multiple states; focus on file validation + Supabase outcomes.
| Module B generators/sync | ≥ 80% | ≥ 75% | AI call paths mocked; ensure edited-field logic + aggregation boundaries.
| Module C hook + quota + agent APIs | ≥ 80% | ≥ 75% | Harder to reach 90% due to WebRTC stubs; keep timer/quota logic covered.
| Security helpers (`isTrustedOrigin`, `search-quota`) | ≥ 90% | ≥ 90% | High confidence required per `docs/security-doc.md`.
| Overall repo | ≥ 75% | ≥ 70% | Allows legacy/UI-only files to stay P2.

## 7. Module Strategies
### Module A – Daily Record & Transcription (P0)
**Objectives**: Guarantee one-entry-per-day mood logic, robust audio upload validation, and smooth recorder UX described in Module A journal.

- **Unit**
  - `lib/timezone`: verify `getLocalDayRange`, `getUtcRangeForDate` with property-based tests over random dates/timezones to prevent off-by-one (critical for mood queries and summary generation).
  - `lib/mood-utils`: deterministic formatting + display data (feed into UI snapshots).
  - Supabase queries (`getTodayMoodEntry`, `getJournalsWithSummaries`): test date filters + caching path using fake clients.
  - `isTrustedOrigin`: host parsing for allowed/malicious URLs.
- **Integration**
  - `DailyMoodModal`: simulate Clerk user, mock Supabase client to return existing/no entry, assert create vs update flows, button states, emitted `moodEntryUpdated` event.
  - `AudioJournalPanel`: drive Record → Pause → Resume → Process states with mocked `navigator.mediaDevices`, `MediaRecorder`, and `fetch('/api/transcribe')` responses (success + error). Assert max duration auto-stop and idle facts rotation.
  - `/api/transcribe`: run through Next route handler using `supertest` + `Blob` fixtures. Mock OpenAI Whisper/GPT + Supabase admin client. Validate: MIME whitelist, >25MB rejection, CSRF enforcement, background summary sync invocation.
- **E2E (Playwright)**
  - Scenario: "First login of the day" → modal auto-opens (no entry). Submit answers, verify widget updates, ensure modal no longer auto-opens same day.
  - Scenario: Record short audio stub via fake microphone (Playwright `browserContext.grantPermissions(['microphone'])`). Confirm success toast + new summary visible in `/dashboard/journals`.
- **Contract/Security**
  - CSRF: Call `/api/transcribe` with mismatched Origin → expect 403.
  - Storage: confirm `audio-files` path built as `journal-audio/<user-id>/<timestamp>.webm` by checking Supabase mock payload.
- **Performance/Regression**
  - Budget test: using mocked OpenAI responses, ensure route completes under 7s (simulate 4-7s expectation). Alert if slower.

### Module B – Echos Reflections (P0)
**Objectives**: Validate aggregation bounds, AI schema enforcement, edited-field preservation, and board UX.

- **Unit**
  - `getPeriodBounds`, `resolveAnchorDate`: exhaustive calendar coverage (week boundaries Monday–Sunday in Australia/Sydney, month edges, DST).
  - `countEmotions`, `sumEntries`: ensure duplicates & ordering behave.
  - `reflectionAISchema`, `patchDailySchema`, `patchPeriodSchema`: invalid payload rejection.
- **Integration**
  - `generateReflection` daily vs weekly: mock OpenAI + aggregator data; assert achievements capped ≤3, keywords ≤8, stats fallback, and `edited` rows skip overwrites (per Module B journal).
  - `/api/reflections/sync`: verify `mode` gating, OpenAI key requirement, and response shape.
  - `/api/reflections/daily|weekly|monthly`: pagination & limit capping.
  - `/api/reflections/daily/:date` + `/api/reflections/period/:id`: ensure trusted-origin enforcement + 404 for missing rows.
  - `EchosBoard`: with mocked `fetch`, step through tabs/mode switching, edit dialog, `isCurrentPeriod` logic.
- **E2E**
  - Flow: After audio submission, background sync creates new daily echo; user navigates to `/dashboard/echos`, sees badges (Edited/In progress), triggers manual refresh.
  - Flow: User edits achievements, ensures subsequent regenerate preserves manual text.
- **Contract/Security**
  - Ensure `PATCH` endpoints reject payloads exceeding list limits or missing fields.
  - Confirm `GET` endpoints respect RLS by using Supabase test branch with two users.
- **Performance**
  - Record generation runtime & token usage (mocked metrics) to detect regressions when prompts change.

### Module C – AI Voice Companion (P0)
**Objectives**: Ensure push-to-talk lifecycle, quota tracking, and tool responses remain reliable per Module C journal/troubleshooting doc.

- **Unit**
  - `search-quota`: new day reset, max 5/day, concurrency safety (simulate multiple increments).
  - `buildVoiceAgentInstructions`: ensures greeting line includes current date + user name when provided.
  - Hook reducer-style updates (state transitions) and timer decrement logic.
- **Integration**
  - `useVoiceAgent`: simulate successful `connect()` by mocking `/api/agent/token`, `RealtimeSession`, `MediaStream`. Assert: status transitions (`idle→connecting→ready`), timer start, `toggleListening` toggles `session.mute`.
  - `/api/agent/tools/context`: run with `scope=today|week|recent|custom`, verifying date math + data inclusion (summaries, mood, reflections) and 422 on missing `range` for `custom`.
  - `/api/agent/tools/search`: quota exhaustion, malformed JSON tolerance, origin enforcement.
  - VoiceAgentPanel: ensures closing dialog disconnects session, button states align with `state.status`.
- **E2E**
  - Flow: Launch floating button, start session, hold push-to-talk for 2 seconds (use Playwright `page.dispatchEvent`). Validate timer countdown + last reply rendering (msw stub for OpenAI audio output).
  - Flow: Hitting daily search limit surfaces error toast.
- **Security/Resilience**
  - Host spoof tests on agent endpoints.
  - Tool payload sanitization (ensuring nulls removed before fetch) via mocked `tool.execute` calls.

### Shared / Cross-cutting
- `lib/timezone` property tests feed Modules A & B.
- `lib/security` fuzz harness.
- Snapshot tests for consistent UI (Daily mood widget, Echos card) using `@testing-library/react` + `expect(container).toMatchSnapshot()` (stored in `tests/__snapshots__`).

## 8. Proposed Directory Layout
```
tests/
  unit/
    moduleA/
      mood-utils.test.ts
      timezone.test.ts
    moduleB/
      reflections-aggregate.test.ts
    moduleC/
      use-voice-agent.test.ts
    shared/
      security-origin.test.ts
  integration/
    moduleA/
      daily-mood-modal.test.tsx
      transcribe-route.test.ts
    moduleB/
      generate-reflection.test.ts
      reflections-api.test.ts
    moduleC/
      agent-context-tool.test.ts
  contracts/
    transcribe-contract.test.ts
    reflections-contract.test.ts
    agent-search-contract.test.ts
  e2e/
    playwright.config.ts
    moduleA/daily-checkin.spec.ts
    moduleB/echos-flow.spec.ts
    moduleC/voice-agent.spec.ts
  fuzz/
    security/origin-host.fuzz.ts
    timezone/day-range.fuzz.ts
  fixtures/
    supabase/
      seed.sql
    audio/
      sample-good.webm
      sample-too-large.webm
```
Directories mirror `src/features/*` to keep mapping obvious.

## 9. Execution & Milestones
1. **Milestone 1 – Foundations (P0 focus, 3–4 days)**
   - Land unit tests for timezone, mood utils, search quota, origin helper.
   - Add integration tests for `/api/transcribe` (mocked OpenAI) and `generateReflection` daily path.
   - Deliver contract suite for agent + reflections endpoints.
2. **Milestone 2 – UI & Hook coverage (2–3 days)**
   - Component tests (`DailyMoodModal`, `EchosBoard`, `VoiceAgentPanel`).
   - Hook tests (`useVoiceAgent`). Snapshot tests for widgets.
3. **Milestone 3 – E2E smoke + property/fuzz (2 days)**
   - Playwright flows for Modules A–C.
   - fast-check + fuzz harnesses for timezone/origin parsing.
4. **Milestone 4 – Performance & coverage polish (1–2 days)**
   - Runtime budget assertions, coverage gates, CI stabilization.

CI gating order: `test:unit` → `test:integration` → `test:contract` (parallelizable) → `test:e2e` (nightly or gated on release branch).

## 10. Testability Improvement Suggestions
- **Dependency injection hooks**: Allow `AudioJournalPanel` to receive optional `mediaDevices` and `fetch` overrides via props/context, simplifying recorder tests.
- **Configurable OpenAI clients**: Export factory functions from `lib/openai` so tests can swap in fake clients without `vi.spyOn` deep internals.
- **Supabase client wrappers**: Accept client as argument in hooks (e.g., `useTodayMood`) or expose test factories to avoid patching module scope singletons.
- **Telemetry toggles**: Provide feature flags to disable typewriter animation timers during tests to prevent flakiness.
- **Rate limit state exposure**: Surface search quota counters via debug endpoint to assert behaviour without reaching into module scope map.

Following approval, we will implement the planned suites under `tests/` using the sample files included in this submission.
