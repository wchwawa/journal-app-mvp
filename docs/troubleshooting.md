# Troubleshooting Guide

## Voice Agent Realtime 集成

| 症状 | 原因 | 修复 |
| --- | --- | --- |
| `/api/agent/token` 返回 `Unknown parameter: 'session.voice'` 或 `'model'` | 调用了 `client_secrets` 接口并在 body 中传入不被允许的字段。 | 使用 OpenAI SDK 的 `openai.beta.realtime.sessions.create({ model })`，或严格按官方示例提交 `{"session": {"type": "realtime", "model": "..."}}`。 |
| Console 报 `Unknown parameter: 'session.type'` | `@openai/agents-realtime@0.3.x` 在 `session.update` payload 中包含服务器已弃用的字段。 | 将 `@openai/agents` / `@openai/agents-realtime` / `openai` 降级到 0.0.10/5.8.2（与 sample 一致），或等待官方修复新版本。 |
| `Failed to parse SessionDescription. { Expect line: v= }` | 未显式指定 Realtime 连接 URL，返回 JSON 错误而非 SDP。 | `session.connect({ apiKey, url: 'https://api.openai.com/v1/realtime?model=...' })`。 |
| Zod 提示 `.optional()` without `.nullable()` | 工具 schema 中 optional 字段未允许 null，旧版 SDK 不接受。 | 使用 `nullable().optional()`，并在发送 payload 前删除值为 null 的字段。 |
| `/api/agent/tools/context` 返回 422 `Expected object, received null` | payload 中保留了 `range: null` 等字段。 | 在工具执行前删除所有为 null 的字段。 |
| Console 报 `getInitialSessionConfig is not a function` | 旧版 SDK 无此方法。 | 移除该调试调用。 |
| Echo 回答的 “今天/昨天/上周” 与真实日期不符 | 统一时区 + UTC 截断导致 `anchorDate` 落后 1 天；模型也不知道当前日期。 | `scope === 'today'` 时直接 `eq('date', anchorDate)`；在系统 prompt 中注入 “Today is ${anchorDate} (Australia/Sydney)” 等上下文，提示模型调用工具时显式设置 `anchorDate` / `range`。 |
| 关闭 Voice 面板后 session 仍运行，几分钟后超时报错 | Dialog 关闭时没有主动断开 Realtime session，后台会话继续运行到 10 分钟上限。 | 在面板组件的 `onOpenChange` 回调里检测 `nextOpen === false` 时调用 `disconnect()`，确保退出即结束会话。 |

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

#### 3. WebView 顶部 Profile（头像）栏“消失”/被遮挡
**Symptoms**: 在 iOS WebView 或带刘海设备内嵌浏览器中，进入 `/dashboard/overview` 后，顶部 Header 的头像/Profile 下拉看起来“不见了”。

**Root Cause**: 将 Header 设为 `sticky top-0` 后，又移除了页面容器默认的顶部内边距；若未为粘顶 Header 预留 `safe-area` 顶部安全区，WebView 的状态栏/刘海会把 Header 上缘压住，从视觉上像是“向上移出了视口”。未开启 `viewport-fit=cover` 时，`env(safe-area-inset-top)` 始终为 0 也会导致补偿失败。

**Fix**:
- 启用安全区支持：在 `src/app/layout.tsx:1` 的 `<head>` 中加入 `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`
- 为 Header 预留安全区高度（两选一）：
  - A. 在 `src/components/layout/header.tsx:11` 的 `<header>` 上添加：
    `style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 6px)', minHeight: 'calc(64px + env(safe-area-inset-top, 0px) + 6px)' }}`
  - B. 在 `src/app/dashboard/overview/layout.tsx:22` 的页面容器上添加：
    `<PageContainer scrollable={false} className='pt-[env(safe-area-inset-top,0px)] ...'>`

**Notes**:
- 若仍被遮挡，优先检查是否已设置 `viewport-fit=cover`。
- 可通过调整额外常量（如 `+ 6px` 或基础高度 `64px`）微调最终视觉高度。

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
- Daily Summaries (table)显示“今天有多条”，但 `transcripts` 看起来“今天只有少量”；前端列表都能看到并可编辑，Studio 过一阵子又“突然出现”。
- `/api/transcribe` 响应耗时较长，前端等待感强。

