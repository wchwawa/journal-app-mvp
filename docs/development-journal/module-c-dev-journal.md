# Module C Development Journal

## 1. Overview
- **Module**: Voice-native AI Companion (Echo)
- **Goal**: Provide a Siri-like voice experience where the user can tap the floating button to talk to Echo, and Echo can read structured journal data to provide emotional support.
- **Scope**: Ephemeral token issuance, WebRTC Realtime sessions, tool calls (`fetch_user_context`, `web_search`), and the push‑to‑talk UI.

## 2. Architecture & Flow
### 2.1 Component Stack
| Layer | Location | Notes |
| --- | --- | --- |
| API (token) | `src/app/api/agent/token/route.ts` | Uses the OpenAI SDK to create a Realtime session and returns an `ek_...` ephemeral client secret. |
| API (tools) | `src/app/api/agent/tools/{context,search}` | Concrete implementations of Echo’s function tools. |
| Hook | `src/hooks/use-voice-agent.ts` | Manages the `RealtimeSession`, push‑to‑talk state, and tool registration. |
| UI | `src/components/agent/*` | Floating “Echo” entrypoint and control panel that is visible across the app. |

### 2.2 Data & Tools
- **Structured data** comes from Supabase: `daily_summaries`, `daily_question`, and `period_reflections`.
- **Tools**:
  - `fetch_user_context` → `/api/agent/tools/context` → `fetchUserContext()` to retrieve summaries, mood, and reflections.
  - `web_search` → `/api/agent/tools/search` → OpenAI Responses with the `web_search` tool, with a daily quota of 5 calls.

### 2.3 Interaction Flow
1. The UI opens the panel → `connect()` requests `/api/agent/token?voice=<id>`.
2. The backend calls `openai.beta.realtime.sessions.create({ model })` and returns `session.client_secret.value`.
3. The frontend creates a `RealtimeAgent` + `RealtimeSession`, then calls `connect({ apiKey: token, url: https://api.openai.com/v1/realtime?model=... })`.
4. Echo issues a `tool_call` → the frontend executes `fetch` → returns the result → the SDK continues the conversation automatically.
5. Push‑to‑talk toggles recording via `session.mute`, and a 10‑minute guard timer disconnects the session when it expires.

## 3. Implementation Highlights
### 3.1 Ephemeral token & auth
```ts
// src/app/api/agent/token/route.ts
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const session = await openai.beta.realtime.sessions.create({ model: REALTIME_MODEL });
return NextResponse.json({ token: session.client_secret.value, model: REALTIME_MODEL, voice: voiceProfile.voice });
```
- Keep the request body minimal and only send `model`.
- The `voice` in the token response is for UI display only; the effective voice is set by `RealtimeAgent`.

