# Troubleshooting Guide

## Voice Agent Realtime Integration

| Symptom | Root Cause | Fix |
| --- | --- | --- |
| `/api/agent/token` returns `Unknown parameter: 'session.voice'` or `'model'` | `client_secrets` was called directly and the body contained unsupported fields. | Use the OpenAI SDK `openai.beta.realtime.sessions.create({ model })`, or follow the official example and send `{"session": {"type": "realtime", "model": "..."}}`. |
| Console shows `Unknown parameter: 'session.type'` | `@openai/agents-realtime@0.3.x` includes deprecated fields in the `session.update` payload. | Pin `@openai/agents` / `@openai/agents-realtime` / `openai` to 0.0.10 / 5.8.2 (matching the sample), or wait for an upstream fix and then upgrade. |
| `Failed to parse SessionDescription. { Expect line: v= }` | The Realtime connection URL was not explicitly set, so the endpoint returned JSON instead of SDP. | Call `session.connect({ apiKey, url: 'https://api.openai.com/v1/realtime?model=...' })`. |
| Zod reports `.optional()` without `.nullable()` | Optional fields in the tool schema did not allow `null`, which the older SDK does not accept. | Use `nullable().optional()`, and strip any fields that are `null` from the payload before sending. |
| `/api/agent/tools/context` returns 422 `Expected object, received null` | The payload still contained fields like `range: null`. | Remove all `null` fields before invoking the tool. |
| Console shows `getInitialSessionConfig is not a function` | The older SDK does not expose this helper. | Remove the debug call. |
| Echo’s answers about “today / yesterday / last week” don’t match real dates | The unified timezone + UTC truncation caused `anchorDate` to lag by one day, and the model did not know the current date. | For `scope === 'today'` query by `eq('date', anchorDate)`, and inject “Today is ${anchorDate} (Australia/Sydney)” into the system prompt so the model sets `anchorDate` / `range` explicitly when calling tools. |
| Session keeps running after closing the Voice panel and times out a few minutes later | The dialog closes without explicitly disconnecting the Realtime session, so it continues until the 10‑minute limit. | In the panel component’s `onOpenChange` callback, detect `nextOpen === false` and call `disconnect()` so closing the panel always ends the session. |

## Common Development Issues and Solutions

### Next.js Development Issues

#### 1. Build Cache Corruption
**Error**: 
```
Error: ENOENT: no such file or directory, open '/path/to/.next/static/development/_buildManifest.js.tmp.xxxxx'
```

**Cause**: Next.js cache corruption during development, often occurs when:
- Multiple files are modified simultaneously
- Development server is forcefully terminated
- File system permissions issues

**Solution**:
```bash
# Quick fix
rm -rf .next
pnpm dev

# Complete clean (if problem persists)
rm -rf .next node_modules
pnpm install
pnpm dev
```

**Prevention**:
- Use proper shutdown procedures (Ctrl+C)
- Avoid rapid file modifications during build
- Ensure proper file system permissions

#### 2. Port Conflicts
**Error**: 
```
⚠ Port 3000 is in use, using available port 3001 instead
```

**Cause**: Another process is using the default port 3000

**Solution**:
```bash
# Kill process using port 3000
lsof -ti:3000 | xargs kill -9

# Or use alternative port
pnpm dev --port 3001
```

#### 3. Intermittent `/_not-found` or `/_document` build errors
**Error**:
```
Error [PageNotFoundError]: Cannot find module for page: /_not-found
```

**Cause**: Known Next.js 15 regression (particularly after large client-component updates) where the build step briefly loses the generated `_not-found` or `_document` entries even though `src/app/not-found.tsx` exists.

**Workarounds**:
```bash
# Clear build artifacts then retry
rm -rf .next
pnpm build

# If the error reappears, rerun the build once more
pnpm build
```

**Notes**:
- The issue does **not** affect `pnpm dev`; only production builds are impacted.
- Track Next.js release notes and upgrade once the upstream fix lands. Until then, the retry strategy above has consistently recovered the build.

### React Development Issues

#### 1. Client Component Event Handlers
**Error**: 
```
Error: Event handlers cannot be passed to Client Component props
```

**Cause**: Server components cannot pass event handlers to client components

**Solution**:
```typescript
// Add 'use client' directive to components with event handlers
'use client';

import { Button } from '@/components/ui/button';

export default function MyComponent() {
  return (
    <Button onClick={() => console.log('clicked')}>
      Click me
    </Button>
  );
}
```

#### 2. Missing Key Props in Lists
**Error**: 
```
Each child in a list should have a unique "key" prop
```

**Cause**: React requires unique keys for list items to optimize rendering

**Solution**:
```typescript
// Bad
{items.map((item) => (
  <div>{item.name}</div>
))}

// Good
{items.map((item) => (
  <div key={item.id}>{item.name}</div>
))}

// For arrays without unique IDs
{items.map((item, index) => (
  <div key={`item-${index}`}>{item.name}</div>
))}
```

#### 3. React Hook Dependencies
**Error**: 
```
React Hook useEffect has a missing dependency: 'functionName'
```

