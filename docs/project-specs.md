## Implementation Phases & Data Flow

**IMPORTANT**: The current implementation phase focuses on Module A (Daily Record) with data flowing to relational database only. The RAG system (vector database, knowledge graph, AI agent) will be implemented in later phases.

**Current Phase**:

- Module A data flows to Supabase Postgres tables only
- No RAG integration, vector embeddings, or AI processing

**Future Phase - RAG Integration**:

- When RAG module implementation begins, Module A will undergo partial refactoring
- Data will be duplicated/synced to vector database and knowledge graph
- AI agent will process existing Module A data for semantic understanding

---

## Module A: Daily Record

### A0. Daily Mood Record ✅ _Implemented_

**Purpose**: Capture user's daily emotional state through structured questionnaires.

**Functional Requirements**:

1. **Data Collection Interface**

   - Display modal popup on user login if no entry exists for current date
   - Present two questions simultaneously:

     ```
     Question 1 (Single Choice):
     - "How was your day?"
       - Good day
       - Bad day
       - Just so so

     Question 2 (Multiple Choice):
     - "How do you feel today?"
       - Happy
       - Anxious
       - Anger
       - Sadness
       - Despair
       - [Additional emotions as needed]
     ```

2. **Business Logic**

   - Check `daily_question` table for existing entry with current date and user_id
   - **Auto-trigger**: Modal automatically displays on dashboard/overview page load when no daily entry exists
   - **Manual trigger**: "Daily Check-in" button available on overview page to open modal anytime
   - **Update support**: If user has already submitted today, allow updating existing entry
   - **Smart form behavior**:
     - New entry mode: Empty form, "Submit" button
     - Update mode: Pre-populated with existing data, "Update" button

3. **Data Storage**

   - Table: `daily_question`
   - **Create operation**: INSERT new record when no daily entry exists
   - **Update operation**: UPDATE existing record by ID when daily entry exists
   - **Data integrity**: One record per user per day maintained

4. **UI Specifications**

   - Location: `/dashboard/overview`
   - Component: Centered modal overlay
   - **Manual trigger**: "Daily Check-in" button with heart icon in overview page header
   - **Button states**:
     - Loading: "Submitting..." / "Updating..."
     - Normal: "Submit" / "Update"
   - **Dynamic display**: "Mood Today" card shows real-time mood data
   - Style: Consistent with project design system

5. **Technical Implementation**
   - **Component architecture**: forwardRef pattern for external triggering
   - **Event communication**: CustomEvent system between page and layout
   - **State management**: Local component state with mode tracking
   - **Database operations**: Conditional INSERT/UPDATE logic
   - **Dynamic display**: Real-time mood data fetching with loading states

### A1. Audio Journal Recording ✅ _Implemented_

**Purpose**: Enable voice-based journaling with automatic transcription and summarization.

**Functional Requirements**:

1. **Data Collection Interface**

   - Browser-based MediaRecorder API with webm/opus format
   - Real-time duration display with visual progress bar
   - 10-minute maximum duration with automatic stop
   - Record/stop/pause/resume controls with clear visual feedback
   - Audio playback functionality for recorded content
   - **Recording controls**: Restart recording, discard after stop
   - **Manual state management**: Clear button for processed recordings

2. **Business Logic**

   - **Audio Processing Pipeline**:
     - Transcription: OpenAI Whisper-1 API ($0.006/minute)
     - Summarization: GPT-4o-mini for content structuring
     - Processing time: 4-7 seconds average
     - **Processing state check**: Prevent duplicate submissions
   - **File Management**:
     - Maximum file size: 25MB (API limitation)
     - Storage path structure: `journal-audio/[user-id]/[timestamp]-recording.webm`

3. **Data Storage**

   - Table: `audio_files`
     - Stores: user_id, storage_path, mime_type, duration_ms
   - Table: `transcripts`
     - Stores: user_id, audio_id (FK), text, language
   - Storage: Supabase Storage bucket `audio-files`
   - **Data integrity**: Each audio file linked to its transcript

4. **UI Specifications**

   - Location: `/dashboard/overview` (embedded panel, right column)
   - Component: AudioJournalPanel (no modal, direct integration)
   - **Design**: Clean interface following "Intelligent Minimalism"
   - **Visual hierarchy**: Central focus with two-column layout
   - **Real-time stats**: Display total entries, weekly count, streak

