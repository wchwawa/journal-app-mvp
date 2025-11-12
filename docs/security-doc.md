# Security Hardening Notes

本文档面向安全审计与学术汇报，记录 2025-11-11 之后在 EchoJournal WebApp 中实施的关键防护策略。每个章节都阐述：**威胁背景 → 改进理由 → 具体实现 → 验证方式**，以便将来复现、评估或扩展。除特别说明外，路径均为仓库根目录相对路径。

---

## 1. 攻击面与改动总览

| 风险类别 | 主要受影响资产 | 改动位置 | 防护要点 | 为什么值得投入（影响面/概率） |
| --- | --- | --- | --- | --- |
| 数据层越权（Row-Level Security） | Supabase `audio_files`、`transcripts`、`daily_summaries`、`period_reflections` | Supabase RLS Policy（详见 §2） | 所有查询/写入均要求 `user_id = auth.uid()` | 每条语音/转写都包含隐私数据，一旦被其他租户读取即构成无法挽回的泄漏。没有 RLS，任何拿到匿名密钥的人都能遍历全表。 |
| CSRF / 跨站请求伪造 | 所有写接口（Journal/NLP/Agent） | `src/lib/security.ts` + 各 `route.ts` | 检查 `Origin/Referer` 与 `Host` 是否匹配，不匹配直接 403 | 我们依赖 Clerk Cookie 维持会话，浏览器自动带 Cookie 的特性使 CSRF 成为高概率事件；攻击者可在第三方页面伪造请求篡改情绪/语音数据。 |
| 无约束文件上传 | `/api/transcribe` | `src/app/api/transcribe/route.ts` | 文件大小 25MB、MIME 白名单、统一错误响应 | Whisper/GPT 链路昂贵且耗时，错误文件会浪费 Token 或触发异常；更糟的是，可被用来上传恶意 payload 试图绕过存储策略。 |
| 日志与可 observability 泄露隐私 | API 控制台、Sentry | `src/app/api/*`, `src/instrumentation*.ts` | 日志仅记录长度/统计；Sentry beforeSend 脱敏并在 PROD 禁用 Replay | EchoJournal 记录心理/健康信息，任何日志残留原文都违反隐私合规且难以追踪。一旦事故发生，后果不可逆。 |
| 鉴权旁路误用 | Next.js 中间件 | `src/middleware.ts`, `env.example.txt`, `docs/troubleshooting.md` | 新增 `DEV_DISABLE_AUTH`（私有变量 + 仅 dev 生效） | 旧的 `NEXT_PUBLIC_DISABLE_ALL_AUTH` 只要被误写到生产 `.env` 即导致全站裸露，真实概率高（CI/CD 配置复杂）。 |
| 供应链漂移 | OpenAI Realtime SDK | `package.json`, `pnpm-lock.yaml` | 将 `@openai/agents` 固定为 0.3.0 | 实时语音模块依赖实验性 SDK，若自动升级，前端即刻崩溃。 |
| 资源滥用 / 成本型 DoS | Whisper + GPT 调用 | 规划中（§8） | 设计 userId+IP 令牌桶限流 | 语音转写每分钟收费、且多次重试会拖垮后端。没有速率限制，单用户就可无意或恶意耗尽预算。 |

---

## 2. Supabase Row-Level Security（RLS）

### 2.1 风险背景
EchoJournal 是多租户隐私产品，用户上传语音并生成 NLP 摘要。若数据库层没有强制隔离，只需一个匿名 API key，攻击者就能 SELECT 所有行。API 层虽然由 Clerk 保护，但任何“服务端 Bug / 错误查询”都可能越权。RLS 能在数据库本身施加“谁只能看到自己的行”的硬约束，是满足 GDPR/CCPA “least privilege” 与“数据最小可访问集合”的根基。

### 2.2 现有策略
Supabase 上的核心表已启用 RLS，并配置了类似以下策略（示意）：

```sql
alter table public.audio_files enable row level security;

create policy "Audio owners can CRUD" on public.audio_files
  for all
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);
```

同样的策略应用于：
- `public.transcripts`（通过 `user_id` 和 `audio_id` 双重约束）
- `public.daily_summaries`
- `public.period_reflections`

根据 2025-11-11 的 Supabase MCP 检查，核心表 RLS 现状如下：