**Cause**: useEffect depends on variables that aren't in the dependency array

**Solution**:
```typescript
// Use useCallback for stable function references
const stableFunction = useCallback(() => {
  // function logic
}, [dependencies]);

useEffect(() => {
  stableFunction();
}, [stableFunction]);
```

### TypeScript Issues

#### 1. Strict Type Checking
**Error**: 
```
'props' is declared but its value is never read
```

**Solution**:
```typescript
// Use underscore for unused parameters
const MyComponent = forwardRef<RefType, Props>((_props, ref) => {
  // component logic
});

// Or destructure only needed props
const MyComponent = ({ neededProp, ...rest }: Props) => {
  // component logic
};
```

#### 2. wavesurfer.js Record Plugin Missing Types
**Error**
```
TS7016: Could not find a declaration file for module 'wavesurfer.js/dist/plugins/record.esm.js'
```

**Cause**: The plugin ships its type definitions as `record.d.ts` while the runtime import path is `record.esm.js`, so TypeScript cannot auto-resolve the declaration when `moduleResolution` is set to `node`.

**Fix**:
1. Create `src/types/wavesurfer-record.d.ts`:
   ```ts
   declare module 'wavesurfer.js/dist/plugins/record.esm.js' {
     import RecordPlugin from 'wavesurfer.js/dist/plugins/record.js';
     export default RecordPlugin;
   }
   ```
2. Ensure `tsconfig.json` includes the `src` directory (already true in this repo). Restart the dev server so the shim is picked up.

#### 3. Live Waveform Rendering Blank
**Symptoms**: The audio recorder works, but the live waveform never animates.

**Cause**: `renderMicStream()` was called before the Record plugin finished registering, so no analyser loop ever ran.

**Fix**:
- Track an `isPluginReady` flag in `LiveWaveform`.
- Only call `renderMicStream(stream)` once WaveSurfer + plugin are instantiated.
- Tear down analyser intervals in the cleanup function to avoid zombie listeners.

### UI & Animation Issues

#### 3. WebView top Profile (avatar) bar “disappears” / is clipped
**Symptoms**: In an iOS WebView or embedded browser on devices with a notch, the header avatar/profile dropdown on `/dashboard/overview` appears to vanish.

**Root Cause**: The header is `sticky top-0` and the default top padding on the page container was removed. Without reserving `safe-area` space for the sticky header, the WebView status bar/notch overlaps the header, making it look like it has moved out of the viewport. If `viewport-fit=cover` is not set, `env(safe-area-inset-top)` stays at 0 and padding compensation fails.

**Fix**:
- Enable safe-area support: add `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` to `<head>` in `src/app/layout.tsx:1`.
- Reserve safe-area height for the header (choose one):
  - A. On the `<header>` in `src/components/layout/header.tsx:11`, add  
    `style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 6px)', minHeight: 'calc(64px + env(safe-area-inset-top, 0px) + 6px)' }}`
  - B. On the page container in `src/app/dashboard/overview/layout.tsx:22`, add  
    `<PageContainer scrollable={false} className='pt-[env(safe-area-inset-top,0px)] ...'>`

**Notes**:
- If the header is still clipped, first confirm `viewport-fit=cover` is set.
- You can tweak constants (like `+ 6px` or the base `64px` height) to fine‑tune the visual height.

#### 1. Typewriter Facts Only Show Part of the Sentence
**Cause**: The idle fact banner used `white-space: nowrap` and `overflow: hidden`, so long copy was clipped, especially on mobile.

**Fix**: Switch to `white-space: pre-wrap` / `word-break: break-word` and drive the typing effect with a `typedChars` counter so the text naturally wraps while it grows.

#### 2. Emoji Lose Their Native Color
**Cause**: Wrapping the entire string in a gradient text span causes emoji glyphs to inherit the gradient, leaving them monochrome outlines.

**Fix**: While rendering each character, detect emoji via the Unicode `Extended_Pictographic` regex and render them inside a plain `text-foreground` span (without gradient). Non-emoji characters remain in the gradient span so the overall typography stays on-brand.

### Database Issues

#### 1. Supabase RLS Policies
**Error**: 
```
new row violates row-level security policy for table "daily_question"
```

**Cause**: Row Level Security (RLS) policies are not properly configured

**Solution**:
```sql
-- Enable RLS
ALTER TABLE daily_question ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users
CREATE POLICY "Users can manage their own records" ON daily_question
  FOR ALL USING (auth.uid()::text = user_id);
```

#### 2. Date Filtering Issues
**Problem**: Queries not returning expected results for "today's" data

**Cause**: Timezone differences between client and server

**Solution**:
```typescript
// Use consistent date formatting
const today = new Date().toISOString().split('T')[0];
const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

const { data, error } = await supabase
  .from('daily_question')
  .select('*')
  .eq('user_id', user.id)
  .gte('created_at', today)
  .lt('created_at', tomorrow)
  .single();
```

### Authentication Issues

