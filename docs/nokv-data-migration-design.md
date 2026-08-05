# EchoJournal 数据层 → NoKV 迁移最终设计

> 状态:FINAL(synthesis of RECON A/B/C + 3 proposals + 2 judges)
> 日期:2026-08-05 · 目标提交路径:`docs/nokv-data-migration-design.md`
> 前置阅读:`docs/nokv-integration-design.md`(voice-session 集成,本设计复用其 MCP 客户端层)

**决议**:采纳 P1(journal-workbench,双评审一致第一)为骨架 —— 每用户单一长驻 workbench、**每条目独立文档**(结构性消灭并发丢条目)、日文档三块结构、create-only 闩保护用户编辑。嫁接三处最优落选项:P2 的**月分片账本**(替换 P1 单索引文件)与 **summary.txt grep sidecar**(keyword 检索与 ilike 语义精确对齐)、P2 的契约测试先行 + 切换闸门 + 夜间导出 cron、P3 的**确定性 event_id 幂等重试**(化解超时重试双写陷阱)。同时落实评审两处必改:**search/aggregate 的 path 谓词值必须带 section 前缀**(查询行 path = `outputs/days/...` 全路径,`query_records.rs:497` 实证);**无过滤 totalCount 改由账本折叠给出**(aggregate 数 `days/` 会把 mood-only 日文档计入,与 Supabase 只数 `daily_summaries` 行不平)。预估 80 小时。

---

## 0. 设计所依赖的已验证 NoKV 事实(main @ 90883d1353;实现时不必重读 NoKV 文档)

以下每条均经源码核实,是本设计的公理。任何一条被上游改变都需重审对应小节。

| # | 事实 | 出处 |
|---|---|---|
| F1 | 契约 18 工具,**无任何 delete/rename/move/upsert**;section 是冻结枚举 `input/scripts/outputs/logs/metadata` | `workbench_contract_schema.json` |
| F2 | `put_file`:create-only(`replace:false`,冲突报 PathExists)XOR replace-only;**replace 无调用方 CAS**(adapter 内部 stat→ReplaceOnly,纯 LWW);无 `index_fields` 参数 | `facade.rs:826-843` |
| F3 | `append`:generation CAS + adapter 重试(`--max-attempts` 默认 3),对不存在的 path 自动创建;**MCP 面唯一无丢失更新的写原语** | `artifact.rs:481-514,2390` |
| F4 | `edit`:`old_string` 精确串匹配 = 调用方乐观锁,冲突 adapter 内置 5 次重读重试;多处命中报 AmbiguousEdit;`required:[id,section,path,old_string,new_string]` | `facade.rs:889-977` |
| F5 | `read`:`format:'structured'`(JSON object 体 = **1 条 json_object record**,一次调用整取)或 `'bytes'`(每次 ≤300 字节,媒体不可用);structured 分页用 **cursor,不接受 offset**(offset 仅 bytes);`if_none_match:<generation>` 得 304;读前整体校验 body ≤ max_artifact_bytes(默认 16MiB),**超限文件"只写不可读"** | `facade.rs:1063-1088,2061` |
| F6 | `grep`:`required:[id,pattern,recursive]`,大小写不敏感字面量(非 regex,≤16 patterns),`glob` 只匹配 basename 且**在读 body 之前过滤**,limit≤300,cursor 分页,仅 UTF-8 | `facade.rs:1091-1207` |
| F7 | `search` limit≤10、`aggregate` limit≤100(**measures 每项 required `name`+`op`**)、`list` limit≤100(非递归、仅直接子项)、`read`/`grep` limit≤300;search/aggregate/grep 均有顶层 `section`+`path`(section 内前缀)作用域参数;**谓词 `field:'path'` 的值 = 含 section 的全路径**(如 `outputs/days/2026-08-05.json`);可查询字段仅 8 个内置(path/logical_size/content_type/generation/body_digest_uri/manifest_id/producer/workbench_id);main 上查询是全扫描(SecondaryIndex 只写不读) | schema + `query_records.rs:37-46,497`、`query.rs:993-1048` |
| F8 | 替换/墓碑后**旧 revision 不保留**:强引用归零→GcCandidate→`nokv serve` 的 LifecycleRunner 物理删 S3 字节;无版本历史读取 API;**commit 永久钉住 revision 且 commit 行不 GC** | `publication.rs:4767-4807`、contract.md:126-127,186 |
| F9 | 空载荷合法(`text:""`)⇒ 0 字节墓碑经 MCP 真实可行 | parse_payload |
| F10 | 核心已实现 generation-fenced 单路径原子删除 `RemovePathRequest`,**未暴露到 MCP/CLI 面** | `remove.rs:41-57`、`sdk.rs:339-345` |
| F11 | CLI 一次性通道:`nokv <conn flags> materialize <wb> <section> <path> <dest>`(无 300B 分页);`nokv <conn flags> --workbench-root <root> [--max-artifact-bytes N] collect <wb> <section> <source-file> <path> [--replace] [--content-type <ct>]`(进程内读本地文件直发 put_file,不走 stdio 大行)。collect/mcp 要求 `--workbench-root`;conn flags = mcp-client.ts `mcpArgv()` 现有那套(`--metadata-address/--root-id/--object-*/etcd 路由`) | `main.rs:142-191`、`cli.rs:95-108,365,437-485` |
| F12 | stdio MCP server 逐行**串行**处理(大调用队头阻塞);现 `CALL_TIMEOUT_MS=5000`;**客户端超时 ≠ 服务端失败**(写入仍会完成,重试撞 AlreadyExists) | `workbench_mcp.rs:50`、`mcp-client.ts:31` |
| F13 | Holt 的 ChangeEvent/History **当前格式永不截断**(含路径/尺寸/digest 投影);workbench 不可删(Visible→Retired 非法)、id 永不复用 | metadata-schema.md:408-411,506-512 |
| F14 | append/edit/put 的 CAS 仲裁在 shard owner 元数据命令层,**跨进程安全**(两个 Next dev worker 各自 spawn mcp 子进程也正确) | metadata-schema.md:514-553 |