### Root Causes
- GPT‑5 chat 参数不兼容：不支持 `temperature`/`top_p`/`max_tokens`，需要改用 `max_completion_tokens` 或直接迁移到 Responses API；同时 `choices[0].message.content` 可能为空或为数组，直接 `JSON.parse(content)` 会抛错。
- 时区窗口不一致：前端按“本地日界”看“今天”，而 Studio 过滤按 UTC；或查询用 `toISOString().split('T')[0]` 导致与期望不一致。
- 阻塞式流程：日总结 + Echos 同步在录音后同步等待，拉长了 `/api/transcribe` 响应时间。

### Fixes & Changes
- 模型回退：统一回退为 GPT‑4 系列（`gpt-4o`/`gpt-4o-mini`），参数恢复 `max_tokens` + `temperature`，保证稳定性（`src/app/api/transcribe/route.ts`, `src/app/api/generate-daily-summary/route.ts`, `src/lib/reflections/generator.ts`）。
- JSON 解析防护（建议）：对 `choices[0].message.content` 判空；如返回为数组则拼接 `text` 字段；`try/catch JSON.parse` 并提供 fallback。
- 非阻塞化：把“生成日总结 + Echos 同步”改为后台任务，录音接口尽快返回（`src/app/api/transcribe/route.ts`），手动生成日总结后也异步触发 Echos（`src/app/api/generate-daily-summary/route.ts`）。
- 时区一致性（建议）：客户端“今天”查询使用本地起止时间转换为 ISO，或后端统一以用户时区计算窗口并落库查询，避免“GUI 看不到”。

### Verification Playbook
1) 用 DevTools MCP 抓取 `/api/transcribe`：确认 200，响应体含 `audioFileId`、`transcriptId`。
2) SQL 快速核对（UTC vs 本地时区）：
```sql
-- UTC 当天计数
WITH b AS (
  SELECT date_trunc('day', now() AT TIME ZONE 'UTC') AS s,
         date_trunc('day', now() AT TIME ZONE 'UTC') + interval '1 day' AS e)
SELECT 'transcripts_utc' AS bucket, COUNT(*)
FROM transcripts t, b WHERE t.created_at >= b.s AND t.created_at < b.e
UNION ALL
SELECT 'audio_utc', COUNT(*) FROM audio_files a, b WHERE a.created_at >= b.s AND a.created_at < b.e;

-- 悉尼当天计数（替换为你的时区）
WITH tz AS (SELECT (now() AT TIME ZONE 'Australia/Sydney')::date AS d)
SELECT 'transcripts_syd', COUNT(*) FROM transcripts t, tz
WHERE (t.created_at AT TIME ZONE 'Australia/Sydney')::date = (SELECT d FROM tz)
UNION ALL
SELECT 'audio_syd', COUNT(*) FROM audio_files a, tz
WHERE (a.created_at AT TIME ZONE 'Australia/Sydney')::date = (SELECT d FROM tz);
```
3) Studio 视图：不加日期过滤，先按 `created_at DESC` 查看最新，再精确搜索 `id`。

### Dev Tips
- 本地旁路鉴权以便 DevTools 测试：`.env.local` 加 `DEV_DISABLE_AUTH=true`，仅在 `NODE_ENV=development` 下生效；中间件将放过页面与 API（`src/middleware.ts`）。
- 录音链路数据流：Storage→`audio_files`→`transcripts`→（后台）`daily_summaries`→（后台）`period_reflections`。

### Lessons Learned
- 在切换模型前验证参数/响应结构差异（GPT‑5 应优先使用 Responses API）。
- UI/前端“今天”的定义应与查询/Studio 检视保持一致（明确时区）。
- 后台长耗时任务尽量异步化，缩短用户感知延迟。

### Recovery Steps（安全清理 + 重新生成）

当出现“月/周卡片标题月份与内容不一致（UTC/本地月界错位）”时，建议按以下步骤恢复：

1) 查找需要清理的错误卡片
```sql
-- 审核最近的月/周卡片（仅读取）
SELECT period_type, period_start, period_end, created_at
FROM period_reflections
WHERE user_id = '<your_user_id>'
ORDER BY period_start DESC
LIMIT 20;
```

2) 精确删除错误月份（推荐显式 period_start）
```sql
-- 示例（将 <your_user_id> 替换为你的实际 user_id）
DELETE FROM period_reflections
WHERE user_id = '<your_user_id>'
  AND period_type = 'monthly'
  AND period_start IN ('2025-10-31','2025-09-30');
```