#### 1. Clerk Session Management
**Error**: 
```
user is undefined in useUser hook
```

**Cause**: Component renders before Clerk authentication initializes

**Solution**:
```typescript
const { user, isLoaded } = useUser();

if (!isLoaded) {
  return <div>Loading...</div>;
}

if (!user) {
  return <div>Please sign in</div>;
}
```

### Performance Issues

#### 1. Unnecessary Re-renders
**Problem**: Components re-render too frequently

**Solution**:
```typescript
// Use React.memo for expensive components
const ExpensiveComponent = React.memo(({ data }) => {
  return <div>{data}</div>;
});

// Use useCallback for event handlers
const handleClick = useCallback(() => {
  // handler logic
}, [dependency]);

// Use useMemo for expensive calculations
const expensiveValue = useMemo(() => {
  return calculateExpensiveValue(data);
}, [data]);
```

### Build and Deployment Issues

#### 1. Environment Variables
**Error**: 
```
NEXT_PUBLIC_SUPABASE_URL is not defined
```

**Solution**:
```bash
# Ensure .env.local exists and contains required variables
cp env.example.txt .env.local

# Edit .env.local with your values
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

#### 2. TypeScript Build Errors
**Error**: 
```
Type error: Cannot find module '@/components/ui/button'
```

**Solution**:
```bash
# Regenerate TypeScript types
pnpm supabase:generate-types

# Check TypeScript configuration
npx tsc --showConfig

# Clear TypeScript cache
rm -rf node_modules/.cache
```

### Testing Issues

#### 1. Component Testing Setup
**Problem**: Components with hooks fail in tests

**Solution**:
```typescript
// Wrap components with required providers
import { render } from '@testing-library/react';
import { ClerkProvider } from '@clerk/nextjs';

const renderWithProviders = (component) => {
  return render(
    <ClerkProvider>
      {component}
    </ClerkProvider>
  );
};
```

## Debugging Tools and Techniques

### React Developer Tools
- Install React DevTools browser extension
- Use Profiler to identify performance bottlenecks
- Inspect component props and state

### Network Debugging
```typescript
// Log Supabase queries
const { data, error } = await supabase
  .from('daily_question')
  .select('*')
  .eq('user_id', user.id);

console.log('Supabase query:', { data, error });
```

### Error Boundary Setup
```typescript
// Create error boundary for better error handling
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <h1>Something went wrong.</h1>;
    }
    return this.props.children;
  }
}
```

## Best Practices

### Code Organization
- Use feature-based folder structure
- Keep components small and focused
- Extract custom hooks for reusable logic
- Use TypeScript for better type safety

### Performance
- Implement proper loading states
- Use React.memo for expensive components
- Implement proper error boundaries
- Optimize database queries

### Security
- Always validate user input
- Use proper authentication checks
- Implement RLS policies in Supabase
- Never expose sensitive data in client-side code

## Audio Journal Recording Issues

### Microphone Permission Denied
**Error**: 
```
Unable to access microphone. Please check permissions.
```

**Solution**:
1. Browser level: Check site permissions in browser settings
2. System level: Ensure browser has microphone access in OS settings
3. HTTPS requirement: MediaRecorder requires secure context (HTTPS or localhost)

### Recording Not Starting
**Problem**: Click record button but nothing happens

**Causes & Solutions**:
- Check browser compatibility (Chrome/Edge/Firefox recommended)
- Ensure microphone is not in use by another application
- Check console for specific MediaRecorder errors

### Audio Playback Issues
**Problem**: Recorded audio won't play

**Solution**:
```typescript
// Ensure proper MIME type support
const options = {
  mimeType: 'audio/webm;codecs=opus' // Primary choice
};

