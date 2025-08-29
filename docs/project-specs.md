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

## Module B: Achievement

将用户的成就按照固定的period（weekly and monthly）总结，按照时间顺序线性排列并展示。类似52个周以节点的方式线形排列，每个代表今年的一周（或者12个节点，每个代表一个月）。每个节点都会根据时间段内的日记内容总结 1. 成就 2.承诺 3. 状态（根据按照用户当周心情的占比来决定，比如7天中happy占多数，那就标记本周总体是开心的）

### data structure

## Module C: AI voice companion

**goal** 用户的私人日记伴侣，提供基于AI的自然的语音交互体验，给用户提供情绪价值如激励，宽慰，安抚，庆祝

### agent context strategy

#### Current strategy: JSON based incremental summaries.

每个用户将有一个achievement table

```json
{
  "daily": {
    "2025-08-04": "焦虑指数 3/5，提到论文 dead-line …",
    "2025-08-03": "心情良好，和男友通话 …"
  },
  "weekly": {
    "2025-W31": "整体积极，健身 3 次 …"
  },
  "monthly": {
    "2025-07": "情绪波动较大，主要压力来自工作 …"
  },
  "yearly": {
    "2024": "完成硕士第一学年，搬家 …"
  }
}
```

#### Future: Combining rag (graph or hybird)

## Module C: Personal Achivement
