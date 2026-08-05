# EchoJournal × NoKV 集成最终设计：Voice Session Workspace

**决议**：采纳 Proposal 2（agent-workspace，两位评审一致第一名），嫁接 Proposal 1 的 `NOKV_ENABLED` 主开关与三层降级模式、Proposal 3 的 fail-closed 路径校验；并落实评审发现的两个必改项：**客户端路由一律走 etcd**（静态路由存在 placement_generation/owner_epoch 栅栏陷阱：provision 后 generation=2 而 CLI 默认 1/1，且 owner_epoch 每次 server 重启 +1，静态配平必然反复失效），以及 **`nokv mcp` 长驻 stdio 子进程**作为唯一客户端通路（无 JS SDK，线协议是自定义 msgpack-over-TCP，不可从 Node 直连）。预估 12 小时。

---

## 1. 架构

每次语音会话 = 一个 NoKV Workbench，生命周期三段：

```
POST /api/agent/token ──────► after(): workbench_create(vs-{userId}-{uuid})
  响应新增 sessionRef                  + put_file(metadata/session.json, replace=false)
        │
tool 路由 ×N（带 x-echo-session 头）─► after(): workbench_append(logs/tool_calls.jsonl)
  （热路径零 NoKV 调用）                （generation CAS 保证有序）
        │
disconnect() → POST /api/agent/session/end (keepalive)
        └───────────────────► after(): put_file(outputs/final_message.md, replace=false)
                                       + workbench_commit（确定性 manifest → idempotent_replay 可演示）
```

**核心机制**：

- **Workbench id**：`vs-{clerkUserId}-{crypto.randomUUID()}`。写入前用 `^[A-Za-z0-9_-]+$` 且 ≤128 bytes 校验（Clerk id `user_...` 与 UUID 连字符均合法），不匹配则整个会话跳过 NoKV（fail-closed，不猜转义）。
- **sessionRef 防伪造**（无状态，serverless 安全）：`{wbId}.{HMAC-SHA256(userId + ":" + wbId, NOKV_SESSION_SECRET) 前 32 hex}`。服务端每次从 Clerk `auth()` 取 userId 重算并 `timingSafeEqual` 比对——sessionRef 无法跨用户挪用。
- **客户端通路**：单例长驻子进程 `spawn(NOKV_BIN, [...routing/object flags, 'mcp'])`，行分隔 JSON-RPC 2.0 over stdio（已核实 workbench_mcp.rs：`initialize` → `notifications/initialized` → `tools/call {name, arguments}`；结果在 `result.structuredContent`，失败时 `result.isError === true`；协议版本传 `"2025-06-18"` 即可）。单例挂在 `globalThis` 上防 Next dev 热重载重复 spawn。
- **热路径纪律（代码评审第一红线）**：两条 tool 路由被 realtime agent 同步 await，所有 NoKV 调用必须在 `import { after } from 'next/server'` 的 `after()` 回调内（transcribe route 已有此先例）。
- **有序性卖点**：`logs/tool_calls.jsonl` 用 `workbench_append`（create-when-missing + generation CAS），并发冲突适配器有界重试 2 次——这直接演示 "ordered shard-local metadata in Holt"。
- **确定性 commit（demo 高光）**：commit identity = sha256(workbench_id ‖ content_digest_uri ‖ manifest_digest_uri)，服务端时间戳不参与。因此 manifest 只由请求体字段构造（**禁止 `Date.now()`**）：`{schema:"echojournal.voice_session.run.v1", workbench_id, final_message_sha256, ended_reason}`；`content_digest_uri = "sha256:" + hex(sha256(canonicalJson(manifest)))`（canonicalJson = 递归按 key 排序的 compact JSON，与 NoKV 服务端算法一致）。同一 sessionRef+lastMessage 重放 → 服务端返回 `idempotent_replay=true`。`outputs/final_message.md` 的 `replace=false` 在重放时报 PathExists，适配器视为成功。
- **时序防御**：`after()` 不保证顺序，appendToolCall 若遇 workbench 不存在错误 → 补发 `workbench_create {id}`（AlreadyExists 视为成功）后重试一次。