// Fallback options
if (!MediaRecorder.isTypeSupported(options.mimeType)) {
  options.mimeType = 'audio/webm';
}
```

## Supabase Storage Issues

### Storage Bucket Not Found
**Error**: 
```
Storage error: {
  statusCode: '404',
  error: 'Bucket not found',
  message: 'Bucket not found'
}
```

**Solution**:
1. Create bucket in Supabase Dashboard:
   - Navigate to Storage section
   - Create bucket named `audio-files`
   - Set appropriate permissions (public/private)

### RLS Policy Violations
**Error**: 
```
new row violates row-level security policy
```

**Solutions**:

1. **For Clerk + Supabase**: Use service role key in API routes
```typescript
// Create admin client for bypassing RLS
import { createAdminClient } from '@/lib/supabase/admin';
const supabase = createAdminClient();
```

2. **Disable RLS** (development only):
```sql
ALTER TABLE audio_files DISABLE ROW LEVEL SECURITY;
ALTER TABLE transcripts DISABLE ROW LEVEL SECURITY;
```

3. **Configure proper RLS** (production):
```sql
-- Since using Clerk auth, policies need custom implementation
-- Consider using service role key for authenticated operations
```

### File Upload Size Limits
**Error**: 
```
File too large
```

**Solution**:
- Whisper API limit: 25MB
- Configure Supabase bucket limit accordingly
- Implement client-side validation:
```typescript
const maxSize = 25 * 1024 * 1024; // 25MB
if (audioFile.size > maxSize) {
  return NextResponse.json({ error: 'File too large' }, { status: 400 });
}
```

## OpenAI API Issues

### Missing API Key
**Error**: 
```
OpenAI API configuration error
```

**Solution**:
1. Add to `.env.local`:
```env
OPENAI_API_KEY=sk-proj-****
```
2. Restart development server

### API Quota Exceeded
**Error**: 
```
API quota exceeded
```

**Solutions**:
- Check OpenAI dashboard for usage limits
- Implement rate limiting in your application
- Consider queuing system for high traffic

### Transcription Failures
**Problem**: Whisper API returns empty or incorrect transcription

**Solutions**:
1. Verify audio quality and format
2. Check language settings
3. Ensure audio contains speech (not silence)
4. Handle edge cases:
```typescript
if (!transcription || transcription.trim().length === 0) {
  return NextResponse.json({ error: 'No speech detected in audio' }, { status: 400 });
}
```

### GPT Summarization Issues
**Problem**: Summary not generating or too generic

**Solution**: Refine system prompt
```typescript
const systemPrompt = `You are a helpful assistant that summarizes personal journal entries. 
Create a concise, structured summary that:
- Removes redundancies and filler words
- Corrects grammar while preserving the original meaning
- Highlights key themes and emotions
- Aims for 2-3 sentences maximum`;
```

## Module B (Echos) – Troubleshooting Case Study

### Symptoms
- After switching models to GPT‑5/5‑mini, recording/transcribe sometimes returned 500/400 and Echos cards failed to generate; JSON parsing errors like `Unexpected end of JSON input`.
- Daily Summaries (table) showed “multiple entries today”, but `transcripts` appeared to have only a few rows; the frontend list could see and edit them, and Studio showed additional rows later.
- `/api/transcribe` responses felt slow and the UI wait time was noticeable.

### Root Causes
- GPT‑5 chat parameter incompatibility: it does not support `temperature` / `top_p` / `max_tokens`, requiring `max_completion_tokens` or a move to the Responses API. In addition, `choices[0].message.content` can be empty or an array, so directly calling `JSON.parse(content)` can throw.
- Timezone window mismatch: the frontend treats “today” as the local day, while Studio filters by UTC; using `toISOString().split('T')[0]` further diverges from user expectations.
- Blocking pipeline: daily summary + Echos sync ran synchronously after recording, lengthening `/api/transcribe` response times.

### Fixes & Changes
- Model fallback: standardised on the GPT‑4 family (`gpt-4o` / `gpt-4o-mini`) with `max_tokens` + `temperature` for stability (`src/app/api/transcribe/route.ts`, `src/app/api/generate-daily-summary/route.ts`, `src/lib/reflections/generator.ts`).
- JSON parsing hardening (recommended): guard `choices[0].message.content`; if it is an array, join the `text` fields; wrap `JSON.parse` in try/catch and provide a fallback.
- Non‑blocking pipeline: move “generate daily summary + Echos sync” into background work so the recording endpoint returns quickly (`src/app/api/transcribe/route.ts`), and trigger Echos asynchronously after manual summary generation (`src/app/api/generate-daily-summary/route.ts`).
- Timezone consistency (recommended): either have the client use local start/end times converted to ISO for “today” queries, or let the backend compute windows by user timezone and store/query accordingly to avoid “GUI can’t see it” issues.

### Verification Playbook
1) Use DevTools MCP to capture `/api/transcribe`: confirm 200 and that the response contains `audioFileId` and `transcriptId`.
2) SQL quick check (UTC vs local timezone):
```sql
-- UTC count for “today”
WITH b AS (
  SELECT date_trunc('day', now() AT TIME ZONE 'UTC') AS s,
         date_trunc('day', now() AT TIME ZONE 'UTC') + interval '1 day' AS e)
SELECT 'transcripts_utc' AS bucket, COUNT(*)
FROM transcripts t, b WHERE t.created_at >= b.s AND t.created_at < b.e
UNION ALL
SELECT 'audio_utc', COUNT(*) FROM audio_files a, b WHERE a.created_at >= b.s AND a.created_at < b.e;