| 表 | RLS 状态 | 备注与调用方式 |
| --- | --- | --- |
| `audio_files` | ✅ Enabled | 仅作者可读写。所有查询/播放都通过服务端 API (`/api/audio/[id]`) 使用 Service Role。 |
| `transcripts` | ✅ Enabled | 仅作者可读写；依赖音频外键。转写生成在 `/api/transcribe` 内完成，客户端不直接访问。 |
| `daily_summaries` | ✅ Enabled | 日总结/日卡数据，浏览器端通过 `/api/journals/list` 等服务端入口获取。 |
| `period_reflections` | ✅ Enabled | 周/月卡数据，所有 CRUD 由 `/api/reflections/*` 处理。 |
| `daily_question` | ⛔ Disabled | 目前仍由客户端直接写入（低风险表），未来若迁移到服务端 API，再启用 RLS。 |

### 2.3 代码协同
- 前端只使用匿名 Supabase 客户端（`src/lib/supabase/client.ts`），即便被篡改也只能访问自己的行。
- 服务端 API 若需批量操作，使用 `createAdminClient`（`src/lib/supabase/admin.ts`）并在业务层再次校验 `userId`，从而实现“最小权限 + 胶水层二次校验”。

### 2.4 验证
- 运行 `supabase mcp list_tables` 可看到所有核心表 `rls_enabled: true`。
- 在匿名上下文执行 `select * from daily_summaries` 只会返回当前用户数据；尝试插入其他 user_id 会被拒绝。

### 2.5 安全集缺记录（2025-11-11）
- **情境**：Dashboard Journals 曾在浏览器端直接用匿名 Supabase 客户端查询 `daily_summaries`/`transcripts`。启用 RLS 后，这类无身份请求会被策略过滤成空结果，团队一度通过“临时关闭 RLS”来恢复显示。
- **改进**：新增 `/api/journals/list`（`src/app/api/journals/list/route.ts`）让所有列表查询在服务器端执行，并使用 service role + Clerk 身份校验。前端 `JournalListPage` 只调用此 API，从而保持 RLS 长期开启。
- **意义**：记录该缺口，提醒后续所有读取 RLS 数据的模块都必须经过受信的 API / Server Action，而不是直接暴露匿名 Supabase 查询。

---

## 3. CSRF 防护（Host/Origin 校验）

### 3.1 实现
- 新增 `src/lib/security.ts`：`isTrustedOrigin(request)` 将 `request.headers.host` 视作期望值，优先匹配 `Origin`，若为空再比较 `Referer`。两者都缺失（如服务器内部调用）时默认允许。
- 所有写接口（Transcribe、Generate Summary、Journals PUT/DELETE、Reflections CRUD、Agent Tools POST）都在处理逻辑前调用该 helper，不符合条件立即 `return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })`。

### 3.2 为什么必须如此
- 语音日记是 Cookie 会话，浏览器会自动带上 Cookie；攻击者只需在第三方站点嵌入 `<form action="https://echojournal.com/api/transcribe">` 就能让受害者上传恶意音频或删除记录。
- Origin 检查是浏览器级最可靠的 CSRF 防线，不依赖额外 token，适合集合 Clerk/Next.js 的架构。

### 3.3 验证
使用 `curl -H "Origin:https://evil.com" -X POST https://.../api/transcribe`，返回 403 并记录拒绝日志。

---

## 4. 语音上传输入校验

### 4.1 实现
- `src/app/api/transcribe/route.ts`
  1. 体积限制：`audioFile.size > 25MB` 直接 400。
  2. MIME 白名单：`Set(['audio/webm','audio/wav','audio/x-wav','audio/wave','audio/mpeg','audio/mp3','audio/ogg'])`，缺失或不在集合内 → 400。
  3. 日志只记录文件名、大小与字符长度，不打印歌词/文字。
  4. 之后才调用 Whisper/GPT，并在成功后异步触发每日总结与 Echos 同步（业务逻辑保持不变）。

### 4.2 改进价值
- 避免用户上传 `.txt`/`.zip` 时出现模糊错误，降低客服负担。
- 防止利用大文件填满 Storage 或触发 OpenAI 错误，间接造成成本失控。

### 4.3 验证
`curl -F "audio=@/tmp/1.txt;type=text/plain" https://.../api/transcribe` → 400 `Unsupported audio format`。

---

## 5. 日志与监控脱敏

### 5.1 API 层
- `src/app/api/transcribe/route.ts` & `src/app/api/generate-daily-summary/route.ts`
  - 删除 `transcription.substring(0, 100)` 等原文日志。
  - 现仅输出：记录数量、字符长度、用户 ID（内部 ID，不包含 PII）。

### 5.2 Sentry
- `src/instrumentation.ts`
  - `sendDefaultPii = process.env.NODE_ENV !== 'production'`，生产禁用。
  - `beforeSend` 删除 Authorization 头、Cookies、`request.data`。