---

## 1. 架构总览

```
                    ┌─ 常驻 `nokv mcp` stdio 子进程(现 mcp-client.ts,复用)
                    │    全部文档/账本/sidecar/墓碑操作;per-call 超时参数化
Next.js API routes ─┤
  (全部服务端;     └─ 一次性 CLI 子进程(新 blob-cli.ts)
   浏览器 anon           音频 blob 专用:collect / materialize,60s 超时,信号量 2
   client 全部收编)
        │
   JournalDataRepository(接口)
        ├─ SupabaseRepository(现状封装,回退保底)
        └─ NokvRepository ── 读模型 = 账本折叠(fold-first)+ 文档点读
                             写模型 = 三原语(create-only / append / 块级 edit)
```

四条设计公理:

1. **每用户一个长驻 workbench** `jr-{clerkUserId}`(Clerk id 满足 `^[A-Za-z0-9_-]+$` 且 <128B,构造时校验,失败即拒绝该用户的 NoKV 路径)。wbId 由服务端 Clerk `auth()` 派生,**不需要** voice-session 的 HMAC ref(那是给会出服务端边界的 ref 用的);错误分类助手(isPathExists/isNotFound/isCasConflict)照抄 `session-workspace.ts`。
2. **jr-\* workbench 永不 commit、永不 snapshot**(F8:否则墓碑-GC 删除失效)。与 voice-session 工作台用法**刻意相反**,repo 层加工具 allowlist 硬禁,防复制粘贴。
3. **一切业务维度编码进 path**(F7:MCP 面无自定义索引字段):日期进路径、entryId 自携带日期。`days/YYYY-MM-DD.json` 的字符串序 = 日期序。
4. **"一天"的定义** = `APP_TIMEZONE`(默认 Australia/Sydney),一律经 `src/lib/timezone.ts` 的 `getLocalDayRange/getUtcRangeForDate`;迁移前先修 `aggregate.ts:76-77/118-119` 的裸日期界(Phase 2),保证两后端共享同一天定义。

---

## 2. Workbench 文件布局与 JSON Schema

```
jr-{clerkUserId}/
├─ metadata/
│  ├─ profile.json                          # create-only 初始化标记
│  ├─ legacy_ids.json                       # Supabase uuid → 定位键;回填一次性写入后冻结;进程内按 generation 缓存
│  ├─ deleted.json                          # deleteAllUserData 标记(存在 ⇒ repo 全读路径返回空)
│  └─ latches/
│     ├─ day-{YYYY-MM-DD}.edited            # create-only 编辑保护闩(0 字节即可)
│     └─ period-{type}-{YYYY-MM-DD}.edited
├─ input/
│  └─ audio/{YYYY-MM-DD}/{entryId}.webm     # 音频 blob;create-only;删除=0 字节墓碑;只经 blob-cli 读写
├─ outputs/
│  ├─ days/{YYYY-MM-DD}.json                # 日文档(mood ⊕ summary ⊕ reflection 三块)
│  ├─ entries/{YYYY-MM-DD}/{entryId}.json   # 条目文档(audio_files ⊕ transcripts 折叠,FK 消灭)★每条目一文件
│  ├─ text/{YYYY-MM-DD}/summary.txt         # keyword 检索 sidecar(替换=replace:true,派生物)
│  └─ reflections/{weekly|monthly}/{periodStart}.json
└─ logs/
   └─ ledger/{YYYY-MM}.jsonl                # append-only 月账本(按事件 date 的月份分片;派生读模型,可全量重建)
```

**entryId** = `e{YYYYMMDD}T{HHMMSS}-{8hex}`,其中 `YYYYMMDD` = APP_TIMEZONE 本地日(即桶日)。任何 by-id 路由 substring 取日期直达文档与 blob,**零全局索引**。legacy Supabase uuid 走 `legacy_ids.json`。

### 2.1 条目文档 `echojournal.entry.v1`

```jsonc
// outputs/entries/{date}/{entryId}.json — create-only 创建;此后仅 transcript 块可 edit
{
  "schema": "echojournal.entry.v1",
  "id": "e20260805T143210-8f3a2b1c",
  "legacy_audio_id": null,                  // 回填条目 = Supabase audio_files.id
  "user_id": "user_...",
  "date": "2026-08-05",
  "created_at": "2026-08-05T04:32:10.123Z",
  "audio": {
    "path": "audio/2026-08-05/e20260805T143210-8f3a2b1c.webm",   // input section 内相对路径
    "mime_type": "audio/webm", "size_bytes": 812345,
    "duration_ms": null, "deleted": false
  },
  "transcript": {
    "text": "...", "rephrased_text": "...", "language": "en",
    "updated_at": "2026-08-05T04:32:10.123Z"
  }
}
```

### 2.2 日文档 `echojournal.day.v1`

顶层必须是 JSON object(F5:structured 读 = 单 record 一次整取)。**三个顶层块永远存在**(骨架即含 `"mood": null` 等占位),使一切后续写都是 `workbench_edit` 块替换,无 create/edit 分叉竞态。app 层守卫:序列化后 >4MiB 拒写(远低于 16MiB 读悬崖)。