可选：如果错误行很多，可以使用区间删除，但建议先 `SELECT` 预览确认再执行：
```sql
-- 按时间窗口删除最近一段时间内的“错误月卡”（示例）
-- 注意：先用同样 WHERE 条件执行 SELECT 确认后再改为 DELETE
SELECT id, period_start, period_end, created_at
FROM period_reflections
WHERE user_id = '<your_user_id>'
  AND period_type = 'monthly'
  AND period_start < '2025-11-01';

-- 确认无误后再删除：
DELETE FROM period_reflections
WHERE user_id = '<your_user_id>'
  AND period_type = 'monthly'
  AND period_start < '2025-11-01';
```

3) 前端重新生成“当前周期”卡片
- 进入 `/dashboard/echos`，切换到 Monthly，点击 “Refresh current period”；
- 我们已修正刷新锚点逻辑：若列表顶部不是“进行中”卡，则以内“今天”为锚点生成当期月卡（本地月界）；
- 同理，如需纠正周卡，切换到 Weekly 点击刷新。

4) 验证结果
```sql
-- 新的“本月”卡应为 period_start = 本地当月 1 号
SELECT period_type, period_start, period_end, last_generated_at
FROM period_reflections
WHERE user_id = '<your_user_id>'
  AND period_type = 'monthly'
ORDER BY period_start DESC
LIMIT 3;
```

注意事项
- 建议只清理 `period_reflections` 中错误的周/月卡；`daily_summaries` 为日粒度基表，不需要删除。
- 执行 `DELETE` 前务必用 `SELECT` 预览同一 WHERE 条件，确保删除目标正确。
- 代码层面我们已将周期边界改为“本地时区”，后续再生不会再跨月/跨周。

### Build Failed: metadata in client component

**Error**
```
x You are attempting to export "metadata" from a component marked with "use client"...
```

**Cause**：`/dashboard/journals/stats/page.tsx` 是客户端组件 (`'use client'`)，仍导出 `metadata`。

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

**Cause**：`cleanStats` 返回 `Record<string, unknown>`，无法赋值给 supabase `Json` 类型；`updatePayload`/`upsertPayload` 未显式使用 Supabase 类型。

**Fix**（节选）
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

> 提示：若未来更换模型，确保 `MODEL_NAME` 与 Supabase JSON 类型同步更新。

### Build Failed: Sentry client `beforeSend` type mismatch

**Error**
```
Type error: Type '(event: Sentry.Event) => Sentry.Event' is not assignable to type '(event: ErrorEvent, hint: EventHint) => ErrorEvent | PromiseLike<ErrorEvent | null> | null'.
```

**Cause**
- `src/instrumentation-client.ts` 复用了服务端 `scrubEvent`（`Sentry.Event` 签名），但浏览器 SDK 期望 `beforeSend` 的参数为 `ErrorEvent`。
- `next build`（husky pre-push）会重新运行 TS 检查，即使编辑器未报错仍会阻塞 push。

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
- 本地执行 `pnpm run build`，确认通过；之后 husky pre-push 也能成功。
- 服务端 `src/instrumentation.ts` 保持 `Sentry.Event` 签名即可，无需同步修改。

## 修正思路与示例代码（Diff）

本节记录我们对“录音→转写→日总结→Echos 同步”链路的修正方案，并提供可直接参考的代码 Diff（基于现有代码库）。

### A. 将“日总结 + Echos 同步”改为后台异步，缩短前端等待

原因：保存音频与 transcripts 成功后即可返回成功。日总结与 Echos 生成是增值操作，不应阻塞主链路。

涉及文件：`src/app/api/transcribe/route.ts`、`src/app/api/generate-daily-summary/route.ts`

示例 Diff：

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

### B. 统一“今天”的时间窗口（避免时区错乱）

原因：客户端之前用 `toISOString().split('T')[0]` 计算今日边界，默认 UTC 日界，容易与本地/Studio 显示不一致。建议统一使用“本地 00:00:00–23:59:59.999”，转换为 ISO 再查询。

涉及文件：`src/lib/supabase/queries.ts`

示例 Diff（变更）：

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

### C. 反思卡片的 JSON 解析加固（防止空 content/数组 content）

原因：LLM 可能返回空字符串，或 `content` 是分片数组；直接 `JSON.parse(choices[0].message.content)` 会抛错。

涉及文件：`src/lib/reflections/generator.ts`

示例 Diff（建议变更，展示 daily 以及 period 两处）：

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

> 注：若未来切换到 GPT‑5，建议整体改用 Responses API，并据其返回结构提取 `output_text` 或 `output[*].text`，再做 JSON 校验。

---

以上变更可以逐步采纳：A（已实现）提升响应速度；B、C（建议）用于消除时区与 JSON 边界问题，提升稳定性与可观测性。

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