5. **Technical Implementation**
   - **API endpoint**: `/api/transcribe` with multipart form data
   - **Authentication**: Clerk user verification required
   - **Admin access**: Service role key for RLS bypass
   - **Error handling**: Comprehensive error responses
   - **Event system**: CustomEvent for cross-component updates

### A2. [Ongoing] User’s Journal (Journal Book)

**Location:** `dashboard/journals`

#### Purpose

This module allows users to view, manage, and interact with their stored journals in a structured, intuitive format. Users can review past entries, listen to their recorded audio, read rephrased transcripts, and manage entries by editing or deleting them. Additionally, the system generates daily summaries to help users reflect on each day’s content.

---

#### Functional Requirements

1. **Nested Journal Structure**

   - Journals are displayed in a **two-level nested structure**.
   - Each **daily record** wraps all journal entries created on that specific day.
   - Think of each daily record as a page in a diary—each page represents one day’s worth of entries.

2. **Daily Record Expansion**

   - The journal dashboard initially shows a list of daily records.
   - Clicking a daily record will **expand** it to reveal all the journal entries for that day.

3. **Journal Entry Display**  
   Each journal entry must include:

   - `datetime`: the timestamp of the entry.
   - `audio`: a play button to listen to the original voice recording.
   - `transcript`: a rephrased version of the speech-to-text transcription for readability.

4. **Daily Summary Generation** ✅ _Implemented_

   - At the end of each day, the system **automatically generates a summary** based on that day's entries.
   - This summary is displayed at the **same level as the journal entries** under each daily record.
   - **Implementation Details**:
     - **Table**: `daily_summaries` with fields: user_id, summary_date, summary_text, created_at
     - **Processing Pipeline**:
       - GPT-4o-mini analyzes all journal entries for a specific day
       - Generates cohesive summary focusing on themes, emotions, and key events
       - Automatically triggered via API endpoint `/api/generate-daily-summary`
     - **Scheduling**: Manual generation via cron job or automated trigger
     - **Content Analysis**: Combines transcript text from all day's audio journal entries
     - **AI Prompt Engineering**: Structured prompts for consistent, meaningful summaries

5. **Filtering Capabilities**  
   Users should be able to filter journal entries using:

   - **Date range**
   - **Mood tags** (e.g., happy, anxious, neutral)
   - **Keywords** (full-text search within transcripts)

6. **Entry Management**

   - Users can **edit or delete** existing journal entries.
   - Editable fields may include transcript content or associated metadata.
   - All changes must be scoped to the authenticated user's own journal records.

7. **Data Storage**

   - **Primary Tables**:
     - `audio_files`: Stores audio recordings metadata
     - `transcripts`: Stores processed transcription and summary text
     - `daily_question`: Links to daily mood data for comprehensive view
   - **New Table**: `daily_summaries`
     - Stores: user_id, summary_date, summary_text, created_at, updated_at
     - **Primary Key**: Composite of user_id + summary_date
     - **Data integrity**: One summary per user per day
   - **Relationships**:
     - daily_summaries.user_id → Links to user's journal entries
     - daily_summaries.summary_date → Groups all entries by date
     - Integration with existing audio_files and transcripts tables

---

#### UI Behavior Summary