```jsonc
// outputs/days/{date}.json
{
  "schema": "echojournal.day.v1",
  "user_id": "user_...", "date": "2026-08-05", "tz": "Australia/Sydney",
  "mood": {                                  // ← daily_question;或 null
    "day_quality": "good", "emotions": ["calm","focused"],
    "created_at": "ISO", "updated_at": "ISO",
    "legacy_id": null
  },
  "summary": {                               // ← daily_summaries 的 summary 列组;或 null
    "text": "...", "entry_count": 3, "mood_quality": "good",
    "dominant_emotions": ["calm"], "generated_at": "ISO", "updated_at": "ISO"
  },
  "reflection": {                            // ← daily_summaries 的反思列组;或 null
    "achievements": [], "commitments": [], "mood_overall": null, "mood_reason": null,
    "flashback": null, "stats": {}, "gen_version": 0, "last_generated_at": null,
    "edited": false, "legacy_id": null       // legacy_id = Supabase daily_summaries.id
  }
}
```

### 2.3 周期反思文档 `echojournal.period_reflection.v1`

```jsonc
// outputs/reflections/{type}/{periodStart}.json
{
  "schema": "echojournal.period_reflection.v1",
  "id": "weekly:2026-08-03",                 // 派生键;serialize.ts 的 recordId 承接
  "legacy_id": null,
  "user_id": "...", "period_type": "weekly",
  "period_start": "2026-08-03", "period_end": "2026-08-09",
  "achievements": [], "commitments": [], "mood_overall": null, "mood_reason": null,
  "flashback": null, "stats": {}, "edited": false, "gen_version": 1,
  "last_generated_at": "ISO", "updated_at": "ISO"
}
```

唯一约束对照:`daily_question` 一人一天一条、`daily_summaries (user_id,date)`、`period_reflections (user_id,type,period_start)` —— 全部由 **path 唯一性免费获得**,且比现状(mood 唯一性仅靠应用逻辑)更强。

### 2.4 月账本 `echojournal.ledger.v1`(JSONL,每行一事件)

content_type `text/plain` ⇒ structured 读返回 text_lines、每行一 record、**cursor** 分页 ≤300/页(F5)。分片键 = 事件 `date` 的月份(旧日期的补写落旧分片,靠 generation 缓存失效感知)。重度用户 ~600KB/月,距 16MiB 两个数量级;防呆:append 前若缓存态显示分片 >4MiB → 轮转 `{YYYY-MM}-b.jsonl`。

```jsonc
{"v":1,"event_id":"evt_01J...","ts":"ISO-UTC","kind":"entry_created","date":"2026-08-05","entry_id":"e2026...-8f3a2b1c"}
{"v":1,"event_id":"...","ts":"...","kind":"entry_deleted","date":"2026-08-05","entry_id":"..."}
{"v":1,"event_id":"...","ts":"...","kind":"mood_set","date":"2026-08-05","day_quality":"good","emotions":["calm"]}
{"v":1,"event_id":"...","ts":"...","kind":"summary_written","date":"2026-08-05","mood_quality":"good","entry_count":3}
```

**event_id 纪律(P3 嫁接,化解 F12 超时陷阱)**:每个 repo 写操作调用开始时生成一次 ULID,**同一调用内的所有重试复用同一 event_id**;回填/对账用确定性派生 id(`evt_sb_{table}_{uuid}` / `evt_rc_{kind}_{key}`)。折叠时按 event_id 去重 ⇒ 超时后盲重 append 无害。

**折叠规则(纯函数 `fold.ts`)**:
- `liveEntries(date)` = entry_created − entry_deleted(event_id 去重后)
- `mood(date)` = 最后一条 mood_set
- `summary(date)` = 最后一条 summary_written(presence + mood_quality + entry_count)

**折叠态消费方**:queryJournalDays 的日期基集/**精确 totalCount**/mood 过滤(mood_quality 取自 summary_written = 与 Supabase `.in('mood_quality')` 扫 `daily_summaries` 的语义**精确对齐**,评审必改项 b)、listDailySummaries{,InRange} 的日期枚举、listMoodsInRange、getEntryStats(total/thisWeek/streak)。折叠态进程内缓存:`Map<shard, {generation, folded}>`,读带 `if_none_match`,304 即复用;旧月分片实践上不变,缓存命中率极高。

账本是**派生物**:可由 `list(outputs, 'days/')+list(outputs,'entries/{d}/')+read` 全量重建(`scripts/nokv-reconcile.ts`),丢事件只影响过滤视图与统计,不影响点读。

### 2.5 keyword sidecar

`outputs/text/{date}/summary.txt` = 当日 summary 纯文本,每次 summary 写入后 `put_file replace:true` 同步(派生物,LWW 无害)。keyword 检索 = `grep glob:'summary.txt'`,与现状 **ilike 只扫 summary 列**的语义精确对齐(P1 原方案 grep 日文档 JSON 会误命中键名/emotions,评审弃)。transcript 级全文检索留作后续增强(现状 `searchJournals` 是死代码,不做即 parity)。

---

## 3. 序列化纪律(块级并发模型的地基)

`src/lib/nokv/journal-doc.ts` 提供唯一的确定性序列化器:固定键序、2 空格缩进、UTF-8、尾无空白。导出 `serializeDoc(doc)`、`extractBlock(text, key)`(返回从 `\n  "{key}":` 起至配对闭合的完整字节段,含前导缩进)、`replaceBlock(...)`。

**唯一性论证**(AmbiguousEdit 免疫):`old_string` 恒以 `\n  "mood":` 这类"换行 + 2 空格 + 顶层键名"开头;JSON 字符串值内的换行必被转义为 `\n` 两字符,真实换行字节不可能出现在字符串值中,故该模式只能出现在顶层,全文唯一。单测锁死"序列化→提取→edit→再解析"的字节往返稳定性。