**已核实的工具参数形状**（冻结 schema crates/nokv-agent/workbench_contract_schema.json）：
`workbench_create` required `[id]`；`workbench_put_file` required `[id,section,path]`，props 含 `text/base64/replace/content_type`；`workbench_append` required `[id,section,path]`；`workbench_commit` required `[id,manifest,content_digest_uri]`；`workbench_list` required `[id]`；`workbench_read` required `[id,section,path]`；`workbench_catalog` 无 required。

## 2. 环境变量（全部 server-only，严禁 NEXT_PUBLIC_）

追加到 `/Users/wangchanghao/journal-app-mvp/.env.example`（已核实文件名，**不是** env.example.txt）：

```bash
# ---- NoKV agent workspace (local showcase only; disabled by default) ----
NOKV_ENABLED=            # "true" 才启用；其余值/缺失 = 整体禁用
NOKV_BIN=                # /Users/wangchanghao/NoKV/target/release/nokv（必须现编）
NOKV_ROOT_ID=            # 32 位小写 hex
NOKV_ETCD_ENDPOINT=http://127.0.0.1:2379
NOKV_ETCD_KEY_PREFIX=/nokv/control
NOKV_OBJECT_ENDPOINT=http://127.0.0.1:9000
NOKV_OBJECT_BUCKET=echojournal-nokv
NOKV_OBJECT_ROOT=echojournal
NOKV_OBJECT_REGION=us-east-1
NOKV_OBJECT_ACCESS_KEY_ID=rustfsadmin      # RustFS 演示默认凭证
NOKV_OBJECT_SECRET_ACCESS_KEY=rustfsadmin
NOKV_WORKBENCH_ROOT=/agents/echojournal/wb
NOKV_SESSION_SECRET=     # openssl rand -hex 32；sessionRef HMAC 密钥
```

MCP 子进程 argv 映射（flag 名已对照 cli.rs 核实）：
`--root-id --etcd-endpoint --etcd-key-prefix --object-bucket --object-endpoint --object-root --object-region --object-access-key-id --object-secret-access-key --workbench-root` + 子命令 `mcp`。**不使用** `--metadata-address/--logical-shard-id/--placement-generation/--owner-epoch`（静态路由陷阱）。

## 3. 文件级实施计划（基于 /Users/wangchanghao/journal-app-mvp，行号已逐一核实）

**新增 4 个：**

1. **`src/lib/nokv/mcp-client.ts`**（~150 行）：文件头 `import 'server-only'`。导出 `isNokvEnabled()`（NOKV_ENABLED==='true' 且全部必需变量存在，进程内 memo）与 `callWorkbenchTool(name, args)`。内部：`globalThis.__nokvMcp` 单例；`node:child_process spawn` + `node:readline` 按行读 stdout；握手（initialize 带 `protocolVersion:"2025-06-18"`，收到 result 后发 `notifications/initialized` 通知）；自增 id 的 `tools/call`，每调用 5s 超时；`result.isError` 或超时即 throw；子进程退出（server 不在时 8 项 capability preflight fail-closed 会导致退出）→ 标记 runtime-disabled 30s 后允许重新 spawn，期间所有调用立即 no-op resolve——**绝不向路由抛错**。stderr 透传 console.error。

2. **`src/lib/nokv/session-workspace.ts`**（~150 行）：领域层，全部函数在 `isNokvEnabled()===false` 或 id 校验失败时静默返回。
   - `mintSessionRef(userId)` / `verifySessionRef(userId, sessionRef)`（node:crypto HMAC + timingSafeEqual）；
   - `createSessionWorkspace(sessionRef, meta)`：`workbench_create` + `put_file{section:'metadata', path:'session.json', text: canonicalJson({schema:'echojournal.voice_session.v1', user_id, voice_id, model, started_at}), content_type:'application/json', replace:false}`；
   - `appendToolCall(sessionRef, record)`：`workbench_append{section:'logs', path:'tool_calls.jsonl', text: JSON.stringify({schema:'echojournal.voice_session.toolcall.v1', tool, args, result_summary, duration_ms, ts}) + '\n'}`，CAS 冲突重试 ≤2，NotFound → create 后重试一次；
   - `commitSession(sessionRef, {lastMessage, endedReason})`：put_file `outputs/final_message.md`（replace=false，PathExists 视为成功；lastMessage 截断 8KB 并标注 client_reported）→ 按 §1 构造确定性 manifest 与 content_digest_uri → `workbench_commit`；
   - `canonicalJson()`：递归 key 排序、数组保序、compact。