-- Sydney count for “today” (replace with your timezone)
WITH tz AS (SELECT (now() AT TIME ZONE 'Australia/Sydney')::date AS d)
SELECT 'transcripts_syd', COUNT(*) FROM transcripts t, tz
WHERE (t.created_at AT TIME ZONE 'Australia/Sydney')::date = (SELECT d FROM tz)
UNION ALL
SELECT 'audio_syd', COUNT(*) FROM audio_files a, tz
WHERE (a.created_at AT TIME ZONE 'Australia/Sydney')::date = (SELECT d FROM tz);
```
3) Studio view: disable date filters, sort by `created_at DESC` to see the latest rows, then search by `id` for precise verification.

### Dev Tips
- Local auth bypass for DevTools testing: add `DEV_DISABLE_AUTH=true` to `.env.local`, effective only when `NODE_ENV=development`; the middleware then allows pages and APIs through (`src/middleware.ts`).
- Recording data flow: Storage → `audio_files` → `transcripts` → (background) `daily_summaries` → (background) `period_reflections`.

### Lessons Learned
- Before switching models, verify parameter/response shape differences (for GPT‑5, prefer the Responses API).
- The UI/frontend definition of “today” should match the query logic and Studio inspection (explicit timezone).
- Long‑running backend tasks should be made asynchronous when possible to reduce perceived latency.

### Recovery Steps (safe cleanup + regeneration)

If monthly/weekly card titles do not match their content (UTC vs local month boundary mismatch), recover as follows:

1) Find the cards that need cleanup
```sql
-- Review the most recent month/week cards (read‑only)
SELECT period_type, period_start, period_end, created_at
FROM period_reflections
WHERE user_id = '<your_user_id>'
ORDER BY period_start DESC
LIMIT 20;
```

2) Precisely delete the incorrect months (explicit `period_start` recommended)
```sql
-- Example (replace <your_user_id> with your real user_id)
DELETE FROM period_reflections
WHERE user_id = '<your_user_id>'
  AND period_type = 'monthly'
  AND period_start IN ('2025-10-31','2025-09-30');
```

Optional: if there are many bad rows, you can delete by time window, but always run the same WHERE clause as a `SELECT` first:
```sql
-- Example: delete “bad month” cards within a time window
-- Important: run this as SELECT first, then convert to DELETE
SELECT id, period_start, period_end, created_at
FROM period_reflections
WHERE user_id = '<your_user_id>'
  AND period_type = 'monthly'
  AND period_start < '2025-11-01';

-- After confirming, perform the delete:
DELETE FROM period_reflections
WHERE user_id = '<your_user_id>'
  AND period_type = 'monthly'
  AND period_start < '2025-11-01';
```

3) Regenerate the “current period” card from the frontend
- Go to `/dashboard/echos`, switch to Monthly, and click “Refresh current period”.
- The refresh anchor logic has been fixed: if the top card is not the in‑progress card, the system uses “today” as the anchor to generate the current monthly card (local month boundary).
- Similarly, to correct weekly cards, switch to Weekly and click refresh.

4) Verify the result
```sql
-- The new “current month” card should have period_start = local month 1st
SELECT period_type, period_start, period_end, last_generated_at
FROM period_reflections
WHERE user_id = '<your_user_id>'
  AND period_type = 'monthly'
ORDER BY period_start DESC
LIMIT 3;
```

Notes
- Only clean up incorrect weekly/monthly cards in `period_reflections`; `daily_summaries` is the daily base table and should not be deleted.
- Always run a `SELECT` with the same WHERE clause before executing `DELETE` to ensure the target set is correct.
- The codebase now uses local timezone period boundaries, so regenerated cards will no longer cross months/weeks incorrectly.

### Build Failed: metadata in client component

**Error**
```
x You are attempting to export "metadata" from a component marked with "use client"...
```

**Cause**: `/dashboard/journals/stats/page.tsx` is a client component (`'use client'`) but still exports `metadata`.

**Fix**
```diff
diff --git a/src/app/dashboard/journals/stats/page.tsx b/src/app/dashboard/journals/stats/page.tsx
@@
-'use client';
-
-import PageContainer from '@/components/layout/page-container';
-
-export const metadata = {
-  title: 'Dashboard: Journal Stats'
-};
+'use client';
+
+import PageContainer from '@/components/layout/page-container';
+
+// metadata export is not allowed in a client component page.
+// Move it to a parent layout or convert this page to a server wrapper.
```

### Build Failed: stats payload incompatible with Supabase JSON type

**Error**
```
Type error: Argument of type '{ ... stats: { [k: string]: unknown } }' is not assignable to TablesUpdate<'daily_summaries'>...
```

**Cause**: `cleanStats` returns `Record<string, unknown>`, which cannot be assigned to the Supabase `Json` type; `updatePayload` / `upsertPayload` do not explicitly use Supabase types.

**Fix** (excerpt)
```diff
diff --git a/src/lib/reflections/generator.ts b/src/lib/reflections/generator.ts
@@
-import { reflectionAISchema } from './schema';
-import type { ReflectionCard, ReflectionMode } from './types';
+import { reflectionAISchema } from './schema';
+import type { ReflectionCard, ReflectionMode } from './types';
+import type { Json, TablesInsert, TablesUpdate } from '@/types/supabase';

-const MODEL_NAME = process.env.OPENAI_REFLECTION_MODEL ?? 'gpt-5';
+const MODEL_NAME = process.env.OPENAI_REFLECTION_MODEL ?? 'gpt-4o-mini';

