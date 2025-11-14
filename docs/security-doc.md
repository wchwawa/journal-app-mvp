# Security Hardening Notes

This document is intended for security reviews and academic reporting. It records the key hardening measures implemented in the EchoJournal WebApp after 2025‑11‑11. Each section follows the structure: **threat background → rationale for change → concrete implementation → verification**, so future reviewers can reproduce, evaluate, or extend the work. Unless otherwise noted, paths are relative to the repository root.

---

## 1. Attack Surface & Change Overview

| Risk Category | Primary Assets | Change Location | Protection Point | Why It Matters (Impact / Likelihood) |
| --- | --- | --- | --- | --- |
| Data-layer authorization (Row-Level Security) | Supabase `audio_files`, `transcripts`, `daily_summaries`, `period_reflections` | Supabase RLS policies (see §2) | Require `user_id = auth.uid()` for all queries/writes | Each audio/transcript row contains sensitive data; if another tenant can read it, the leak is irreversible. Without RLS, anyone with the anon key can scan full tables. |
| CSRF (Cross-Site Request Forgery) | All write endpoints (Journal/NLP/Agent) | `src/lib/security.ts` + each `route.ts` | Check `Origin` / `Referer` against `Host`; mismatch → 403 | Clerk uses cookies for sessions; because browsers send cookies automatically, CSRF is a high‑probability threat. Attackers can forge requests from third‑party pages to alter mood/audio data. |
| Unconstrained file upload | `/api/transcribe` | `src/app/api/transcribe/route.ts` | 25MB size cap, audio MIME whitelist, unified error responses | Whisper/GPT calls are expensive and slow; invalid files waste tokens and can trigger errors. Large or arbitrary payloads could be used to bypass storage policy or exhaust resources. |
| Logging/observability privacy leaks | API logs, Sentry | `src/app/api/*`, `src/instrumentation*.ts` | Only log lengths/aggregates; Sentry `beforeSend` redacts payload and disables Replay in PROD | EchoJournal stores psychological/health information; any raw logs containing content violate privacy requirements and are hard to audit. Once leaked, damage is irreversible. |
| Auth bypass misuse | Next.js middleware | `src/middleware.ts`, `env.example.txt`, `docs/troubleshooting.md` | Add `DEV_DISABLE_AUTH` (server-only, dev‑only) | The old `NEXT_PUBLIC_DISABLE_ALL_AUTH` was public; if accidentally set in production `.env`, the entire site became unauthenticated. CI/CD complexity makes this realistically likely. |
| Supply-chain drift | OpenAI Realtime SDK | `package.json`, `pnpm-lock.yaml` | Pin `@openai/agents` at 0.3.0 | The realtime module depends on experimental SDKs; unsupervised upgrades can break the frontend instantly. |
| Resource abuse / cost-based DoS | Whisper + GPT calls | Planned (§8) | Design userId+IP token‑bucket rate limits | Transcription is billed per minute; repeated retries can exhaust budget or overload the backend. Without limits, a single user can unintentionally or maliciously cause a cost-based DoS. |

---

## 2. Supabase Row-Level Security (RLS)

### 2.1 Threat background
EchoJournal is a multi‑tenant privacy‑sensitive product: users upload voice notes and generate NLP summaries. Without strong isolation at the database layer, a single anon API key is enough for an attacker to `SELECT` all rows. The API layer is protected by Clerk, but any server‑side bug or mis‑scoped query could still leak data. RLS enforces “each user can only see their own rows” directly at the database level and is essential for GDPR/CCPA “least privilege” and “minimal accessible dataset” requirements.

### 2.2 Current strategy
Core Supabase tables have RLS enabled with policies equivalent to:

```sql
alter table public.audio_files enable row level security;

create policy "Audio owners can CRUD" on public.audio_files
  for all
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);
```

The same pattern applies to:
- `public.transcripts` (constrained by both `user_id` and `audio_id`)
- `public.daily_summaries`
- `public.period_reflections`

As of the 2025‑11‑11 Supabase MCP check, RLS status for core tables is:

| Table | RLS Status | Notes / Access Pattern |
| --- | --- | --- |
| `audio_files` | ✅ Enabled | Only the owner can read/write. All playback/queries go through the server‑side API (`/api/audio/[id]`) using the service role. |
| `transcripts` | ✅ Enabled | Only the owner can read/write; depends on audio foreign key. Transcription is generated in `/api/transcribe`; the client never talks to this table directly. |
| `daily_summaries` | ✅ Enabled | Daily summary/card data; the browser fetches it via server‑side endpoints like `/api/journals/list`. |
| `period_reflections` | ✅ Enabled | Weekly/monthly cards; all CRUD is done via `/api/reflections/*`. |
| `daily_question` | ⛔ Disabled | Still written by the client directly (lower‑risk table). RLS will be enabled once writes are fully routed through server APIs. |

### 2.3 Code collaboration
- The frontend only uses the anon Supabase client (`src/lib/supabase/client.ts`), which can access at most the current user’s rows, even if tampered with.
- Server APIs that need batch operations use `createAdminClient` (`src/lib/supabase/admin.ts`) and then re‑validate `userId` in the business logic to achieve “least privilege + second‑layer checks”.

### 2.4 Verification
- Run `supabase mcp list_tables` and confirm all core tables have `rls_enabled: true`.
- In an anonymous context, `select * from daily_summaries` should only return rows for the current user; attempts to insert another `user_id` should fail.

### 2.5 Recorded security gap (2025‑11‑11)
- **Context**: Dashboard Journals originally queried `daily_summaries`/`transcripts` directly from the browser using the anon Supabase client. After RLS was enabled, these unauthenticated calls were filtered down to empty results, and the team temporarily disabled RLS to restore the view.
- **Fix**: Introduced `/api/journals/list` (`src/app/api/journals/list/route.ts`) so all list queries now execute on the server with the service role + Clerk identity checks. The frontend `JournalListPage` only talks to this API, allowing RLS to remain enabled permanently.
- **Takeaway**: Any future feature that reads RLS‑protected data must go through a trusted API or Server Action instead of exposing anon Supabase queries directly.

---

## 3. CSRF Protection (Host/Origin validation)

### 3.1 Implementation
- Added `src/lib/security.ts`: `isTrustedOrigin(request)` treats `request.headers.host` as the expected origin, first comparing against `Origin`, and falling back to `Referer` if `Origin` is missing. If both headers are absent (e.g. server‑to‑server calls), the request is allowed.
- All write endpoints (Transcribe, Generate Summary, Journals PUT/DELETE, Reflections CRUD, Agent Tools POST) call this helper before doing any work. If validation fails, they immediately return `NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })`.

### 3.2 Why it’s necessary
- Voice journaling relies on cookie‑based sessions; browsers automatically attach cookies. An attacker can embed `<form action="https://echojournal.com/api/transcribe">` on a third‑party site and trick users into uploading malicious audio or deleting entries.
- Origin checking is the most reliable browser‑level CSRF defense, does not require extra tokens, and fits naturally with the Clerk + Next.js architecture.

### 3.3 Verification
Call `curl -H "Origin:https://evil.com" -X POST https://.../api/transcribe` and verify that it returns 403 and logs a rejected request.

---

## 4. Voice upload validation

### 4.1 Implementation
- `src/app/api/transcribe/route.ts`:
  1. Size limit: if `audioFile.size > 25MB`, return 400.
  2. MIME whitelist: `Set(['audio/webm','audio/wav','audio/x-wav','audio/wave','audio/mpeg','audio/mp3','audio/ogg'])`; missing or unsupported types → 400.
  3. Logs only record filename, size, and character counts, never raw text or lyrics.
  4. Only after these checks do we call Whisper/GPT; on success we trigger daily summary and Echos sync asynchronously (business semantics preserved).

### 4.2 Value
- Avoids confusing errors when users upload `.txt` / `.zip` files, reducing support burden.
- Prevents abuse via oversized files that fill Storage or trigger repeated OpenAI errors, which would push costs out of control.

### 4.3 Verification
Run `curl -F "audio=@/tmp/1.txt;type=text/plain" https://.../api/transcribe` and confirm a 400 `Unsupported audio format` response.

---

## 5. Log & monitoring redaction

### 5.1 API layer
- `src/app/api/transcribe/route.ts` & `src/app/api/generate-daily-summary/route.ts`:
  - Removed logging of raw segments such as `transcription.substring(0, 100)`.
  - Only log aggregate information: row counts, character lengths, and internal user IDs (no PII).