3. **`src/app/api/agent/session/end/route.ts`**（~60 行）：照抄 token 路由守卫（`isTrustedOrigin` → Clerk `auth()`）；body zod 校验 `{sessionRef: string, lastMessage?: string(≤8192), endedReason?: enum['user_disconnect','timeout','error']}`；`verifySessionRef` 失败返回 403；立即返回 202，`after()` 内 `commitSession`（try/catch + console.error）。

4. **`docs/nokv-demo.md`**：§5 的命令手册 + 常见坑（metadata-reopen fail-closed、必须现编二进制、凭证在 argv 中 ps 可见）。

**修改 4 个：**

5. **`src/app/api/agent/token/route.ts`**：`auth()` 成功后（现 :20-24）生成 `wbId`/`sessionRef`；:56-61 的响应对象追加 `sessionRef`（`isNokvEnabled()===false` 时省略该字段）；`after(() => createSessionWorkspace(sessionRef, {userId, voiceId: voiceProfile.voice, model: REALTIME_MODEL, started_at}))`。新增 import `after`。

6. **`src/hooks/use-voice-agent.ts`**：新增 `const nokvSessionRef = useRef<string|null>(null)` 与 `const lastMessageRef = useRef('')`（**必须用 ref**：`disconnect` 的 useCallback 依赖数组只有 `[resetTimer]`，闭包拿不到最新 state）。:94 解构处收下 `sessionRef` 存 ref；:118-122 与 :143-147 两处 fetch 的 headers 在 ref 非空时追加 `'x-echo-session': nokvSessionRef.current`；:175-179 的 `agent_end` 里同步写 `lastMessageRef.current = output`；`disconnect()`（:51-63）内在 `sessionRef.current?.close()` 前：若 `nokvSessionRef.current` 非空则 `fetch('/api/agent/session/end', {method:'POST', keepalive:true, headers:{'Content-Type':'application/json'}, body: JSON.stringify({sessionRef, lastMessage: lastMessageRef.current, endedReason:'user_disconnect'})}).catch(()=>{})`，然后清空两个 ref。

7. **`src/app/api/agent/tools/context/route.ts`**：`request.headers.get('x-echo-session')` + `verifySessionRef`；:60 `return NextResponse.json({context})` 前注册 `after(() => appendToolCall(ref, {tool:'fetch_user_context', args: payload, result_summary:{entries: context.length ?? null}, duration_ms}))`。

8. **`src/app/api/agent/tools/search/route.ts`**：同上，在 :72（`recordSearchUsage` 后）注册 `after(() => appendToolCall(ref, {tool:'web_search', args:{query: payload.query}, result_summary:{results: N, remaining}}))`，两个 return 分支都覆盖。

不做（JIT）：应用内查看 UI（CLI 演示即证明，且对 NoKV 评估者更有说服力）；不修 search-quota 进程内 Map 既有缺陷；音频字节不进 NoKV。README roadmap 一句话指向 docs/nokv-demo.md 即可。

## 4. 降级行为（三层，fail-open for UX / fail-closed for data）

1. **配置层**：`NOKV_ENABLED !== 'true'` 或任一必需变量缺失 → 零子进程、token 响应无 sessionRef、hook 不带头不上报、tool 路由跳过 after 注册——应用行为与今天逐字节一致。
2. **运行层**：NoKV server 宕机/MCP 子进程退出/调用超时 → 一行 console.error，30s runtime-disabled 退避,所有用户响应不受影响（写入全部在响应已发出之后）。
3. **数据层**：只用 create-only put_file、CAS append、幂等 commit——失败不留半成品假象；丢一条轨迹可接受，不做持久重试队列。