- `src/instrumentation-client.ts`
  - 生产环境禁用 Replay（`replaysSessionSampleRate=0`）。
  - 与服务端一致的 `beforeSend`，确保任何前端错误也不会泄露 token。

### 5.3 为什么值得投入
- 语音/心理健康数据若在日志中出现，相当于自建“未加密的数据湖”，即使没有外部攻击，也违反隐私法规。
- Sentry Replay 在生产中录屏意味着真实用户输入会被传到第三方，隐私风险远高于 bug 价值。

### 5.4 验证
- Dev 环境触发错误，可在 Sentry 查看 header/data 已被剥离；切换至 prod 配置后，不再生成 Replay 事件。

---

## 6. 鉴权旁路（仅限开发环境）

- `src/middleware.ts`：仅当 `NODE_ENV === 'development'` 且 `process.env.DEV_DISABLE_AUTH === 'true'` 时，中间件才跳过 `auth.protect()`。
- `env.example.txt` & `docs/troubleshooting.md` 更新使用指引，强调“不要在生产环境配置”。

### 改进价值
原有 `NEXT_PUBLIC_DISABLE_ALL_AUTH` 是公开变量，任何部署脚本或日志泄露都可能被人利用在生产关掉 Auth。本次改动将“旁路”范围缩小到本地开发，并需要服务器变量配合，最大程度降低误操作风险。

---

## 7. 依赖版本锁定

- `package.json`：`"@openai/agents": "0.3.0"`。
- `pnpm-lock.yaml`：同步记录版本哈希，确保 `pnpm install` 不会拉取最新。

### 改进价值
Realtime Agent SDK 更新频繁且不保证向后兼容；曾出现过 `session.voice` 参数导致 API 报错的案例。锁定版本能避免生产突然崩溃，同时让升级变成有意识的决策。

---

## 8. 速率限制（待实施的安全控制）

虽然当前尚未在代码层实现限流，但我们已经明确其必要性并设计实现路径，以便下一阶段开展：

1. **威胁模型**：无限调用 `/api/transcribe` 或 `/api/generate-daily-summary` 会消耗 Whisper/GPT Token，攻击者可以借此进行“成本型 DoS”。同时，重复触发可能导致 Supabase 连接池耗尽。
2. **目标策略**：
   - 按 `userId` + `IP` 组合限流，使用滑动窗口或令牌桶，阈值例如“每小时 60 次转写”。
   - 当达到阈值时立即返回 429，并在前端弹出提示，引导用户稍后再试或升价位。
   - 实现位置可以是 Next.js Middleware + KV/Redis，也可以在 Supabase Edge Function 里中转。
3. **学术意义**：速率限制不仅是工程手段，更是“资源公平性 + 安全隔离”的体现，可用于定量分析成本/安全 trade-off。

---

## 9. 验证 Checklist

1. **RLS**：在匿名 Supabase Client 中执行 `select * from daily_summaries`，仅能看到当前会话用户的数据；尝试插入其他 `user_id` 被拒绝。
2. **CSRF**：使用自定义 `Origin` 调用任一写接口 → 403。
3. **上传校验**：上传非音频文件 → 400 `Unsupported audio format`。
4. **日志脱敏**：检查 Cloud logs/Sentry，不应出现原始转写文本或 Authorization 头。
5. **Auth Bypass**：在 dev 设置 `DEV_DISABLE_AUTH=true` 能绕过登录；删除后需登录。在线环境始终受保护。
6. **依赖锁定**：`pnpm install` 后 `pnpm list @openai/agents` 仍为 0.3.0。
7. **速率限制（上线后）**：脚本连续调用 API 超过阈值时得到 429，并且后台不再触发 OpenAI 请求。

---

## 10. 后续路线

1. **实现速率限制**：按照 §8 方案优先保护 `/api/transcribe`，并在文档中记录阈值与告警方式。
2. **CSRF 自动化**：考虑把 `isTrustedOrigin` 提炼为中间件，未来新增 API 自动套用防护，减少人工遗漏。
3. **更细粒度的 Sentry 脱敏**：对 `request.body` 进行字段级过滤，例如脱敏 `summary`、`mood_reason` 等字段，只保留长度/哈希。
4. **RLS 审计**：定期运行脚本验证所有新表默认启用 RLS，并记录在本文件中。

如需新增安全措施，请继续遵循“威胁 → 改进理由 → 实现细节 → 验证”结构，保持可追溯性与可量化性。***