---

## 4. TypeScript 仓储接口(exact signatures)

```ts
// src/lib/data/repository.ts —— 领域类型脱离 @/types/supabase;
// DailySummary/PeriodReflection 字段名保持 Tables<'daily_summaries'>/Tables<'period_reflections'> 形状,
// serialize.ts、mood-utils.ts 与全部 UI 组件零改动。

export type YmdString = string; // "YYYY-MM-DD" in APP_TIMEZONE

export interface MoodEntry {
  id: string; date: YmdString; day_quality: string; emotions: string[];
  created_at: string; updated_at: string;
}
export interface JournalEntry {
  id: string; legacy_audio_id: string | null; date: YmdString; created_at: string;
  audio: { mime_type: string; size_bytes: number; duration_ms: number | null; deleted: boolean };
  transcript: { text: string; rephrased_text: string | null; language: string; updated_at: string };
}
export interface DailySummary { /* Tables<'daily_summaries'> 形状;id = legacy uuid 或 `daily:{date}` */ }
export interface PeriodReflection { /* Tables<'period_reflections'> 形状;id = legacy uuid 或 `{type}:{period_start}` */ }
export interface DayBundle { date: YmdString; summary: DailySummary | null; entries: JournalEntry[]; mood: MoodEntry | null; }
export type PeriodType = 'weekly' | 'monthly';

export class NokvUnavailableError extends Error {}   // transport null → 抛出;工厂层据此回落/503

export interface JournalDataRepository {
  // ── mood(覆盖 recon 操作 34/35/36/37/12/20/22/32/33)
  getMood(userId: string, date: YmdString): Promise<MoodEntry | null>;
  upsertMood(userId: string, date: YmdString,
             input: { dayQuality: string; emotions: string[] }): Promise<MoodEntry>;
  listMoodsInRange(userId: string, start: YmdString, end: YmdString): Promise<MoodEntry[]>;

  // ── 条目(覆盖 1-10/11/15/38/40;39 listRecentEntries 死代码,删除不进接口)
  createEntry(userId: string, input: {
    audio: Buffer; mimeType: string; transcript: string;
    rephrasedText: string | null; language: string;
  }): Promise<JournalEntry>;
  getEntry(userId: string, entryId: string): Promise<JournalEntry | null>;
  getAudioBlob(userId: string, entryId: string): Promise<{ data: Buffer; mimeType: string } | null>;
  updateRephrasedText(userId: string, entryId: string, text: string): Promise<JournalEntry>;
  deleteEntry(userId: string, entryId: string): Promise<void>;
  listEntriesForDay(userId: string, date: YmdString): Promise<JournalEntry[]>;
  getEntryStats(userId: string): Promise<{ totalEntries: number; thisWeekEntries: number; currentStreak: number }>;

  // ── 日总结(覆盖 13/17/18/19/21/23/30/31/32/33)
  getDailySummary(userId: string, date: YmdString): Promise<DailySummary | null>;
  upsertDailySummary(userId: string, date: YmdString, fields: {
    summary: string; entryCount: number; moodQuality: string | null; dominantEmotions: string[];
  }): Promise<DailySummary>;
  updateDailySummaryReflection(userId: string, date: YmdString,
    patch: Partial<Pick<DailySummary, 'achievements'|'commitments'|'mood_overall'|'mood_reason'|'flashback'|'stats'|'gen_version'|'last_generated_at'>>,
    opts: { markEdited?: boolean; preserveIfEdited?: boolean }): Promise<DailySummary>;
  listDailySummaries(userId: string, opts: { before?: YmdString; limit: number }): Promise<DailySummary[]>;
  listDailySummariesInRange(userId: string, start: YmdString, end: YmdString): Promise<DailySummary[]>;
  queryJournalDays(userId: string, filters: {
    startDate?: YmdString; endDate?: YmdString; moods?: string[]; keyword?: string;
    page: number; limit: number;                       // limit ≤ 50(route 钳制不变)
  }): Promise<{ days: DayBundle[]; totalCount: number }>;   // totalCount 三条过滤路径下均精确

  // ── 周期反思(覆盖 24/25/26/27/28/33)
  getPeriodReflection(userId: string, type: PeriodType, periodStart: YmdString): Promise<PeriodReflection | null>;
  getPeriodReflectionById(userId: string, id: string): Promise<PeriodReflection | null>;
  upsertPeriodReflection(userId: string, type: PeriodType, periodStart: YmdString, periodEnd: YmdString,
                         fields: Partial<PeriodReflection>): Promise<PeriodReflection>;
  updatePeriodReflectionFields(userId: string, id: string, patch: Partial<PeriodReflection>): Promise<PeriodReflection>;
  listPeriodReflections(userId: string, type: PeriodType, limit: number): Promise<PeriodReflection[]>;

  // ── 隐私(新能力)
  deleteAllUserData(userId: string): Promise<void>;
}
```

工厂 `src/lib/data/index.ts`:`getJournalRepo()` 读 `DATA_BACKEND`(`supabase` 默认 | `shadow` | `nokv`)。

---

## 5. 方法级 NoKV 映射(wb = `jr-{userId}`;所有调用经 `mustCallWorkbenchTool`,除音频走 blob-cli)