### 5.2 Sentry
- `src/instrumentation.ts`:
  - `sendDefaultPii = process.env.NODE_ENV !== 'production'`, disabling PII in production.
  - `beforeSend` strips Authorization headers, cookies, and `request.data`.
- `src/instrumentation-client.ts`:
  - Disables Replay in production (`replaysSessionSampleRate = 0`).
  - Uses a matching `beforeSend` implementation so frontend errors cannot leak tokens either.

### 5.3 Why it’s worth it
- If voice or mental‑health data ends up in logs, we effectively create an unencrypted data lake; even without an external attacker this violates privacy regulations.
- Sentry Replay in production captures real user input and sends it to a third party; the privacy risk is higher than the debugging value for this product.

### 5.4 Verification
- Trigger errors in the dev environment and confirm in Sentry that headers/body fields are redacted; in prod configuration, verify that Replay events are not created.

---

## 6. Auth bypass (development only)

- `src/middleware.ts`: only when `NODE_ENV === 'development'` **and** `process.env.DEV_DISABLE_AUTH === 'true'` will the middleware skip `auth.protect()`.
- `env.example.txt` & `docs/troubleshooting.md` include usage guidance that explicitly warns not to set this flag in production.

### Value
The previous `NEXT_PUBLIC_DISABLE_ALL_AUTH` was a public variable; any leaked deployment script or log could be abused to disable auth in production. The new approach narrows the bypass strictly to local development and requires a server‑side env var, greatly reducing the risk of accidental exposure.

---

## 7. Dependency version pinning

- `package.json`: `"@openai/agents": "0.3.0"`.
- `pnpm-lock.yaml`: lockfile ensures `pnpm install` does not pull newer breaking versions.

### Value
The Realtime Agent SDK evolves quickly and is not guaranteed to be backward compatible; we have already seen `session.voice` changes cause API errors. Pinning versions prevents sudden production breakage and forces upgrades to be explicit, tested decisions.

---

## 8. Rate limiting (planned control)

Although rate limiting is not yet implemented in code, we have defined its necessity and design so it can be added in the next phase:

1. **Threat model**: Unlimited calls to `/api/transcribe` or `/api/generate-daily-summary` can burn Whisper/GPT tokens, enabling a cost‑based DoS. Repeated triggers could also exhaust the Supabase connection pool.
2. **Target strategy**:
   - Limit based on `userId` + `IP` using a sliding window or token bucket (for example, 60 transcriptions per hour).
   - When thresholds are hit, respond with 429 and show a clear error in the frontend, guiding users to retry later or move to a higher quota.
   - Implementation can live in Next.js Middleware backed by KV/Redis, or in a Supabase Edge Function acting as a proxy.
3. **Academic relevance**: Rate limiting is not only an engineering tool but also a mechanism for resource fairness and security isolation; it enables quantitative analysis of cost/security trade‑offs.

---

## 9. Verification checklist

1. **RLS**: In an anon Supabase client, `select * from daily_summaries` returns only rows for the current session user; inserting rows with a different `user_id` is rejected.
2. **CSRF**: Any write endpoint called with a forged `Origin` returns 403.
3. **Upload validation**: Uploading a non‑audio file returns 400 `Unsupported audio format`.
4. **Log redaction**: Cloud logs and Sentry events contain no raw transcript text or Authorization headers.
5. **Auth bypass**: With `DEV_DISABLE_AUTH=true` set in dev, pages and APIs are accessible without login; removing it requires login again. Production is always protected.
6. **Version pinning**: After `pnpm install`, `pnpm list @openai/agents` still reports 0.3.0.
7. **Rate limiting (once implemented)**: Scripts that exceed the call threshold receive 429 responses and no new OpenAI requests are triggered in the backend.

---

## 10. Next steps

1. **Implement rate limiting**: Start with `/api/transcribe` using the design in §8, and document thresholds and alerting rules.
2. **Automate CSRF protection**: Consider refactoring `isTrustedOrigin` into shared middleware so new APIs automatically inherit protection.
3. **Finer‑grained Sentry redaction**: Filter `request.body` at the field level (for example, redact `summary`, `mood_reason`, etc.) and keep only lengths/hashes.
4. **RLS audits**: Regularly run scripts to confirm all new tables ship with RLS enabled by default, and record the results in this file.

When adding new security measures, continue to use the structure “threat → rationale → implementation → verification” to keep changes traceable and measurable.***