### 3.2 Realtime Hook
```ts
const contextTool = tool({
  name: 'fetch_user_context',
  parameters: z.object({
    scope: z.enum(['today','week','month','recent','custom']).default('recent'),
    anchorDate: z.string().nullable().optional(),
    limit: z.number().nullable().optional(),
    range: z.object({ start: z.string(), end: z.string() }).nullable().optional()
  }),
  execute: async (input) => {
    const payload = { ...input };
    if (payload.anchorDate == null) delete payload.anchorDate;
    if (payload.limit == null) delete payload.limit;
    if (payload.range == null) delete payload.range;
    return await fetch('/api/agent/tools/context', { ...body: JSON.stringify(payload) }).then((r) => r.json());
  }
});

const agent = new RealtimeAgent({
  name: 'Echo',
  voice: selectedProfile.voice,
  instructions: buildVoiceAgentInstructions(),
  tools: [contextTool, searchTool]
});

const session = new RealtimeSession(agent, { transport: 'webrtc', model });
await session.connect({
  apiKey: token,
  url: `https://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`
});
```
- After downgrading to the older SDK, we must explicitly set `url`; otherwise the client may hit the default `/v1/realtime/calls` endpoint and fail to parse the SDP.
- Push‑to‑talk is controlled via `session.mute(true/false)`, and `session.on('audio_start'|'audio_stopped')` is used to keep the UI in sync.

### 3.3 Tool endpoints
- `/api/agent/tools/context` calls `fetchUserContext()` and returns summaries/mood/reflections.
- `/api/agent/tools/search` calls `openai.responses.create({ tools: [{ type: 'web_search' }] })` with a per‑day quota enforced in `search-quota.ts`.
- Both endpoints use Clerk auth plus the Supabase admin client, and are always scoped to the current user.

## 4. Debug Log & Lessons Learned
| Issue | Cause | Fix |
| --- | --- | --- |
| `Unknown parameter: 'session.voice'` / `'model'` | Called the `client_secrets` endpoint directly and sent unsupported fields. | Switch to `sessions.create({ model })` via the SDK and only send `model`. |
| `Unknown parameter: 'session.type'` | `@openai/agents-realtime@0.3.x` included deprecated fields in the `session.update` payload. | Pin `@openai/agents(-realtime)` and `openai` to 0.0.10 / 5.8.2 to match the sample. |
| `Failed to parse SessionDescription. { Expect line: v= }` | `connect()` was called without a URL, so the API returned JSON instead of SDP. | Call `connect({ apiKey, url: 'https://api.openai.com/v1/realtime?model=...' })`. |
| Zod: `.optional()` without `.nullable()` | The older SDK requires optional fields to also allow `null`. | Use `nullable().optional()` in schemas and strip `null` fields from the payload before sending. |
| Tool 422 `Expected object, received null` | The payload contained `range: null`. | Remove any `null` fields before sending the tool payload. |
| `getInitialSessionConfig is not a function` | The 0.0.10 SDK does not expose this helper. | Remove the debug call entirely. |
| `today` / `recent` off by one day | Using a unified timezone but still filtering `scope === 'today'` via `start.slice(0,10)` (UTC) introduced an off‑by‑one error. | When `scope` is `today`, filter by `eq('date', anchorDate)` instead, and inject “Today is ${anchorDate} (Australia/Sydney).” into the system prompt to help the model reason about dates. |
| Echo mis‑interprets “last week” / “yesterday” | The model did not know the “current date” or user timezone, so it filled `scope` incorrectly. | Extend `buildVoiceAgentInstructions()` with `Today is ${anchorDate} (Australia/Sydney).` and document how to set `anchorDate` / `range` in tools. |
| Session keeps running after closing the panel and times out | The dialog closed without calling `disconnect()`, so the session stayed active until the 10‑minute timeout. | In `VoiceAgentPanel`’s `onOpenChange`, intercept `nextOpen === false` and immediately call `disconnect()` when the session is still active. |

### 4.1 Date & Time Reasoning Notes
- **Symptoms**: With `scope: today`, the API returned summaries for 11/09 and 11/10; the `recent` anchorDate also lagged by one day, and Echo answered “last week” by summarising the current week.
- **Analysis**: `getLocalDayRange()` defaults to `Australia/Sydney`, but the “today” query still used `start.slice(0,10)` (UTC) to filter `daily_summaries`. For Sydney on 11/11, the UTC start is 11/10T13:00Z, so the SQL became `date >= '2025-11-10'`.
- **Fix**:
  ```ts
  if (payload.scope === 'today') {
    const { data } = await client
      .from('daily_summaries')
      .select('*')
      .eq('date', anchor); // anchor = getLocalDayRange().date
  }
  ```
  At the same time, inject `Today is ${anchor} (Australia/Sydney).` into the system prompt so the model can correctly infer `anchorDate` and `range` when calling tools.
- **Result**: `scope: today` now only returns 11/11 rows; `recent`’s anchorDate is aligned with the current local date, and Echo correctly sets tool parameters when answering “last week / yesterday”.

## 5. Current Status (2025-11-10)
- ✅ Ephemeral token issuance, WebRTC connection, and push‑to‑talk are fully wired up.
- ✅ Echo can read structured journal data (when present in the database) and invoke search tools.
- ✅ The UI supports seven voice profiles, with a floating button that snaps to mobile edges.
- ⚠ When there is no data, Echo currently returns empty arrays; the tool layer should later add more helpful messaging or seed data.

## 6. Next Steps
1. Enrich tool semantics so the agent can automatically map phrases like “yesterday” or “this week” into `{ scope, anchorDate, range }`.
2. Add mock/seed data for `/api/agent/tools/context` so demos remain meaningful even on fresh accounts.
3. Track upstream SDK updates (especially fixes for `session.type`) and plan a future upgrade.
4. Capture additional (anonymised) conversation logs for debugging Echo’s behaviour.
- ✅ Already done: automatically disconnect the Realtime session when closing the panel or navigating away to avoid background timeouts.
