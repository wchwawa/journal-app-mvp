# EchoJournal — 2026 Ecosystem Signals & Recommendations

*综合 7 组侦察笔记(OpenAI / Anthropic+Google / Vercel+Next / Agent 基础设施 / 语音产品 / 社区舆论 / 隐私监管),2026-08-05。所有论断附来源;二手数据已按侦察员置信度标注。*

---

## 1. Executive Summary(10 条核心信号)

1. **Next.js 安全欠账是当前最高风险**:2026-07-20 安全发布修复 4 HIGH + 5 MEDIUM,Next 15 必须升到 15.5.21(Maintenance LTS);升 16 时 `middleware.ts → proxy.ts` 改名会让 Clerk 鉴权**静默失效**。另需确认 React2Shell(CVE-2025-55182,CVSS 10.0)已打补丁。([july-2026-security-release](https://nextjs.org/blog/july-2026-security-release), [upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16))
2. **合规从最佳实践变成法定义务**:CA SB 243(2026-01 生效,$1,000/次私人诉权)要求危机协议 + 热线转介 + 官网公开协议;八州 companion chatbot 法密集落地;Illinois WOPR 直接禁 "读取来访者情绪" 措辞。语音日记 agent 在射程边缘,措辞纪律决定归类。([Gunder](https://www.gunder.com/en/news-insights/insights/client-insight-california-sb-243-new-compliance-requirements-for-operators-of-ai-companion-chatbots), [Orrick](https://www.orrick.com/en/Insights/2026/04/2026-State-Chatbot-Laws-Key-Provisions-and-Regulatory-Trends))
3. **EU AI Act Article 50 透明义务本月(2026-08-02)生效**:AI 身份披露全球适用成本极低;但**声学情绪识别**会触发 Art 50(3) 告知义务 + 2027-12 起高风险合规——"心境洞察"必须锚定在"你说了什么"而非"你听起来怎样"。([CSA note](https://labs.cloudsecurityalliance.org/research/csa-research-note-eu-ai-act-article-50-transparency-20260729/), [Stibbe](https://www.stibbe.com/publications-and-insights/feeling-watched-transparency-obligations-for-emotion-recognition-and))
4. **OpenAI 平台重心已移**:gpt-realtime-2.1/2.1-mini(07-06)带可配置 reasoning、p95 降 ≥25%;mini 音频便宜约 3 倍;GPT-5.6 Luna 降价 80%($0.20/$1.20 per 1M);新特性(persisted reasoning、programmatic tool calling)全在 Responses API 侧;`gpt-4o-mini-transcribe` 进入 legacy 轨道,`gpt-transcribe` 成为推荐。([changelog](https://developers.openai.com/api/docs/changelog), [pricing post](https://openai.com/index/advancing-the-price-performance-frontier-with-gpt-5-6/), [STT guide](https://developers.openai.com/api/docs/guides/speech-to-text))
5. **`@openai/agents-realtime` 0.14.1/0.14.2 是安全补丁**(MCP 错误凭证泄露、沙箱路径),且 0.14.0 起敏感数据日志默认关闭——升级零成本且可写进隐私叙事。([releases](https://github.com/openai/openai-agents-js/releases))
6. **no-RAG 立场已从防守变成行业主流**:Letta 弃服务端 memory 库转 git-backed 文件;Anthropic/OpenAI memory 均为文件形态;Mintlify 用虚拟文件系统替换 RAG(HN 411 分);"文件式显性记忆 + 工具式 JIT 检索"是 2026 共识——可公开引用作背书。([Letta](https://www.letta.com/blog/our-next-phase/), [Mintlify](https://www.mintlify.com/blog/how-we-built-a-virtual-filesystem-for-our-assistant), [Amplify](https://www.amplifypartners.com/blog-posts/file-systems-for-agents))
7. **"agent workspace/filesystem" 成为独立品类**(S3 Files、AgentFS、OpenViking、Amplify 定调),而 OpenAI Realtime/JS agent 栈**没有官方持久记忆方案**——这正是 EchoJournal 接 NoKV 的教科书级切口:每篇日记 = artifact(音频+transcript+summary+memory 文件)。([S3 Files](https://aws.amazon.com/about-aws/whats-new/2026/04/amazon-s3-files), [OpenAI sandbox memory 不覆盖 realtime](https://openai.github.io/openai-agents-python/sandbox/memory/), [penberg disaggregated AgentFS](https://penberg.org/blog/disaggregated-agentfs.html))
8. **语音 UX 基线被 ChatGPT 重置**:语音会话内 live transcript + 可见历史 + 语音/文字互切是 2026 消费预期;日记独白场景默认 `server_vad` 会抢话,`semantic_vad` + 长停顿容忍是品类必需。([Engadget](https://www.engadget.com/ai/now-you-can-use-chatgpt-voice-without-leaving-your-chat-195000538.html), [OpenAI VAD docs](https://developers.openai.com/api/docs/guides/realtime-vad))
9. **Vercel Workflows GA(2026-04)**:`"use workflow"` 步骤级重试/持久化/断线续流,无额外计费层——直接消掉"录音→STT→摘要靠 `after()`、失败即丢"的已知风险。([durable execution GA](https://vercel.com/blog/a-new-programming-model-for-durable-execution))
10. **竞品格局**:Rosebud($6M 种子轮)正用 CARE 危机基准抢占安全话语权;Woebot 关停证明 "AI therapy" 消费定位有监管天花板;隐私军备竞赛开始(Day One/Reflection 押 E2EE,Rosebud 因训练条款流失用户)——"隐私优先的 journaling 工具"是唯一低监管高差异化的位置。([Rosebud CARE](https://www.rosebud.app/care), [Woebot](https://www.mobihealthnews.com/news/woebot-health-shutting-down-its-app), [zero-knowledge 比较](https://cortexos.app/library/zero-knowledge-ai-journal-comparison-2026/))

---

## 2. 优先级建议表

| 级 | 建议 | 信号来源 | 具体改动 | 工作量 |
|---|---|---|---|---|
| **P0** | Next.js 安全升级 | [july-2026-security-release](https://nextjs.org/blog/july-2026-security-release) | 立即升 15.5.21;规划 16.2 LTS,升级时跑 `npx @next/codemod@latest rename-middleware-to-proxy` 并回归测试 Clerk matcher;确认 CVE-2025-55182 已补 | 补丁 XS;升 16 M |
| **P0** | 危机协议 + AI 披露 + 措辞审计 | [SB 243](https://www.gunder.com/en/news-insights/insights/client-insight-california-sb-243-new-compliance-requirements-for-operators-of-ai-companion-chatbots), [WOPR](https://www.taftlaw.com/news-events/law-bulletins/new-illinois-law-restricts-ai-use-in-therapy-sessions/) | 自杀/自残检测→停止常规回复+988 转介卡;首用+语音会话开始+7 天不活跃时披露"AI 非人非治疗师";全文案清除 therapy/diagnose/"reads your emotions";官网加公开安全协议页 | M |
| **P0** | 情绪表述锚定文本 | [EU AI Act Art 50](https://artificialintelligenceact.eu/article/50/), [Stibbe](https://www.stibbe.com/publications-and-insights/feeling-watched-transparency-obligations-for-emotion-recognition-and) | 审计 prompt/UI/营销:洞察=对转写文本的总结("what you said"),不做/不宣称声学情绪推断 | XS |
| **P0** | SDK 升 0.14.2 | [agents-js releases](https://github.com/openai/openai-agents-js/releases) | `@openai/agents-realtime` → 0.14.2;确认未 opt-in `setSensitiveDataLoggingEnabled` | XS |
| **P0** | `semantic_vad` + 停顿容忍 | [VAD docs](https://developers.openai.com/api/docs/guides/realtime-vad), [AssemblyAI](https://www.assemblyai.com/blog/voice-agent-turn-detection) | 语音会话切 `semantic_vad`,提供"倾听模式"(延长等待阈值)+ PTT 兜底开关 | S |
| **P0** | 关闭已审计安全欠账 | 内部审计 + [MHMDA 首案](https://www.wilmerhale.com/en/insights/blogs/wilmerhale-privacy-and-cybersecurity-law/20250220-first-lawsuit-filed-under-washingtons-my-health-my-data-act) | RLS 死代码、anon reads 在任何隐私叙事公开前修复;确认 journal 页面零广告/分析像素 | M |
| **P0** | 花费护栏 | [changelog 07-22](https://developers.openai.com/api/docs/changelog) | OpenAI 项目设硬性支出上限 + 告警 | XS |
| **P1** | 语音 prompt 重写为 2.1 playbook | [prompting guide](https://developers.openai.com/api/docs/guides/realtime-models-prompting) | 分节指令、`reasoning.effort: "low"` + prompt 内引导工具回合升档、慢工具前口头 preamble、`wait_for_user` 静默工具、unclear-audio 规则 | S |
| **P1** | STT 迁 `gpt-transcribe` | [model page](https://developers.openai.com/api/docs/models/gpt-transcribe) | 换推荐模型;用 `keywords`/`prompt` 注入用户本地的人名/地名提示(契合 no-RAG);成本 $0.003→$0.0045/min 可接受 | S |
| **P1** | 摘要迁 Responses API + strict schema | [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [Luna 降价](https://openai.com/index/advancing-the-price-performance-frontier-with-gpt-5-6/) | Chat Completions → Responses,`json_schema` + `strict: true` + Zod;吃 Luna -80% 与缓存红利 | S |
| **P1** | A/B gpt-realtime-2.1-mini | [model page](https://developers.openai.com/api/docs/models/gpt-realtime-2.1-mini), [实测成本](https://hackernoon.com/openai-realtime-api-pricing-in-2026-real-world-data-from-4000-measured-sessions) | mini 做默认档(音频 ~3x 便宜且带 reasoning),2.1 做升级档;同时做 cache 命中/工具输出裁剪/会话上限的成本七件套 | S |
| **P1** | 语音会话 live transcript UI | [ChatGPT 基线](https://www.engadget.com/ai/now-you-can-use-chatgpt-voice-without-leaving-your-chat-195000538.html), [AI Voice Elements](https://vercel.com/changelog/ai-voice-elements) | 会话中实时字幕 + 可滚动历史;回放用 Voice Elements `Transcription`(音频同步+click-to-seek);工具调用时填充话术遮蔽 p95 尖刺 | M |
| **P1** | Workflows 替换 `after()` 管线 | [Workflows GA](https://vercel.com/blog/a-new-programming-model-for-durable-execution) | 录音→STT→摘要→写库改为 4-step workflow,免费获得重试/断点续跑/persistent streaming | M |
| **P1** | ZDR/驻留 + 可证明删除 | [OpenAI your-data](https://developers.openai.com/api/docs/guides/your-data), [BetterHelp 令](https://www.ftc.gov/news-events/news/press-releases/2023/07/ftc-gives-final-approval-order-banning-betterhelp-sharing-sensitive-health-data-advertising) | 申请 ZDR;定留存时限表;一键全量删除(账号+条目+音频+派生摘要,同步存储与备份);上线 "Your data & AI" 说明页(同时满足 Apple 5.1.2(i)) | M |
| **P2** | 关系工具 MCP 化 | [MCP 2026-07-28 spec](https://blog.modelcontextprotocol.io/posts/2026-07-28/), [Realtime MCP](https://developers.openai.com/api/docs/guides/realtime) | 时间窗关系工具抽成 in-process MCP server(无状态、strict schema、description 写触发条件);为 NoKV 侧提供展示素材 | M |
| **P2** | 记忆升级:文件 + 版本 + redact | [CMA memory](https://platform.claude.com/docs/en/managed-agents/memory.md), [OpenViking](https://github.com/volcengine/OpenViking) | Supabase 上实现文本记忆文件 + 不可变版本表 + redact 端点;会后异步提炼 + L0 摘要注入 realtime context;用户可见/可删 | L |
| **P2** | 语音层薄抽象(供应商可移植) | [Gemini Live 定价](https://ai.google.dev/gemini-api/docs/pricing), [AI SDK realtime](https://ai-sdk.dev/docs/ai-sdk-core/realtime) | 在 agents-realtime 外包 transport/session/tools 三接口,为 Gemini Live($3/$12 音频)与 AI SDK realtime 保留 AB 位;不迁移 | M |
| **P2** | Server Components + cacheComponents 重构 | [next-16-3-instant-navigations](https://nextjs.org/blog/next-16-3-instant-navigations) | 时间线迁 RSC + Suspense + `'use cache'`,缩小客户端 Supabase 直读与 anon-read 暴露面(随升 16 一起做) | L |
| **P2** | 小件:AGENTS.md / 导出 / Sonnet 5 评测 | [AAIF](https://www.linuxfoundation.org/press/linux-foundation-announces-the-formation-of-the-agentic-ai-foundation), [定价](https://platform.claude.com/docs/en/pricing.md) | 仓库加 AGENTS.md;音频+转写标准格式导出;8-31 前用 Sonnet 5 促销价($2/$10)对 Luna 跑一轮摘要对比 | 各 XS–S |

---

## 3. Models & Harness

- **Realtime**:已在 gpt-realtime-2.1(安全,2027-01 大限只杀 gpt-realtime/gpt-4o-realtime 老系)。新杠杆:`reasoning.effort` 可配置(默认 low)、图像输入、改进打断/静噪、cached input $0.40/1M。官方 prompting guide 是最高杠杆零代码改动(见 P1)。([2.1 model page](https://developers.openai.com/api/docs/models/gpt-realtime-2.1), [prompting guide](https://developers.openai.com/api/docs/guides/realtime-models-prompting), [deprecations](https://developers.openai.com/api/docs/deprecations))
- **2.1-mini 经济学**:文本 $0.60/$2.40、音频 $10/$20 per 1M;实测无缓存长会话可到 $0.18–0.46/min,mini+缓存可压到 $0.02–0.05/min——"说比听贵 4 倍",控制 agent 话痨即控制账单。([mini page](https://developers.openai.com/api/docs/models/gpt-realtime-2.1-mini), [4000 会话实测](https://hackernoon.com/openai-realtime-api-pricing-in-2026-real-world-data-from-4000-measured-sessions))
- **STT**:`gpt-transcribe`(~$0.0045/min)成为推荐,`keywords`/`prompt` 提示 + 会话内前文自动作上下文——对日记里反复出现的人名/地名是直接质量提升,且提示词来自用户本地数据,不破坏 no-RAG 立场。mini-transcribe 未正式弃用但已是 legacy 轨。([gpt-transcribe](https://developers.openai.com/api/docs/models/gpt-transcribe), [costgoat](https://costgoat.com/pricing/openai-transcription))
- **文本/摘要**:Luna 降价 80% 后结构化摘要近乎免费;Chat Completions 不死但生态动量(persisted reasoning、programmatic tool calling、更好缓存)全在 Responses;结构化输出走原生 strict schema,推理密集任务注意"先自由生成后结构化"两段式避开约束解码质量损耗。([deprecations](https://developers.openai.com/api/docs/deprecations), [HN structured outputs handbook](https://news.ycombinator.com/item?id=46635309))
- **双供应商**:摘要负载与 Claude 可直接互换;Sonnet 5 促销($2/$10,8-31 截止)是低成本评测窗口。语音层 Anthropic 无开发者 API,真实备选只有 Gemini Live(仍 preview、WebRTC 靠第三方)。([Anthropic pricing](https://platform.claude.com/docs/en/pricing.md), [Gemini 3.1 Flash Live](https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-3-1-flash-live/))
- **锁定评估**:STT 与摘要低耦合随时可换;真正锁定在 `@openai/agents-realtime`(会话协议+工具注册+WebRTC 全绑 OpenAI)——薄抽象即够,"provider-portable agent design" 本身是 NoKV 叙事卖点。([Kai Waehner](https://www.kai-waehner.de/blog/2026/04/06/enterprise-agentic-ai-landscape-2026-trust-flexibility-and-vendor-lock-in/))

## 4. Web Platform

- **安全线**(P0,见表):15.5.21 立即;16.2 LTS 计划内;`proxy.ts` 改名陷阱;React2Shell 补丁确认。([security release program](https://nextjs.org/blog/next-security-release-program), [React2Shell 背景](https://beyondit.blog/blogs/nextjs-16-vs-tanstack-start-data-comparison))
- **升 16 的红利**:16.3 零改动性能(dev 内存 -90%、build 缓存 5.5x、SSR +22%);`cacheComponents` + Partial Prefetching 是治 client-heavy fetching 的正路,顺带缩小 anon-read 面;`catchError`+`retry()` 做拉取失败恢复;experimental `useOffline`/网络韧性对移动网络录音上传直接相关。([next-16-3](https://nextjs.org/blog/next-16-3), [instant-navigations](https://nextjs.org/blog/next-16-3-instant-navigations))
- **后台管线**:Workflows GA(仅付 Fluid compute、开源可自托管——对"不锁死 Vercel"叙事加分);Queues 仍 limited beta 不依赖;`after()` 只留埋点。([docs/workflows](https://vercel.com/docs/workflows), [docs/queues](https://vercel.com/docs/queues))
- **AI SDK 7 + AI Gateway**:transcribe/文本路径可迁(0 加价、单 key、`@ai-sdk/otel` 遥测);realtime wrap 是 WebSocket-only + experimental,不迁。([ai-sdk-7](https://vercel.com/blog/ai-sdk-7), [Gateway audio](https://vercel.com/changelog/realtime-voice-speech-and-transcription-now-supported-on-ai-gateway))
- **React 19.2**:`<Activity>` 保活录音/realtime 会话切走再切回;`useEffectEvent` 清理 WebRTC effect 依赖减少重连抖动。([react 19.2](https://www.react.dev/blog/2025/10/01/react-19-2))

## 5. Agent Infra & NoKV Fit

- **品类共识**:agent 状态 = 可 `ls/grep` 的文件树,非黑盒向量库(Amplify 定调;Letta 砍服务端 memory 转 MemFS 是最强单一信号;S3 Files 是巨头背书)。([Amplify](https://www.amplifypartners.com/blog-posts/file-systems-for-agents), [Letta](https://www.letta.com/blog/our-next-phase/), [S3 Files](https://aws.amazon.com/about-aws/whats-new/2026/04/amazon-s3-files))
- **NoKV 的第三方理论背书**:penberg 的 "disaggregated agent filesystem"(SQLite 元数据本地/缓存 + S3 为 source of truth)与 NoKV 的 metadata plane + 对象存储分层几乎同构,可直接引用。([penberg](https://penberg.org/blog/disaggregated-agentfs.html))
- **切口是真实缺口**:OpenAI sandbox memory 仅覆盖 Python sandbox agents,realtime/JS 无官方持久记忆——EchoJournal "每篇日记 = artifact + 提炼 memory 文件" 恰好补上 nokv.io design-partners 页缺失的"消费级 app 采用"叙事。([sandbox memory](https://openai.github.io/openai-agents-python/sandbox/memory/), [nokv.io/design-partners](https://nokv.io/design-partners/))
- **应吸收的收敛模式**:L0 摘要常驻 + 按需展开(OpenViking 三级加载/OpenAI progressive disclosure);会后异步提炼不阻塞交互;记忆带时间戳/有效期(与 time-bounded tools 同构);版本化 + redact + 审计日志(Anthropic CMA 是范式模板,GDPR 友好)。([OpenViking](https://github.com/volcengine/OpenViking), [CMA memory](https://platform.claude.com/docs/en/managed-agents/memory.md), [Mem0 报告](https://mem0.ai/blog/state-of-ai-agent-memory-2026))
- **MCP 是唯一无争议的跨供应商层**:已捐 Linux Foundation/AAIF(OpenAI/Google/AWS 全在);2026-07-28 规范转无状态 + Tasks/Apps 扩展;OpenAI Realtime 可直接挂 MCP server——未来 NoKV 以 MCP server 形态暴露 artifact store 即可被三家消费。([AAIF](https://www.linuxfoundation.org/press/linux-foundation-announces-the-formation-of-the-agentic-ai-foundation), [spec](https://blog.modelcontextprotocol.io/posts/2026-07-28/))
- **竞争提醒**:OpenViking(AGPLv3、字节托管)重语义层,NoKV 重存储正确性(事务/快照/watch/GC)——差异点必须落在正确性原语而非"能存文件";防其向下吞噬。([OpenViking](https://github.com/volcengine/OpenViking))

## 6. Voice UX

- **轮次检测**:纯 silence VAD 被视为"原型级";日记独白用户长停顿思考,默认 `server_vad` 抢话是品类反模式——`semantic_vad`(+100–200ms 但显著减少抢话)+ 倾听模式 + PTT 兜底。([LiveKit](https://livekit.com/blog/turn-detection-voice-agents-vad-endpointing-model-based-detection), [OpenAI VAD](https://developers.openai.com/api/docs/guides/realtime-vad))
- **延迟纪律**:<800ms p50 流畅、一致性 > 均值;关系工具调用是 p95 尖刺主源→ preamble 话术/耳标音效遮蔽;2.1 系 p95 已降 ≥25%。([DestiLabs](https://www.destilabs.com/blog/ai-voice-agent-benchmark-2026), [Hamming](https://hamming.ai/resources/voice-ai-latency-whats-fast-whats-slow-how-to-fix-it))
- **界面基线**:语音中 live transcript + 可见历史 + 模态互切(ChatGPT 已定标);回放 UI 用 Voice Elements `Transcription`(转写-音频同步、click-to-seek)与 `Persona` 状态动画。([Engadget](https://www.engadget.com/ai/now-you-can-use-chatgpt-voice-without-leaving-your-chat-195000538.html), [AI Voice Elements](https://vercel.com/changelog/ai-voice-elements))
- **竞品**:Rosebud(Call mode、intention setting、CARE 安全基准)与 Mindsera 2.0(结构化 memory profile、Rituals)证明"习惯抓手 + 记忆深度"是留存关键;新入场长尾拥挤但零融资——差异化在 agent 质量/记忆/隐私架构,不在"能语音"。([Rosebud](https://www.rosebud.app/blog/rosebud-raises-6m-to-expand-the-worlds-leading-ai-journal), [Mindsera 2.0](https://mindsera.com/articles/introducing-mindsera-2-0/), [品类评测](https://journalinghabit.com/best-voice-journal-apps-2026/))
- **捕捉面**:Web 优先缺移动快捷捕捉是习惯养成最大短板;外部录音导入(Plaud/Voice Memos)是低成本扩展且契合 artifact store 叙事;巨头正收编 always-on 硬件(Bee→Amazon、Limitless→Meta)。([可穿戴整合](https://glasp.co/articles/ai-memory-wearables))

## 7. Privacy & Positioning

- **定位一句话**:2026 监管把 "AI 陪伴/治疗" 打成高危类目,"带 AI 的私人日记"仍是低监管区——主动钉死在后者。措辞铁律:journaling/self-reflection tool;永不出现 therapy/therapist/treatment/diagnose/"reads your emotions"(WOPR 直接禁最后一条;Google Play 诊断暗示触发临床验证)。([psychology.com state bans](https://psychology.com/ai-therapy/state-bans), [Google Play health](https://support.google.com/googleplay/android-developer/answer/14738291?hl=en))
- **法定最小集**(P0 表已列):AI 披露(CA/NY/Utah 已生效)、危机协议 + 公开协议页(SB 243)、18+ 定位避开未成年人条款集群、零 ad-tech 像素(MHMDA 私人诉权已被 SDK 间接收集案激活)。([Troutman](https://www.troutmanprivacy.com/2026/01/analyzing-the-new-ai-companion-chatbot-laws/), [MHMDA 首案](https://www.wilmerhale.com/en/insights/blogs/wilmerhale-privacy-and-cybersecurity-law/20250220-first-lawsuit-filed-under-washingtons-my-health-my-data-act))
- **叙事资产现成且真实**:no RAG + 时间限定工具 + 文件式可删记忆,对比 Rosebud 训练条款争议与 BetterHelp 先例是清晰卖点;配 ZDR/EU 驻留 + 留存时限表 + 可证明删除 + "Your data & AI" 页(顺带满足 Apple 5.1.2(i) 的第三方 AI 共享披露)。([Apple guidelines](https://techcrunch.com/2025/11/13/apples-new-app-review-guidelines-clamp-down-on-apps-sharing-personal-data-with-third-party-ai), [OpenAI data residency](https://openai.com/index/introducing-data-residency-in-europe/), [Rosebud 流失](https://blog.mylifenote.ai/rosebud-journal-alternative/))
- **前置条件**:隐私定位会招致针对性审视——RLS 死代码与 anon reads 必须先关闭再公开叙事。
- **观察**:FTC 6(b) 报告"明年"发布将塑造立法;BEUC companion AI 报告显示欧盟加码方向;对 OpenAI 的诉讼潮(11+ 起,FL 州诉)意味着"危机处理能力"会成为公众评价维度(Rosebud CARE 已在抢话语权)。([FTC](https://www.ftc.gov/news-events/news/press-releases/2025/09/ftc-launches-inquiry-ai-chatbots-acting-companions), [MLex](https://www.mlex.com/mlex/articles/2493030/us-ftc-s-study-on-chatbot-industry-could-shape-future-legislation-ferguson-says))

---

## 8. Do NOT Chase(明确跳过)

1. **迁移语音层到 Gemini Live 或 AI SDK realtime**:前者 3.1 Flash Live 仍 preview 且 WebRTC 靠第三方拼装;后者 WebSocket-only + experimental。只做薄抽象保留 AB 位。([Gemini Live](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-live-preview), [ai-sdk realtime](https://ai-sdk.dev/docs/ai-sdk-core/realtime))
2. **向量 RAG / 托管 memory 框架(Mem0/Zep/Letta cloud)**:行业整体转向文件+工具,引入向量库反而稀释 no-RAG 差异化;Letta 自己都在撤退。([Letta](https://www.letta.com/blog/our-next-phase/))
3. **声学情绪分析(Hume 类)**:直接触发 EU emotion recognition 定义(Art 50(3) 告知 + 2027-12 高风险)+ WOPR 措辞风险 + 与隐私叙事冲突。列为独立重大决策,当前不做。([Stibbe](https://www.stibbe.com/publications-and-insights/feeling-watched-transparency-obligations-for-emotion-recognition-and))
4. **任何 therapy/心理健康定位或功能**:Woebot 关停 + 四州禁令 + 诉讼潮;危机协议做到"转介"为止,不做"共情式挽留"或干预。([Woebot](https://www.mobihealthnews.com/news/woebot-health-shutting-down-its-app))
5. **硬件/always-on 捕捉**:巨头已收编该层(Bee→Amazon、Limitless→Meta);只做导入不做设备。([glasp](https://glasp.co/articles/ai-memory-wearables))
6. **框架迁移(TanStack Start 等)**:出走叙事是博客圈现象,非大规模迁移;Next 16 显式缓存方向对我们有利。([openreplay](https://blog.openreplay.com/devs-moving-tanstack-nextjs/))
7. **端侧 STT 全面替换**:Moonshine/Parakeet/Voxtral 动量真实,但作为"本地隐私档位"是 P2+ 观察项,不是现在重构 STT 的理由;英文优先时再评估。([Moonshine micro](https://github.com/moonshine-ai/moonshine/tree/main/micro), [Voxtral](https://mistral.ai/fr/news/voxtral))
8. **OpenAI hosted multi-agent beta / programmatic tool calling / Realtime MCP 挂载**:观察项——Realtime+MCP 是未来 NoKV 展示的强角度,但等 MCP 化(P2)落地后再评,不提前建。([Realtime guide](https://developers.openai.com/api/docs/guides/realtime))
9. **Vercel Queues**:limited beta 且 Workflows 已覆盖需求。([docs/queues](https://vercel.com/docs/queues))
10. **追逐 OpenClaw/agent swarm 式热点**:与产品无交集;NoKV 叙事引用生态热度即可,不接入。([bytebytego](https://blog.bytebytego.com/p/top-ai-github-repositories-in-2026))

---

*置信度备注:openai.com 博客一手页面存在 403(经 changelog + 二手源交叉);"Gemini vs OpenAI 10 万分钟 $165 vs $8,400" 与 Menlo 市场份额为二手转述,采用前复算;agents-js 版本以 GitHub releases(0.14.2, 2026-08-01)为准,npm 快照有滞后。*