## 5. 本地 NoKV 演示环境（精确命令）

```bash
# 1) 现编二进制（target/release 里是 7 月 18 日旧世代构建，对 main 不可用）
cd /Users/wangchanghao/NoKV && cargo build --release -p nokv --bin nokv

# 2) RustFS（docker, 127.0.0.1:9000, rustfsadmin/rustfsadmin）+ 建桶
bash scripts/lingtai-workbench/start_rustfs.sh
AWS_ACCESS_KEY_ID=rustfsadmin AWS_SECRET_ACCESS_KEY=rustfsadmin \
  aws --endpoint-url http://127.0.0.1:9000 s3 mb s3://echojournal-nokv

# 3) etcd
docker run -d --name nokv-etcd -p 2379:2379 quay.io/coreos/etcd:v3.5.17 \
  etcd --advertise-client-urls http://0.0.0.0:2379 --listen-client-urls http://0.0.0.0:2379

# 4) id 与置备
ROOT=$(openssl rand -hex 16); SHARD=$(openssl rand -hex 16)
./target/release/nokv --root-id $ROOT --etcd-endpoint http://127.0.0.1:2379 \
  --etcd-key-prefix /nokv/control provision $SHARD

# 5) 起服务（进程必须常驻：--metadata-reopen 当前 fail-closed，退出后须换新目录重新 provision）
./target/release/nokv --root-id $ROOT --etcd-endpoint http://127.0.0.1:2379 \
  --etcd-key-prefix /nokv/control \
  --object-bucket echojournal-nokv --object-endpoint http://127.0.0.1:9000 \
  --object-root echojournal --object-region us-east-1 \
  --object-access-key-id rustfsadmin --object-secret-access-key rustfsadmin \
  --bind 127.0.0.1:7750 --advertise-endpoint 127.0.0.1:7750 \
  --node-id echo-demo --metadata-create /tmp/nokv-echo-meta-$(date +%s) serve

# 6) EchoJournal：.env.local 填 §2 全部变量（NOKV_ROOT_ID=$ROOT），然后
cd /Users/wangchanghao/journal-app-mvp && pnpm dev
```

CLI 验证别名（demo 中反复使用，**etcd 路由**，与应用同参）：
```bash
alias nokvw='/Users/wangchanghao/NoKV/target/release/nokv --root-id $ROOT \
  --etcd-endpoint http://127.0.0.1:2379 --etcd-key-prefix /nokv/control \
  --object-bucket echojournal-nokv --object-endpoint http://127.0.0.1:9000 \
  --object-root echojournal --object-region us-east-1 \
  --object-access-key-id rustfsadmin --object-secret-access-key rustfsadmin \
  --workbench-root /agents/echojournal/wb workbench'
```

## 6. 测试计划

1. **单元（vitest，`pnpm vitest run` 并入现有 tests/）**：sessionRef mint/verify（正确、跨用户、篡改 wbId、格式非法）；canonicalJson 确定性（同对象不同 key 序 → 同字节）；content_digest_uri 稳定性；workbench id 白名单拒绝非法字符;isNokvEnabled 各缺失组合 → false。
2. **降级回归（手动）**：a) NOKV_ENABLED 缺失 → 完整语音会话 + 录音转写流程，行为与集成前一致，token 响应无 sessionRef；b) 会话中途 kill nokv serve → tool 调用仍正常返回，仅服务端一行 error，语音无卡顿；c) NOKV_BIN 指向不存在路径 → 首次调用后 runtime-disabled，无路由 5xx。
3. **热路径**：对比 NOKV 开/关下 `/api/agent/tools/context` 的响应耗时（应无统计差异）；代码评审确认所有 NoKV 调用均在 `after()` 内。
4. **端到端**：完整会话后用 `nokvw` 验证 catalog/list/read/append 顺序与 run_manifest（见 §7）；重放 end → `idempotent_replay=true`。
5. **NoKV 侧预检**：demo 前跑 `python3 scripts/lingtai-workbench/live_first_client.py --dry-run` 确认依赖齐全。