**repo 基元**:
- `readDoc(sec,p)` → `workbench_read {id, section:sec, path:p, format:'structured', if_none_match?}` → records[0];NotFound→null。
- `editBlock(sec,p,key,newBlock)` → 循环≤3:readDoc → `workbench_edit {id, section:sec, path:p, old_string:extractBlock(text,key), new_string:newBlock}`;失配/冲突→重读重试;**绝不降级整文档 replace**(评审判定 P2 的该降级是丢更新洞)。
- `appendLedger(ev)` → `workbench_append {id, section:'logs', path:'ledger/{ev.date月}.jsonl', text: line+'\n', content_type:'text/plain'}`;失败重试复用同一 event_id。
- `latch(p)` → `workbench_put_file {id, section:'metadata', path:p, replace:false, text:''}`;PathExists 视为成功。
- `foldState()` → 逐月分片 structured read(cursor 翻页)+ 缓存折叠(§2.4)。

| 方法 | 调用序列(精确参数) |
|---|---|
| **getMood** | readDoc(outputs, `days/{d}.json`) → `.mood`;null 安全 |
| **upsertMood** | 日文档不存在 → put_file `{section:'outputs', path:'days/{d}.json', replace:false, text:骨架(含mood)}`(PathExists→重读走 edit);存在 → editBlock(mood);然后 appendLedger mood_set |
| **listMoodsInRange** | foldState() → 范围内 mood_set 折叠(月窗 ≤2 分片读,通常缓存 304);**不读日文档** |
| **createEntry** | ① 校验 blob ≤25MB → tmpfile → blob-cli collect(`input`, `audio/{d}/{id}.webm`, `--content-type`);超时→`workbench_stat {id, section:'input', path:...}` 验证,存在即成功 ② put_file entries 文档 `replace:false` ③ 若当日日文档不存在 → put_file 骨架 `replace:false`(PathExists 容忍) ④ put_file sidecar 占位不需要;appendLedger entry_created。②失败⇒①成孤儿 blob(不可见,reconcile 墓碑化) |
| **getEntry** | id 前缀解析日期(uuid → legacy_ids.json)→ readDoc(outputs, `entries/{d}/{id}.json`);user_id 双验 |
| **getAudioBlob** | getEntry(deleted→null)→ 磁盘 LRU 缓存(键 = stat 的 body_digest_uri)→ 未命中:blob-cli materialize(`input`, path, tmpfile)→ 读→响应→unlink |
| **updateRephrasedText** | editBlock(entries 文档, transcript 块);照旧 fire-and-forget 触发 summary 再生 |
| **deleteEntry** | ① editBlock:`audio.deleted=true` + transcript 置空(骨架保留供对账) ② put_file `{section:'input', path:'audio/{d}/{id}.webm', replace:true, text:''}` 墓碑→GC 物理删字节(F8/F9) ③ appendLedger entry_deleted。原 FK 三步顺序删消失 |
| **listEntriesForDay** | `workbench_list {id, section:'outputs', path:'entries/{d}/', limit:100}` → 逐条 readDoc → 过滤 deleted → 按 entryId 升序(时间戳前缀即时序) |
| **getEntryStats** | foldState() → totalEntries=Σ liveEntries;thisWeek=本周日期(timezone.ts 定界)求和;streak=自今日 desc 走 liveEntries>0 连续段。对账交叉验证(reconcile 脚本用,非热路径):`workbench_aggregate {id, section:'input', path:'audio/', measures:[{name:'n', op:'count'}], predicates:[{field:'logical_size', op:'gt', value:0}, {field:'path', op:'prefix', value:'input/audio/'}]}` —— 注意谓词 path 值带 `input/` 前缀(F7) |
| **getDailySummary** | readDoc 日文档 → summary+reflection 投影为 DailySummary 形状(id = reflection.legacy_id ?? `daily:{d}`) |
| **upsertDailySummary** | 骨架保障(同 upsertMood)→ editBlock(summary 块;**不触 reflection 块** = 现状"只写 summary 列"的列级语义)→ put_file `{section:'outputs', path:'text/{d}/summary.txt', replace:true, text:纯文本}` → appendLedger summary_written {mood_quality, entry_count} |
| **updateDailySummaryReflection** | markEdited(用户 PATCH):latch(`latches/day-{d}.edited`)→ editBlock(reflection,edited:true)。preserveIfEdited(后台再生):`workbench_stat {id, section:'metadata', path:'latches/day-{d}.edited'}` → 存在则合并保留用户字段 → editBlock(reflection)。**create-only 闩把"再生覆盖用户编辑"从时间窗漏洞变成硬保证** |
| **listDailySummaries** | foldState() → summary 日期 desc,`< before` 过滤,取 limit → 逐日 readDoc(≤30 点读) |
| **listDailySummariesInRange** | foldState() → 范围内 summary 日期 asc → 逐日 readDoc(月窗 ≤31 读;mood 同文档,比现状少一次 join) |
| **queryJournalDays** | ① foldState() → 基集 = 有 summary 的日期(**与 Supabase 数 daily_summaries 行精确平账**,评审必改项 a)② 过滤:date range 字符串比较;moods → summary.mood_quality ∈ moods;keyword → `workbench_grep {id, section:'outputs', path:'text/', pattern:kw, glob:'summary.txt', recursive:true, limit:300, cursor…}` 收齐命中(千日 ≤4 页)→ 路径 `text/{date}/summary.txt` 提取日期集 → 交集 ③ totalCount = 过滤后集合大小(**三条路径全精确,分页 UI "Page X of Y" 不降级**)④ desc 切页 → 每日 readDoc 日文档 + listEntriesForDay 组装 DayBundle。每页 ≈12-40 次本地 MCP 调用 vs 现状 1+2N=21 次 SQL |
| **getPeriodReflection** | readDoc(outputs, `reflections/{type}/{start}.json`) |
| **getPeriodReflectionById** | `{type}:{start}` 解析直读;uuid → legacy_ids.json |
| **upsertPeriodReflection** | 不存在 → put_file `replace:false`;PathExists → stat `latches/period-{type}-{start}.edited` → 合并 → **全文档 edit**(old=整份旧文本,new=整份新文本 = 调用方 CAS 的 RMW,冲突重读重试 ×3) |
| **updatePeriodReflectionFields** | latch(`latches/period-{type}-{start}.edited`)→ 全文档 edit |
| **listPeriodReflections** | `workbench_list {id, section:'outputs', path:'reflections/{type}/', limit:100}` → 名字符串 desc 排序取 limit(≤12)→ 逐个 readDoc(list 升序仅列名,量级十级,一页足够;不必动用 search) |
| **deleteAllUserData** | 见 §8 |
| **agent context(30-33)** | 全部组合上述方法 + 请求级 memo:today=1 点读+list;recent=fold+20 点读;custom/week/month=InRange+getPeriodReflection。本地 stdio 毫秒级/次,语音预算 <150ms 内 |