- On page load, the dashboard displays a **collapsed list of daily records**.
- Each collapsed **daily record card** is labeled with:
  - **Date**
  - **Daily Summary** (AI-generated from day's journal entries)
  - **Daily Mood Tag** (sourced from _Module A0_)
    > _Example label:_ `2025-07-18 | Mood: Reflective | Summary: Reflected on personal growth and completed 3 important tasks despite feeling unmotivated.`
- Clicking a daily record will **expand** that day’s section to reveal:
  - All associated journal entries with:
    - Timestamp
    - Audio playback
    - Rephrased transcript
  - The same **daily summary** also appears within the expanded view.
- Filtering options (by date, mood, keyword) appear at the top of the module for quick content access.

---

#### Interface Structure Diagram

Dashboard / Journals (Journal Overview Page)
├─ Daily Record: 2025-07-18
│ ├─ Journal Entry 1
│ │ ├─ Timestamp
│ │ ├─ Audio Playback Button
│ │ └─ Rephrased Transcript
│ ├─ Journal Entry 2
│ │ ├─ Timestamp
│ │ ├─ Audio Playback Button
│ │ └─ Rephrased Transcript
│ └─ Daily Summary: (auto-generated text)
├─ Daily Record: 2025-07-17
│ ├─ Journal Entry 1
│ │ ├─ Timestamp
│ │ ├─ Audio Playback Button
│ │ └─ Rephrased Transcript
│ └─ Daily Summary: (auto-generated text)
└─ ... (More daily records in chronological order)

## Module B: Echos (Reflections)

Echos 以固定周期（Daily、Weekly、Monthly）生成结构化的反思卡片，来源于 `daily_summaries`、`daily_question` 与当日/当期的转写内容。每张卡包括：
- Achievements（≤3）
- Commitments（≤3）
- Mood（overall + reason）
- Flashback（一句 Hook）

### 数据模型
- 日粒度：复用 `daily_summaries`，扩展字段：`achievements[]`、`commitments[]`、`mood_overall`、`mood_reason`、`flashback`、`stats(jsonb)`、`edited(bool)`、`gen_version`、`last_generated_at`。
- 周/月粒度：`period_reflections`（`user_id`、`period_type('weekly'|'monthly')`、`period_start`、`period_end`、同上字段、`UNIQUE(user_id,period_type,period_start)`）。

### 生成与编辑
- 触发：`POST /api/reflections/sync`，参数 `{ mode: 'daily'|'weekly'|'monthly', anchorDate?: 'YYYY-MM-DD' }`。
  - Day：以 anchorDate（默认今天）更新当日 `daily_summaries` 的结构化反思；每天最多一次成功写入。
  - Week/Month：只对“进行中”周/月卡 upsert；历史周期保持稳定。
- 列表读取：`GET /api/reflections/daily|weekly|monthly`（limit/pagination）。
- 轻量编辑：`PATCH /api/reflections/daily/:date`、`PATCH /api/reflections/period/:id`，设置 `edited=true`，后续再生不覆盖已编辑字段。

### 时区与周期边界
- 所有“周期边界”（周一..周日、本月）按“本地时区”计算，period_start/period_end 用本地 YYYY-MM-DD（不再使用 UTC 字符串日界），避免 11 月卡显示为 10 月。

### 性能与交互
- 异步化：录音保存后，`/api/transcribe` 立即返回；“生成日总结 + Echos 同步”在后台顺序执行。手动 `POST /api/generate-daily-summary` 同步返回 summary，但 Echos 同步改为后台触发。
- Echos 页面（`/dashboard/echos`）：分段切换（Day/Week/Month），卡片展示与 Generate/Refresh/Edit 动作；刷新当前周/月时，若当前顶部卡片非“进行中”，则以“今天”为锚点生成当期卡。

### 约束与校验
- 模型返回 JSON 解析前做“软修正”：`achievements/commitments` 最多 3 项、`stats.keywords` 最多 8 项，随后再做 zod 校验；解析失败记录原文并抛错。

### 未来演进
- 迁移至 Responses API（GPT‑5）与更强鲁棒性解析；版本化 prompt；历史周期再生策略；更丰富可视化与趋势。

## Module C: AI voice companion

**goal** 用户的私人日记伴侣，提供基于AI的自然的语音交互体验，给用户提供情绪价值如激励，宽慰，安抚，庆祝

### agent context strategy

#### Current strategy: JSON based incremental summaries.

每个用户将有一个achievement table

```json
{
  "weekly": {
    "2025-08-04": {
      "achievements": {
        1: "I finished my assignemnts for the week!",
        2: "...",
        3: "..."
      },
      "commitments": {
        1: "My girlfriend told me she want iPhone 17 pro max to be her birthday present",
        2: "..."
      },
      "mood": {
        "overall": "happy",
        "reason": "I found my internship!"
      }
    }
  },
  "monthly": {
    "2025-08": {
      "achievements": {
        1: "publish my paper!",
        2: "...",
        3: "..."
      },
      "commitments": {
        1: "I need to write a paper for my thesis",
        2: "..."
      },
      "mood": {
        "overall": "neutral",
        "reason": "I need to write a paper for my thesis"
      }
  }
  },
  "yearly": {
    "2025": {
      "achievements": {
        1: "I find the job I want!",
        2: "...",
        3: "..."
      },
      "commitments": { 
        1: "I need to find the job I want",
        2: "..."
      },
      "mood": {
        "overall": "neutral",
        "reason": "I need to write a paper for my thesis"
      }
    }
  }
}
```

#### Future: Combining rag (graph or hybird)

## Module C: Personal Achivement
