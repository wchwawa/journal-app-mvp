## Implementation Phases & Data Flow

Status: The project is in UI polish wrap‑up. Module C (AI voice companion) does not use RAG; instead it relies on a deterministic context tool that queries relational data in Supabase.

**Current Phase**

- Modules A and C use Supabase Postgres tables as the single source of truth.
- Module C retrieves user context by calling `fetch_user_context` with explicit time scopes (today/week/month/recent/custom) and optional `anchorDate`/`range`, then queries `daily_summaries`, `daily_question`, and `period_reflections`.
- No vector embeddings or knowledge graph in the agent path; web search is available as a separate tool with per‑day quotas.

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
   - **Idle microcopy**: When no recording is active, the waveform area cycles through journaling facts (emoji-supported, typewriter animation) to keep the widget feeling alive without interfering with live or playback states.

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

Echos generates structured reflection cards on fixed periods (Daily, Weekly, Monthly), using data from `daily_summaries`, `daily_question`, and the transcripts for the current day/period. Each card includes:
- Achievements (≤ 3)
- Commitments (≤ 3)
- Mood (overall + reason)
- Flashback (single‑sentence hook)

### Data model
- Daily granularity: reuse `daily_summaries` and extend it with fields `achievements[]`, `commitments[]`, `mood_overall`, `mood_reason`, `flashback`, `stats (jsonb)`, `edited (bool)`, `gen_version`, and `last_generated_at`.
- Weekly/monthly granularity: `period_reflections` with fields `user_id`, `period_type ('weekly' | 'monthly')`, `period_start`, `period_end`, the same reflection fields as above, and `UNIQUE(user_id, period_type, period_start)`.

### Generation & editing
- Trigger: `POST /api/reflections/sync` with `{ mode: 'daily'|'weekly'|'monthly', anchorDate?: 'YYYY-MM-DD' }`.
  - Day: upserts the structured reflection in `daily_summaries` for `anchorDate` (defaults to “today”); at most one successful write per day.
  - Week/Month: only upserts cards for the “in‑progress” week/month; historical periods remain stable.
- List endpoints: `GET /api/reflections/daily|weekly|monthly` with limit/pagination.
- Light editing: `PATCH /api/reflections/daily/:date` and `PATCH /api/reflections/period/:id` set `edited=true` so future regenerations do not overwrite edited fields.

### Timezone & period boundaries
- All period windows (Monday..Sunday for weeks, and calendar months) are computed in the **local timezone**. `period_start`/`period_end` are stored as local `YYYY-MM-DD` (no longer UTC date strings) to avoid cases like “November content showing up on an October card”.

### Performance & interaction
- Asynchronous pipeline: after recording is saved, `/api/transcribe` returns immediately; “generate daily summary + Echos sync” runs sequentially in the background. The manual `POST /api/generate-daily-summary` returns the summary synchronously but triggers Echos sync asynchronously.
- Echos page (`/dashboard/echos`): segmented controls (Day/Week/Month) with cards that support Generate/Refresh/Edit actions. When refreshing the current week/month, if the top card is not the in‑progress period, the system uses “today” as the anchor date to generate the current period card.

### Constraints & validation
- Before parsing model JSON, apply “soft correction”: cap `achievements/commitments` at 3 items and `stats.keywords` at 8 items, then run zod validation; if parsing still fails, log the raw content and raise an error.

### Future evolution
- Migrate to the Responses API (GPT‑5) with more robust parsing, version prompts, add strategies for regenerating historical periods, and ship richer visualizations and trends.

## Module C: AI voice companion

**goal** A private diary companion that provides natural voice interactions; when the user asks about past events, moods, themes, or goals, the agent uses a “context tool” to retrieve precise information from relational data (no vector RAG).

**user story** As a user, I want to speak with an AI assistant to review and reflect on my journal; when I mention time ranges/periods/keywords, the assistant should translate them into explicit query parameters, fetch my data, and respond in my preferred tone with emotional support and reflective prompts.

**basic features**
1. Voice interaction agent (Echo) with tools: (1) `fetch_user_context` for precise relational queries, and (2) `web_search` for external information.
2. Multiple voice profiles: calm/neutral male/female, gentle/soothing, playful/energetic, and seasonal voices.
3. Global entrypoint: an AI-style floating button that is available everywhere after login; the Echos page also provides a dedicated entry.
4. (Optional) Text rendering of the most recent AI reply in real time.

**design decisions** (Module C does not use RAG)
- Use an explicit “time range parameterization” context tool to improve precision, interpretability, and stability, avoiding unnecessary vector recalls and latency; if we later need “fuzzy memory”, we can re‑evaluate RAG.
- Data comes from relational tables such as `daily_summaries`, `daily_question`, and `period_reflections`; the tool maps phrases like “yesterday / last week / a certain period” into `{ scope, anchorDate, range }`.
- `web_search` has a daily quota and is only used when the user explicitly asks for external knowledge.

**sample user workflow**
Activate the agent → the agent greets the user and states the local date → the user asks a question by voice → the agent, if needed, first calls `fetch_user_context` based on the semantics → then generates and plays back a voice reply.

**overall expectation** A Siri‑like voice experience: tapping the floating button immediately enters push‑to‑talk mode, with sessions up to 10 minutes and support for quick interruption/resume.

**current progress (2025-11-10)**
- ✅ Browser push‑to‑talk is wired up: floating entrypoint, voice profile switching, and a 10‑minute session guard.
- ✅ Echo can call `fetch_user_context` (Supabase relational queries) and `web_search` in real time and play voice responses.
- ✅ Ephemeral token issuance and WebRTC connectivity are implemented via the OpenAI Agents SDK (Realtime).
- ⏳ Next: improve tool semantics (date range inference), add example data, upgrade to the latest SDK, and run regression tests.