**路由级变更**:新增 `GET/PUT /api/mood/today`、`GET /api/journals/today`、`GET /api/journals/stats`(收编浏览器 anon 触点 34-40;`use-today-mood.ts`、`use-audio-journal.ts`、`daily-mood-modal.tsx` 改 fetch,顺手清偿 memory 挂账的 anon-read 风险)。改造为走 repo:transcribe、audio/[id]、journals/{list,[id]}、generate-daily-summary、reflections/×6、agent/tools/context。删死代码:`queries.ts` getDailySummary(L325-348)、searchJournals(L358-392)、hook 的 recentEntries。window 事件刷新机制与 UI 层零改动。

---

## 6. 音频策略

- **写**:`blob-cli.ts` 一次性子进程 `nokv <connFlags> --workbench-root <root> --max-artifact-bytes 27262976 collect jr-{uid} input <tmpfile> audio/{d}/{id}.webm --content-type audio/webm`(**参数顺序:wb → section → 本地源文件 → 目标 path**,cli.rs 实证;不加 `--replace` = create-only)。60s 超时,并发信号量 2。25MB 上限保留并在 collect 前强校验(26 MiB 旗标之内;**超过 max-artifact-bytes 的文件"只写不可读"是硬悬崖**,F5)。
- **读**:`nokv <connFlags> materialize jr-{uid} input audio/{d}/{id}.webm <tmpfile>` → 流式响应 → unlink;digest 键磁盘 LRU 缓存,重复播放零 NoKV 调用。无真 Range(现状 `Accept-Ranges` 也是假的,不劣化)。
- **为什么不走常驻 MCP**:16MiB 默认上限 + 5s 超时 + 逐行串行队头阻塞 + read bytes 每次 300 字节(F5/F12)四重冲突。
- **明确不做 S3 直写侧门**:对象键含发布分配的 artifact_revision_id,绕过发布状态机的字节在元数据里永不可见(object-layout.md:79-81)——契约违规且功能不可行。
- 常驻 mcp 进程的 `mcpArgv()` **不改** max-artifact-bytes(文档域 ≤4MiB 守卫已足够)。

---

## 7. 并发规则(全部可变状态收敛为三原语,不发明锁)

| 原语 | 用途 | 保证 |
|---|---|---|
| `put_file replace:false` | 条目/骨架/闩/blob 创建;唯一约束 | 原子插入;AlreadyExists = 幂等成功(配 stat 验证覆盖超时陷阱 F12) |
| `workbench_append` + event_id | 账本 | 无丢失更新(F3);去重覆盖盲重 |
| `workbench_edit` 块级/全文档 | 一切可变文档字段 | 调用方乐观锁(F4);冲突=被检测,重读重试 ×3,耗尽→操作失败上抛(再生类下次触发追平) |
| `put_file replace:true` | **仅派生物**(sidecar、墓碑)与回填 | LWW,可由权威文档重建,无害 |

- **禁止**:对权威文档做 read→mutate→put replace(F2 无调用方 CAS = 静默丢更新);对 jr-* 调 commit/snapshot(mcp-client 外包 allowlist 硬禁)。
- 结构性免疫:条目 = 独立 create-only 文档 ⇒ 并发录音互不接触;日文档三块独立 ⇒ 跨块并发(entry 追加期间 summary 再生)互不覆盖,等价 Postgres 列级更新。
- 编辑保护:create-only 闩(§5)⇒ "再生覆盖用户编辑"方向是**硬保证**,严格优于现状 Supabase 的 read-check-upsert 竞态窗口(generator.ts:245-250)。
- 跨进程:CAS 仲裁在 shard owner(F14),两个 dev worker 各自 mcp 子进程安全。
- 无事务的诚实账:createEntry 3-4 写、deleteEntry 3 写各有 crash 窗口 → 孤儿 blob / 账本漏事件。点读路径不受影响;过滤视图与统计由 `scripts/nokv-reconcile.ts` 自愈(list 对账 fold,补确定性 event_id 事件、墓碑孤儿)。日记写率(个位数/用户/天)下概率极低且全部可修复。

---

## 8. 删除与隐私(诚实版)