## 7. 10 分钟评审 Demo 脚本

- **[0:00–1:00] 定位**：EchoJournal 语音 agent 当前完全 ephemeral——会话结束什么都不剩。NoKV 把每次 agent 运行变成可审计、不可变、可提交的 workspace。诚实边界先讲明：本地单 shard、无调用方鉴权（裸 TCP 7750，故 NoKV 只作服务端私有依赖、bind 127.0.0.1）、NoKV 自述 "only the local boundary is executable"、Vercel 生产环境下该集成自动处于禁用态。
- **[1:00–3:30] 产生数据**：登录 EchoJournal → 开语音会话 → 问 Echo "我上周写了什么"（触发 fetch_user_context）→ 再问一个时事问题（触发 web_search）→ 挂断。
- **[3:30–6:30] NoKV 侧独立验证**（证明非应用自演）：
  `nokvw workbench_catalog '{}'` → 找到 `vs-user_xxx-<uuid>`；
  `nokvw workbench_read '{"id":"<wb>","section":"metadata","path":"session.json","format":"json"}'` → 会话元数据；
  `nokvw workbench_read '{"id":"<wb>","section":"logs","path":"tool_calls.jsonl","format":"text"}'` → 两条按序工具轨迹（指出 generation CAS 保证的有序性）；
  `nokvw workbench_read '{"id":"<wb>","section":"metadata","path":"run_manifest.json","format":"json"}'` → 提交的 manifest，含 caller 的 content_digest_uri 与服务端派生 tree_digest_uri。
- **[6:30–8:00] 高光——确定性重放**：用 curl 携带同一 sessionRef 重 POST `/api/agent/session/end` → 服务端日志/CLI 显示 `idempotent_replay=true`："durable run commits + deterministic retry" 现场兑现。
- **[8:00–9:00] 第二会话**：再开一次会话即出现第二个独立 workbench——workspace-per-agent-run 模型。
- **[9:00–10:00] 反证降级**：`.env.local` 去掉 NOKV_ENABLED 重启 dev → 应用照常、无 sessionRef、零 NoKV 代码路径；顺带杀掉 nokv serve 演示运行层降级只有一行 error。

## 8. 风险与诚实性声明（须写进 docs/nokv-demo.md 与演示话术）

1. **无鉴权是 NoKV 现状**：信任边界=网络层；任何把 7750 端口或 S3 凭证暴露给浏览器的改动都是安全事故。per-user 隔离靠 sessionRef HMAC + 服务端 Clerk 会话，绝不接受客户端指定 userId。
2. **`--metadata-reopen` fail-closed**：serve 进程退出即元数据目录作废，演示期间进程必须常驻；话术限定为"单次运行内 crash-consistent"，不宣传跨重启持久。
3. **owner_epoch 随 server 重启递增**：这正是弃用静态路由、全链路 etcd 路由的原因；文档中明确禁止改回静态 flags。
4. **keepalive 上报不保证送达**：lastMessage 标记 client_reported、限 8KB；丢失时 workbench 仍有 create/append 轨迹，只是无 commit——as-designed。
5. **凭证在子进程 argv 中 ps 可见**：本地 demo 可接受，文档注明。
6. **next dev 多 worker 各持一个 MCP 子进程**：合约层并发安全（create-only/append CAS），AlreadyExists 一律视为成功。

**关键路径汇总**：新增 `src/lib/nokv/mcp-client.ts`、`src/lib/nokv/session-workspace.ts`、`src/app/api/agent/session/end/route.ts`、`docs/nokv-demo.md`；修改 `src/app/api/agent/token/route.ts`、`src/hooks/use-voice-agent.ts`、`src/app/api/agent/tools/context/route.ts`、`src/app/api/agent/tools/search/route.ts`、`.env.example`（均位于 /Users/wangchanghao/journal-app-mvp）。