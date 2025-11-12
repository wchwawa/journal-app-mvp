## 11 Nov 2025 — Vitest smoke run

- **Command**: `pnpm vitest run`
- **Status**: ❌ Failed (3 suites)

| Suite | Result | Notes |
| --- | --- | --- |
| `tests/unit/moduleA/mood-utils.test.ts` | Failed | Vitest 无法解析 `@/lib/...` 路径别名（错误：`Cannot find package '@/lib/mood-utils'`）。 |
| `tests/integration/moduleB/generate-reflection.test.ts` | Failed | 同样的 alias 解析失败，导致无法加载 `@/lib/reflections/generator`。 |
| `tests/unit/moduleC/use-voice-agent.test.ts` | Failed | 无法找到 `@/hooks/use-voice-agent`。 |

### Diagnosis
- Next.js/TypeScript 在 `tsconfig.json` 里通过 `paths` 定义了 `@/*`，但当前 Vitest 运行未启用同样的别名（缺少 `vitest.config.ts` 或 `tsconfig.paths` 注入）。
- 因禁止修改配置/源码，保持原状仅记录结果。

### Suggested follow-up
1. 添加 `vitest.config.ts` 并通过 `alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }` 或 `tsconfigPaths()` 插件同步路径解析。
2. 重新执行 `pnpm vitest run` 以验证三套示例测试。

---

## 11 Nov 2025 — Vitest run (with alias config)

- **Config change**: 添加 `vitest.config.ts`，并安装 `vite-tsconfig-paths` 以同步 `@/`、`~/` 别名；测试环境设置为 `happy-dom`。
- **Command**: `pnpm vitest run`
- **Status**: ⚠️ 部分通过（2 通过，1 失败）

| Suite | Result | Notes |
| --- | --- | --- |
| `tests/unit/moduleA/mood-utils.test.ts` | ✅ Passed | 4 个断言全部成功。 |
| `tests/integration/moduleB/generate-reflection.test.ts` | ✅ Passed | Mock OpenAI/Supabase 路径执行正常。 |
| `tests/unit/moduleC/use-voice-agent.test.ts` | ❌ Failed | `useVoiceAgent.connect()` 期望新建 `RealtimeSession`；当前 Vitest mock 将 `RealtimeSession` 设为普通函数导致 `new RealtimeSession()` 抛出 “is not a constructor”。因此 hook 状态保持 `idle`，断言失败。 |

### Diagnosis
- Hook 依赖的 `RealtimeAgent`/`RealtimeSession` 是类构造函数；现有测试中用 `vi.mock('@openai/agents-realtime', () => ({ RealtimeSession: vi.fn(() => new FakeSession()) }))`，但 `RealtimeSession` 并未以 `class`/`function` 实现，因此 `new RealtimeSession()` 抛错。需要改写 mock（例如 `class FakeRealtimeSession { ... }` 并返回该 class）或在测试里提供真正的构造函数。

### Suggested follow-up
1. 更新 `tests/unit/moduleC/use-voice-agent.test.ts` 中对 `@openai/agents-realtime` 的 mock，确保 `RealtimeSession` 为可实例化的 class/function。
2. 再次运行 `pnpm vitest run` 确认 3 个套件全部穿过。

---

## 12 Nov 2025 — Vitest run (expanded suites)

- **New suites**:
  - `tests/unit/shared/timezone.test.ts`（覆盖 `getLocalDayRange`、`getUtcRangeForDate` 的 DST 行为）
  - `tests/unit/shared/security-origin.test.ts`（验证 `isTrustedOrigin` host/Referer 逻辑）
  - `tests/unit/moduleC/search-quota.test.ts`（验证每日 5 次配额 + 日期重置）
  - `tests/unit/moduleC/use-voice-agent.test.ts` mock 更新，确保 `RealtimeSession` 模拟为 class。
- **Command**: `pnpm vitest run`
- **Status**: ✅ 通过（6 suites / 14 tests）

| Suite | Result | Notes |
| --- | --- | --- |
| `tests/unit/moduleA/mood-utils.test.ts` | ✅ | Mood 工具函数。 |
| `tests/unit/shared/timezone.test.ts` | ✅ | 使用 Sydney 时区参数验证 DST/普通日期范围。 |
| `tests/unit/shared/security-origin.test.ts` | ✅ | 匹配/不匹配 Origin、Referer、空头信息场景。 |
| `tests/unit/moduleC/search-quota.test.ts` | ✅ | 配额递减 + 日期切换重置。 |
| `tests/unit/moduleC/use-voice-agent.test.ts` | ✅ | 利用 class mock 覆盖状态机基础流（实际 WebRTC 仍需人工检查）。 |
| `tests/integration/moduleB/generate-reflection.test.ts` | ✅ | 已通过。 |

> 注：真实 WebRTC / OpenAI Realtime 行为仍需人工端到端验证（详见 TEST_PLAN.md 的手动覆盖说明）。

---

## 12 Nov 2025 — Vitest run with reports

- **Artifacts**:
  - JUnit XML: `tests/reports/vitest-junit.xml`
  - Coverage bundle: `tests/reports/coverage/`（含 HTML、LCOV、clover 等）
- **Command**: `pnpm vitest run --coverage --reporter=junit --outputFile tests/reports/vitest-junit.xml`
- **Status**: ✅ 通过
- **Coverage summary**（V8）：

| Scope | Statements | Branches | Functions | Lines |
| --- | --- | --- | --- | --- |
| Overall | 59.64% | 37.86% | 46.15% | 62.77% |
| `hooks/use-voice-agent.ts` | 48.69% | 25% | 35.48% | 56.17% |
| `lib/mood-utils.ts` | 100% | 85% | 100% | 100% |
| `lib/security.ts` | 88.88% | 80% | 100% | 93.75% |
| `lib/timezone.ts` | 95.45% | 85.71% | 87.5% | 97.67% |
| `lib/agent/search-quota.ts` | 100% | 100% | 100% | 100% |
| `lib/reflections/*` | 16–77%（低覆盖，需后续集成/合同测试补齐） |

> 下一步：增加 `lib/reflections`、API 合同测试与未来的 Playwright 流程，以拉升整体覆盖率并满足 TEST_PLAN 设定的≥80%目标。

---

## 13 Nov 2025 — Coverage uplift & limitations memo

- **Aggregate helpers**：`lib/reflections/aggregate.ts` 中剩余分支依赖真实 Supabase Admin Client（分页、RLS、时区过滤）与 OpenAI 同步上下文；若仅在单元层面 mock，会脱离真实 SQL/时区行为且需重写整套 query builder。评估后决定暂不进一步模拟，后续计划通过集成/contract 测试跑在实际数据库上；本次覆盖率维持在 54.83%。
- **Hooks / use-voice-agent**：自动化覆盖率 48.69%（Statements），原因是 WebRTC + OpenAI Realtime 必须运行在浏览器/真实服务上。开发团队在设备上已执行超过 100 次连接与 function call 手动测试（详见 QA checklist），但在 CI/Node 环境无法复现音频 capture、SDP 交换，因此保留现状，并在 TEST_PLAN 中明确“需要人工验证”的条目。