-const cleanStats = (stats: Record<string, unknown> | null | undefined) => {
-  if (!stats) return null;
-  const filteredEntries = Object.entries(stats).filter(([_, value]) => value != null);
-  if (filteredEntries.length === 0) return null;
-  return Object.fromEntries(filteredEntries);
-};
+type StatsShape = {
+  entryCount?: number;
+  topEmotions?: string[];
+  keywords?: string[];
+} | null | undefined;
+
+const cleanStats = (stats: StatsShape): Json | null => {
+  if (!stats) return null;
+  const obj: Record<string, unknown> = {};
+  if (typeof stats.entryCount === 'number') obj.entryCount = stats.entryCount;
+  if (Array.isArray(stats.topEmotions)) obj.topEmotions = stats.topEmotions;
+  if (Array.isArray(stats.keywords)) obj.keywords = stats.keywords;
+  return Object.keys(obj).length ? (obj as unknown as Json) : null;
+};

-const updatePayload = {
+const updatePayload: TablesUpdate<'daily_summaries'> = {
   achievements: ...,
   stats: cleanStats(stats),
   ...
};

-const upsertPayload = {
+const upsertPayload: TablesInsert<'period_reflections'> = {
   user_id: userId,
   stats: cleanStats(baseStats),
   ...
};
```

> Tip: if you change models in future, make sure `MODEL_NAME` stays in sync with the Supabase JSON type.

### Build Failed: Sentry client `beforeSend` type mismatch

**Error**
```
Type error: Type '(event: Sentry.Event) => Sentry.Event' is not assignable to type '(event: ErrorEvent, hint: EventHint) => ErrorEvent | PromiseLike<ErrorEvent | null> | null'.
```

**Cause**
- `src/instrumentation-client.ts` reused the server‑side `scrubEvent` (typed as `Sentry.Event`), but the browser SDK expects `beforeSend` to receive an `ErrorEvent`.
- `next build` (husky pre‑push) re‑runs TypeScript checks; even if the editor shows no errors, this can still block pushes.

**Fix**
```ts
const scrubEvent = (
  event: Sentry.ErrorEvent,
  _hint: Sentry.EventHint
): Sentry.ErrorEvent | null => {
  if (event.request?.headers) {
    delete event.request.headers.authorization;
    delete event.request.headers.Authorization;
  }
  return event ?? null;
};

Sentry.init({
  // ...
  beforeSend: scrubEvent,
  // ...
});
```

**Verification**
- Run `pnpm run build` locally and confirm it passes; afterwards the husky pre‑push hook will also succeed.
- The server‑side `src/instrumentation.ts` can keep the `Sentry.Event` signature; no coordinated change is needed.

## Fix Strategy & Example Diffs

This section records how we fixed the “recording → transcription → daily summary → Echos sync” pipeline and provides code diffs that can be applied to the current codebase.

### A. Make “daily summary + Echos sync” fully asynchronous to reduce perceived latency

Reason: once audio and transcripts are saved successfully we can return immediately. Daily summary and Echos generation are value‑added operations and should not block the main request path.

Files involved: `src/app/api/transcribe/route.ts`, `src/app/api/generate-daily-summary/route.ts`

Example diff:

```diff
diff --git a/src/app/api/transcribe/route.ts b/src/app/api/transcribe/route.ts
@@
-    // Step 6: Generate daily summary directly
-    try {
-      const summaryData = await generateDailySummary(
-        userId,
-        supabase,
-        openai
-      );
-      if (summaryData?.date) {
-        await syncReflectionsForDate({
-          supabase,
-          openai,
-          userId,
-          anchorDate: summaryData.date
-        });
-      }
-    } catch (summaryError) {
-      // Log but don't fail the main request
-      console.error('Failed to generate daily summary:', summaryError);
-    }
+    // Step 6: Kick off daily summary + echos sync in background (non-blocking)
+    (async () => {
+      try {
+        const summaryData = await generateDailySummary(
+          userId,
+          supabase,
+          openai
+        );
+        if (summaryData?.date) {
+          await syncReflectionsForDate({
+            supabase,
+            openai,
+            userId,
+            anchorDate: summaryData.date
+          });
+        }
+      } catch (summaryError) {
+        console.error('Background daily summary failed:', summaryError);
+      }
+    })();

diff --git a/src/app/api/generate-daily-summary/route.ts b/src/app/api/generate-daily-summary/route.ts
@@
-    try {
-      await syncReflectionsForDate({
-        supabase,
-        openai,
-        userId,
-        anchorDate: date
-      });
-    } catch (reflectionError) {
-      console.error('Failed to sync reflections after summary:', reflectionError);
-    }
+    // Trigger echos sync in background to keep summary response fast
+    (async () => {
+      try {
+        await syncReflectionsForDate({
+          supabase,
+          openai,
+          userId,
+          anchorDate: date
+        });
+      } catch (reflectionError) {
+        console.error('Background reflections sync failed:', reflectionError);
+      }
+    })();
```

### B. Unify the “today” time window (avoid timezone drift)

Reason: the client previously used `toISOString().split('T')[0]` to calculate today’s boundary (UTC day), which diverged from local/Studio views. We recommend using local `00:00:00–23:59:59.999`, then converting to ISO for queries.

Files involved: `src/lib/supabase/queries.ts`

Example diff (changes):

```diff
diff --git a/src/lib/supabase/queries.ts b/src/lib/supabase/queries.ts
@@
 export const getTodayMoodEntry = cache(
   async (supabase: TypedSupabaseClient, userId: string) => {
     if (!userId) return null;

-    const today = new Date().toISOString().split('T')[0];
-    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
-      .toISOString()
-      .split('T')[0];
+    const start = new Date();
+    start.setHours(0, 0, 0, 0);
+    const end = new Date();
+    end.setHours(23, 59, 59, 999);

     const { data, error } = await supabase
       .from('daily_question')
       .select('*')
       .eq('user_id', userId)
-      .gte('created_at', today)
-      .lt('created_at', tomorrow)
+      .gte('created_at', start.toISOString())
+      .lte('created_at', end.toISOString())
       .single();
@@
 export const getTodayAudioJournals = cache(
   async (supabase: TypedSupabaseClient, userId: string) => {
     if (!userId) return [];

-    const today = new Date().toISOString().split('T')[0];
-    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
-      .toISOString()
-      .split('T')[0];
+    const start = new Date();
+    start.setHours(0, 0, 0, 0);
+    const end = new Date();
+    end.setHours(23, 59, 59, 999);

     const { data, error } = await supabase
       .from('audio_files')
       .select(
         `
         *,
         transcripts (
           id,
           text,
           language,
           created_at
         )
       `
       )
       .eq('user_id', userId)
-      .gte('created_at', today)
-      .lt('created_at', tomorrow)
+      .gte('created_at', start.toISOString())
+      .lte('created_at', end.toISOString())
       .order('created_at', { ascending: false });
```

### C. Harden reflection JSON parsing (handle empty/array `content`)

Reason: the LLM may return an empty string, or `content` as a chunked array; calling `JSON.parse(choices[0].message.content)` directly can throw.

Files involved: `src/lib/reflections/generator.ts`

Example diff (recommended changes for both daily and period paths):

```diff
diff --git a/src/lib/reflections/generator.ts b/src/lib/reflections/generator.ts
@@
-    const parsed = reflectionAISchema.parse(
-      JSON.parse(completion.choices[0]?.message?.content ?? '{}')
-    );
+    const raw = completion.choices[0]?.message?.content as any;
+    const text = Array.isArray(raw)
+      ? raw.map((chunk) => chunk?.text ?? '').join('')
+      : (raw ?? '');
+    let parsed;
+    try {
+      parsed = reflectionAISchema.parse(JSON.parse(text));
+    } catch (err) {
+      console.error('Reflection JSON parse failed (daily):', { text, err });
+      throw err;
+    }
@@
-  const parsed = reflectionAISchema.parse(
-    JSON.parse(completion.choices[0]?.message?.content ?? '{}')
-  );
+  const raw2 = completion.choices[0]?.message?.content as any;
+  const text2 = Array.isArray(raw2)
+    ? raw2.map((chunk) => chunk?.text ?? '').join('')
+    : (raw2 ?? '');
+  let parsed;
+  try {
+    parsed = reflectionAISchema.parse(JSON.parse(text2));
+  } catch (err) {
+    console.error('Reflection JSON parse failed (period):', { text2, err });
+    throw err;
+  }
```

> Note: if you later migrate to GPT‑5, we recommend moving to the Responses API and extracting `output_text` or `output[*].text` from its response before performing JSON validation.

---

These changes can be adopted in stages: A (already implemented) improves response time; B and C (recommended) eliminate timezone/JSON edge cases and improve stability and observability.

## Integration Issues

### Event System Not Working
**Problem**: Modal not opening when button clicked

**Solution**: Verify event listener setup
```typescript
// In layout component
useEffect(() => {
  const handleOpenModal = () => {
    modalRef.current?.openModal();
  };
  
  window.addEventListener('openAudioJournalModal', handleOpenModal);
  return () => {
    window.removeEventListener('openAudioJournalModal', handleOpenModal);
  };
}, []);
```

### Stats Not Updating
**Problem**: Audio journal stats remain at 0

**Solutions**:
1. Check database queries are returning data
2. Verify user ID matching between Clerk and database
3. Ensure proper date filtering in queries
4. Check for event dispatching after successful save:
```typescript
const event = new CustomEvent('audioJournalUpdated');
window.dispatchEvent(event);
```

### Type Errors with Supabase
**Problem**: TypeScript errors with query results

**Solution**: Ensure types match actual query structure
```typescript
// Define custom types for joined queries
type AudioJournalWithTranscript = Tables<'audio_files'> & {
  transcripts: {
    id: string;
    text: string | null;
    language: string | null;
    created_at: string | null;
  }[];
};
```

## Performance Optimization

### Slow Transcription Processing
**Problem**: API takes too long to respond

**Solutions**:
1. Show proper loading states
2. Implement progress indicators
3. Consider audio compression before upload
4. Add timeout handling:
```typescript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout
```

### Memory Leaks with Audio Blobs
**Problem**: Browser memory usage increases

**Solution**: Clean up audio URLs
```typescript
useEffect(() => {
  return () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
  };
}, [audioUrl]);
```

## Sydney Morning Data Vanishing Due to UTC Day Boundaries (Nov 2025)

### Symptoms Observed
- 2025‑11‑07 AEST (UTC+11) morning: `DailyMoodWidget` rendered fallback (“Log mood”) with no emoji animation even though Supabase had same‑day mood rows.
- Journal Library under `/dashboard/journals` failed to show audio entries recorded minutes earlier; data appeared only under the previous day when checking raw tables.
- Daily summary generation produced a November 6th record even though user had already started November 7th in Sydney.

### Root Cause
1. Commit `3948ca8755b5ecfd` replaced `today/tomorrow` string comparisons with a “start/end of day” calculation using `Date#setHours(...)` followed by `.toISOString()`.  
   - Calling `.toISOString()` converts the local midnight (Sydney 00:00) to UTC (previous day 13:00).  
   - Queries now included the window `[previous-day-13:00Z, same-day-12:59:59Z]`, so every row inserted before ~11:00 AEST was **earlier than the lower bound** and invisible to client code.
2. Server routes `/api/transcribe` and `/api/generate-daily-summary` still built `currentDate` via `new Date().toISOString().split('T')[0]`, so summaries kept the UTC day stamp while front-end filters switched to “local day” logic. The mismatch meant a user could never get a “today” card until ~11:00.

### Impact
- Mood modal auto-trigger logic (`src/features/daily-record/components/daily-mood-modal.tsx`) saw no entry for “today” and spammed prompts every morning.
- Journal list filters and “today streak” stats treated the Sydney morning as missing, breaking streak counts and filtering by date.
- Daily summaries and Echos cards lagged one day and never referenced the actual local date, producing misleading reflections and misaligned cron jobs.

### Debug & Reasoning Timeline
1. Confirmed Supabase tables via MCP queries: `daily_question.created_at = 2025-11-06 00:00:59+00` even though the user entered data on the 7th AEST.
2. Ran `git log` and isolated `3948ca8` as the commit changing the date filter implementation.
3. Blamed `src/lib/supabase/queries.ts` to see that `start/end` were generated locally but serialized to UTC.
4. Noticed server routes still using UTC strings for summary date fields, exacerbating list grouping.
5. Designed a reusable timezone utility to compute “local day → UTC range” instead of peppering ad‑hoc logic across files.

### Remediation Steps
1. Added `src/lib/timezone.ts` providing:
   - `getLocalDayRange({ date?, timeZone? })` returning `{ date, start, end }`.
   - `getUtcRangeForDate(dateString, timeZone?)` for server lookups when a YYYY-MM-DD (local) date must be converted back to UTC.
   - A cached `Intl.DateTimeFormat` to avoid perf regressions.
2. Updated all “today” queries (`getTodayMoodEntry`, `getTodayAudioJournals`, streak calculators, mood modal checks) to use local ranges.
3. Ensured summary generation and journal API routes convert stored `created_at` to the correct local date before grouping or triggering follow-up jobs.
4. Adjusted Echos UI logic so “current card” detection compares against `getLocalDayRange().date` rather than `new Date().toISOString()`.

### Key Code Diff (excerpt)

```diff
diff --git a/src/lib/supabase/queries.ts b/src/lib/supabase/queries.ts
@@
-import type { SupabaseClient } from '@supabase/supabase-js';
-import { cache } from 'react';
+import type { SupabaseClient } from '@supabase/supabase-js';
+import { cache } from 'react';
+import { getLocalDayRange, getUtcRangeForDate } from '@/lib/timezone';
@@
-    const start = new Date();
-    start.setHours(0, 0, 0, 0);
-    const end = new Date();
-    end.setHours(23, 59, 59, 999);
+    const { start, end } = getLocalDayRange();
@@
-      .gte('created_at', start.toISOString())
-      .lte('created_at', end.toISOString())
+      .gte('created_at', start)
+      .lte('created_at', end)
@@
-        const startOfDay = new Date(summary.date);
-        startOfDay.setHours(0, 0, 0, 0);
-        const endOfDay = new Date(summary.date);
-        endOfDay.setHours(23, 59, 59, 999);
+        const { start: dayStart, end: dayEnd } = getUtcRangeForDate(
+          summary.date
+        );
@@
-          .gte('created_at', startOfDay.toISOString())
-          .lte('created_at', endOfDay.toISOString())
+          .gte('created_at', dayStart)
+          .lte('created_at', dayEnd)
```

### Follow-up Considerations
- The helper currently defaults to `Australia/Sydney`. Future work should read user profile or organization timezone to avoid hardcoding.
- Add regression tests (unit + integration) ensuring morning inserts in UTC+ offsets remain queryable as “today”.
- Document environment variables (`NEXT_PUBLIC_APP_TIMEZONE`, `APP_TIMEZONE`) so deployment targets can override defaults without touching code.

---

**Last Updated**: 2025-11-07  
**Maintainer**: Development Team  
**Next Review**: Monthly