- **单条删除**:文档 edit 置 deleted + blob/sidecar 0 字节墓碑 → 旧 revision 强引用归零 → GcCandidate → `nokv serve` 的 LifecycleRunner **物理删除 S3 字节**(F8;GC 依赖 serve 常驻运行 = 部署清单项)。读端过滤 `deleted:true` / `logical_size==0`。
- **全账户删除** `deleteAllUserData`:逐 section `workbench_list` cursor 下钻(list 非递归)→ 每路径 0 字节墓碑 → 写 `metadata/deleted.json` 标记(repo 全读路径短路返回空)。
- **残留(必须写进隐私政策)**:① MCP 面无 delete 工具(F1),墓碑后 **path 条目仍在**;② Holt 的 ChangeEvent/History 当前格式永不截断,路径名/尺寸/digest 投影无限期保留(F13);③ workbench 本身不可删、id 不复用(F13)。诚实表述 = "内容字节被物理删除;文件名与技术元数据痕迹保留"。
- **上游反哺项(本集成最有说服力的贡献回路)**:把已实现未暴露的 `RemovePathRequest`(F10)暴露为 `workbench_remove` 工具 + CLI 子命令 —— 两仓同属 NoKV-Lab。合并后 deleteAllUserData 升级为真删除并补删历史墓碑路径;**落地前 Supabase 侧删除故事保留**,且不对外宣传"彻底删除"。
- 防呆再强调:jr-* 一旦 commit,revision 永久钉住、墓碑失效(F8)—— allowlist 是安全机制而非风格偏好。

---

## 9. DATA_BACKEND 切换与回退

`DATA_BACKEND=supabase(默认)| shadow | nokv`。失败语义:`callWorkbenchTool` 返回 null(runtime disabled)在数据主存路径**升级为 NokvUnavailableError**,绝不沿用 voice-session 的静默降级;
- `shadow`:主读写 Supabase;写路径影子双写 NoKV(失败仅 console.error,**此处** fail-silent 恰当);读路径异步比对 NoKV 结果,结构化 diff 落日志。
- `nokv`:读写全走 NoKV;NokvUnavailableError 时**读**回落 SupabaseRepository(双写保鲜故不缺数据),**写**返回 503 让客户端重试(双主写脑裂比短暂不可用更糟);删除路径继续双删 Supabase。
- 回滚:P4 之前任意时刻拨回 `supabase` 即回滚;停双写之后需先跑反向同步(消费账本事件回放进 Supabase 的脚本,随附)。

**回填脚本 `scripts/backfill-nokv.ts` 提纲**(service-role 读 Supabase;全 create-only ⇒ 重跑天然幂等):

```
for each user:
  workbench_create jr-{uid}(AlreadyExists 容忍)→ metadata/profile.json(create-only)
  1. audio_files ⋈ transcripts 按 created_at asc,经 timezone.ts 分本地日:
     storage.download → tmpfile → blob-cli collect(已存在且 size 相符则跳过)
     → entries/{d}/{newId}.json create-only(legacy_audio_id=uuid;PathExists=已回填,跳过)
  2. daily_question / daily_summaries → days/{d}.json 骨架+块(create-only 后按需 edit)
     edited=true 的行 → 补 latches/day-{d}.edited;summary → text/{d}/summary.txt
  3. period_reflections → reflections/{type}/{start}.json + 闩
  4. metadata/legacy_ids.json:{audio:{uuid→{date,entry_id}}, daily:{uuid→date}, period:{uuid→{type,period_start}}}
  5. 重建账本:确定性 event_id=evt_sb_{table}_{uuid},按时间序 append 进对应月分片
  6. 尾校验(不平打印 diff 清单、exit 非零):
     aggregate count(input/audio, logical_size>0, path prefix 'input/audio/') == count(audio_files)
     days 有 summary 的文档数 == count(daily_summaries);reflections 数 == count(period_reflections)
     随机抽样 N 天 deep-diff + 5% 音频 digest 逐字节比对
切 shadow 之后再跑一次(尾部增量补偿),diff 清零才算完成。
```

---

## 10. Parity 切换闸门(全绿才允许 DATA_BACKEND=nokv → 停双写)

1. 契约测试套件(vitest,P1 期建立于 SupabaseRepository)在两个实现上同绿;
2. shadow diff 连续 7 天零差异(逐 route 金样对比);
3. 三张计数平账(entries / summary 日 / reflections)+ 5% 音频 digest 抽样;
4. 25MB 上传→播放 e2e(collect/materialize 通路 + LRU 缓存命中);
5. keyword/mood/日期过滤的页内容与 **totalCount** 双后端相等(同关键词命中日期集合相同);
6. streak / thisWeek 逐用户与 SQL 版本一致;
7. 并发折磨:双 worker 并行「录音 + summary 再生 + 用户 PATCH」→ 零丢 entry、用户编辑字段零丢失(闩生效);
8. 删除条目 → 列表/统计/grep 三视图同步消失,GC 后确认 S3 对象删除;
9. legacy uuid 深链(历史 /api/audio/[id]、period PATCH)经 legacy_ids 可达;
10. 停机演练:kill mcp 子进程 → 读回落 Supabase、写 503,无 5xx 级联;
11. 语音 agent 四个 scope 的 context 输出形状相等;
12. 夜间导出 cron(逐用户 materialize 全部 outputs 文档到备份位)已上线并成功跑 3 晚(P2 嫁接,补偿 PITR 缺失)。

---

## 11. 诚实声明:比 Postgres 变差之处

