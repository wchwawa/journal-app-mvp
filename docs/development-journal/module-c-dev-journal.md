# Module C Development Journal

## 1. Overview
- **Module**: Voice-native AI Companion (Echo)
- **Goal**: 提供 Siri-like 语音体验，用户按下悬浮球即可与 Echo 对话，Echo 能读取结构化日记数据并给出情绪支持。
- **Scope**: 临时密钥颁发、WebRTC Realtime 会话、工具调用(`fetch_user_context`、`web_search`)、push-to-talk UI。

## 2. Architecture & Flow
### 2.1 Component Stack
| 层级 | 位置 | 说明 |
| --- | --- | --- |
| API (token) | `src/app/api/agent/token/route.ts` | 使用 OpenAI SDK 生成 Realtime session 并返回 `ek_...` 临时密钥。 |
| API (tools) | `src/app/api/agent/tools/{context,search}` | Echo 的 function tool 落地实现。 |
| Hook | `src/hooks/use-voice-agent.ts` | 管理 RealtimeSession、push-to-talk、工具注册。 |
| UI | `src/components/agent/*` | 全站可见悬浮球 + 控制面板。 |

### 2.2 Data & Tools
- **结构化数据**来自 Supabase：`daily_summaries`、`daily_question`、`period_reflections`。
- **工具**：
  - `fetch_user_context` → `/api/agent/tools/context` → `fetchUserContext()`。
  - `web_search` → `/api/agent/tools/search` → OpenAI Responses + `web_search` 工具，带每日 5 次限额。

### 2.3 Interaction Flow
1. UI 打开面板 → `connect()` 请求 `/api/agent/token?voice=<id>`。
2. 后端调用 `openai.beta.realtime.sessions.create({ model })`，返回 `session.client_secret.value`。
3. 前端创建 `RealtimeAgent` + `RealtimeSession`，`connect({ apiKey: token, url: https://api.openai.com/v1/realtime?model=... })`。
4. Echo 发起 `tool_call` → 前端执行 fetch → 返回结果 → SDK 自动继续对话。
5. Push-to-talk 通过 `session.mute` 控制录音，10 分钟计时器超时自动断开。

## 3. Implementation Highlights
### 3.1 临时密钥 & Auth
```ts
// src/app/api/agent/token/route.ts
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const session = await openai.beta.realtime.sessions.create({ model: REALTIME_MODEL });
return NextResponse.json({ token: session.client_secret.value, model: REALTIME_MODEL, voice: voiceProfile.voice });
```
- 保持最简请求体，只传 `model`。
- voice 仅用于 UI 展示；真正生效的 voice 由 RealtimeAgent 指定。

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
- 降级到旧版 SDK 后需要显式设置 `url`，否则可能命中默认 `/v1/realtime/calls` 导致 SDP 解析失败。
- push-to-talk 通过 `session.mute(true/false)` 控制录音；`session.on('audio_start'|'audio_stopped')` 更新 UI。

### 3.3 工具端点
- `/api/agent/tools/context` 调 `fetchUserContext()`，返回 summaries/mood/reflections。
- `/api/agent/tools/search` 调用 `openai.responses.create({ tools: [{ type: 'web_search' }] })`，附带每日 5 次限额（`search-quota.ts`）。
- 两个端点均用 Clerk auth + Supabase admin client，限制为当前用户。

## 4. Debug Log & Lessons Learned
| 问题 | 原因 | 解决 |
| --- | --- | --- |
| `Unknown parameter: 'session.voice'` / `'model'` | 直接调用 `client_secrets` 并传入不被接受的字段。 | 改用 SDK `sessions.create({ model })`，只传 `model`。 |
| `Unknown parameter: 'session.type'` | `@openai/agents-realtime@0.3.x` 在 `session.update` 中包含已弃用字段。 | 将 `@openai/agents(-realtime)`、`openai` 降级到 0.0.10 / 5.8.2（与 sample 对齐）。 |
| `Failed to parse SessionDescription. { Expect line: v= }` | `connect()` 未指定 URL，返回 JSON 错误。 | `connect({ apiKey, url: 'https://api.openai.com/v1/realtime?model=...' })`。 |
| Zod: `.optional()` without `.nullable()` | 旧 SDK 需要 optional+nullable。 | schema 使用 `nullable().optional()`，并在执行前删除 null 字段。 |
| Tool 422 `Expected object, received null` | payload 中包含 `range: null`。 | 发送前删除 null 字段。 |
| `getInitialSessionConfig is not a function` | 0.0.10 SDK 无此 API。 | 移除调试调用。 |
| `today`/`recent` 错位（返回前一天数据） | 统一时区在 UTC->local 截断时产生偏差，`scope === 'today'` 仍按 `start.slice(0,10)` 过滤。 | 当 scope 为 today 时改用 `eq('date', anchorDate)`；同时在系统 prompt 中插入“当前日期/时区”以便 Echo 做 date reasoning。 |
| Echo 无法正确理解 “上周”“昨天” | 模型不知道“当前日期”和“用户时区”，会将 `scope` 填错。 | 在 `buildVoiceAgentInstructions()` 中追加 `Today is ${anchorDate} (Australia/Sydney).`，并在工具文档中说明如何设置 `anchorDate` / `range`。 |
| 面板关闭后 session 仍运行导致超时 | Dialog 关闭时没有调用 `disconnect()`，会话继续运行直至超时报错。 | 在 `VoiceAgentPanel` 的 `onOpenChange` 中拦截关闭事件，若 session 仍 active 则立即 `disconnect()`。 |

### 4.1 Date & Time Reasoning Notes
- **症状**：`scope: today` 时返回了 11/09 与 11/10 的 summary；`recent` anchorDate 也落后 1 天，Echo 回答 “上周” 时直接复述本周内容。
- **分析**：`getLocalDayRange()` 默认使用 `Australia/Sydney`，但我们在 “today” 查询中仍使用 `start.slice(0,10)`（UTC）过滤 `daily_summaries`。悉尼 11/11 的 UTC 起点是 11/10T13:00Z，因此 SQL 变成 `date >= '2025-11-10'`。
- **修复**：
  ```ts
  if (payload.scope === 'today') {
    const { data } = await client
      .from('daily_summaries')
      .select('*')
      .eq('date', anchor); // anchor = getLocalDayRange().date
  }
  ```
  同时在系统提示里注入 `Today is ${anchor} (Australia/Sydney).`，让模型在调用工具时能算对 `anchorDate` 与 `range`。
- **结果**：`scope: today` 只返回 11/11 记录，`recent` anchorDate 对齐当前日期，Echo 在回答 “上周/昨天” 时会主动设置工具参数。

## 5. Current Status (2025-11-10)
- ✅ 临时密钥颁发 / WebRTC 连接 / push-to-talk 完整可用。
- ✅ Echo 可读取结构化日记（若数据库有数据）并调用搜索。
- ✅ UI 支持 7 种 voice profile，移动端悬浮球吸附。
- ⚠ 数据若为空，Echo 会返回空数组，需要后续在工具层做提示或 Seed 数据。

## 6. Next Steps
1. 丰富工具语义：自动识别“昨天”“本周”等 scope → range。
2. 为 `/api/agent/tools/context` 添加 mock/seed 数据，便于展示。
3. 关注官方 SDK 更新（修复 `session.type`），未来再升级。
4. 进一步记录用户对话日志（匿名化）以便调试 Echo 行为。
- ✅ 关闭面板/跳转页面时自动断开 Realtime session，避免后台超时。