1. **部署拓扑变硬**(最大风险):无 JS SDK,一切经 `NOKV_BIN` 子进程 ⇒ 永别 serverless/Vercel,必须容器/常驻 Node + Rust 二进制;本地开发 = etcd+minio+`nokv serve` 三件套(docker-compose 化,README 置顶声明)。二进制与冻结 schema 需钉版本。
2. **无版本历史、无 PITR**:replace/墓碑后旧 revision 立即进 GC,误写不可恢复(jr-* 又禁 snapshot)。缓解:editBlock 不做整文档 replace、entries 收缩守卫、迁移期 Supabase 双写即热备、此后夜间导出 cron。这是全设计最尖的一根刺。
3. **隐私删除不彻底**(§8):字节可删,元数据痕迹永存,workbench 不可删;上游 workbench_remove 落地前如实披露。Postgres 里这是一条 DELETE。
4. **并发从行锁降为检测-重试**:同块竞争败者重试 ×3 后失败上抛;sidecar 是 LWW。净性质不劣于现状(现状本就是无锁读改写),且 edited 保护变硬,但心智模型更复杂。
5. **读放大与全扫描**:列表页 12-40 次串行本地 MCP 调用(现状 21 次 SQL,非量级回退);grep O(文件数×body);main 上 search/aggregate 是全扫描(F7)。单实例几十用户安然;上千用户需上游索引寻径(NoKV 已在加 read-amplification 诊断,已知路线)。这是展示 NoKV 的 app,不是通用后端 —— 如实标注。
6. **音频冷路径 +100-300ms**(spawn + S3 全量下载),缓存命中后归零;无真 Range(不劣化)。
7. **crash 窗口**:多写操作无事务,孤儿 blob / 账本漏事件靠 reconcile 自愈;过滤视图在自愈前可短暂漏最新条目(点读不受影响)。
8. **16MiB 读悬崖守卫是纪律**:日文档 4MiB 守卫、账本月分片+轮转、音频 25MB 前置校验 —— 三处都必须存在,漏一处 = 数据"只写不可读"。
9. **运维面变窄**:无 SQL 控制台/BI,排障靠 nokv CLI 与脚本。
10. **fold 正确性是应用代码**:折叠规则有向后兼容负担;但与事件溯源方案(P3)不同,本设计账本是**派生物可全量重建**,fold 变更 = 重建账本,不构成永久性历史解释负担。

---

## 12. 分阶段实施计划

**Phase 1 — 仓储接缝(一个工作 session 可落地;独立可发布)**
`src/lib/data/{repository.ts, supabase-repository.ts, index.ts}`:接口 + 领域类型(§4)+ SupabaseRepository(机械收编 queries.ts 与 12 个 route 的内联查询,行为零变化)+ `DATA_BACKEND` 工厂;12 个 route + 4 个共享库(queries/aggregate/generator/context)改为消费 repo;同 PR 删死代码(queries.ts:325-392、recentEntries)。验收:vitest 全绿、全路由行为不变。**此阶段建立契约测试套件**(跑在 SupabaseRepository 上,即后续 NoKV 实现的验收基准)。

**Phase 2 — 浏览器触点收编 + 时区统一**
新 3 路由(GET/PUT /api/mood/today、GET /api/journals/{today,stats});3 个客户端文件改 fetch;从客户端 bundle 移除 `NEXT_PUBLIC_SUPABASE_*`;aggregate.ts 裸日期界统一走 timezone.ts。清偿 anon-read 挂账风险。

**Phase 3 — NoKV 管道**
mcp-client.ts:`callWorkbenchTool(name, args, {timeoutMs})`(默认 5s;文档 15s、grep/账本读 10s)+ `mustCallWorkbenchTool`(null→NokvUnavailableError)+ jr-* 工具 allowlist(禁 commit/snapshot);`blob-cli.ts`(§6);`journal-doc.ts` 序列化器(往返字节稳定单测);`ledger/{events,fold}.ts`(fold 单测:event_id 去重、双序 edited 皆胜、月分片轮转)。附 spike:grep 对 CJK/JSON 转义关键词在 summary.txt 上的召回验证(退路已备:sidecar 是纯文本,无 JSON 转义问题)。

**Phase 4 — NokvRepository 全量实现**
§5 全部方法;契约测试套件跑 mock MCP(tests/mocks 已有基建)+ 本地整栈集成(etcd+minio+nokv serve,env 门控跳过);重点用例 = 闸门清单 §10 的 5/7/8/9。

**Phase 5 — 回填 + 影子双写**
`scripts/backfill-nokv.ts`(§9)+ `scripts/nokv-reconcile.ts` + `DATA_BACKEND=shadow` 跑 1-2 周;尾部增量补偿回填。

**Phase 6 — 切换**
`DATA_BACKEND=nokv`(读回落/写 503 语义,§9);闸门 §10 全绿后停双写;夜间导出 cron 常态化。

**Phase 7 — 收尾**
Supabase 只读冻结 30 天 → pg_dump + Storage 归档 → 退役;移除 SupabaseRepository 与 @/types/supabase 运行时依赖;上游 PR:NoKV `workbench_remove`(暴露 RemovePathRequest),合并后升级 deleteAllUserData 为真删除并补删历史墓碑路径。

---

**关键文件(绝对路径)**
EchoJournal:`/Users/wangchanghao/journal-app-mvp/src/lib/nokv/{mcp-client.ts,session-workspace.ts}`、`src/lib/supabase/queries.ts`、`src/lib/timezone.ts`、`src/lib/reflections/{aggregate,generator,sync}.ts`、`src/lib/agent/context.ts`、`src/app/api/{transcribe,audio/[id],journals/list,journals/[id],generate-daily-summary,reflections/*,agent/tools/context}/route.ts`、`src/hooks/{use-audio-journal,use-today-mood}.ts`、`src/features/daily-record/components/daily-mood-modal.tsx`。
NoKV(main):`/Users/wangchanghao/NoKV/crates/nokv-agent/{src/facade.rs,workbench_contract_schema.json}`、`crates/nokv/src/{main.rs,cli.rs,backend.rs}`、`crates/nokv-meta/src/workspace/{query_records.rs,remove.rs,publication.rs}`、`docs/{workbench-contract,metadata-schema,object-layout}.md`。