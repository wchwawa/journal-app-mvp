**Project Description**

EchoJournal is developing a voice-first journaling application to help diarists capture daily reflections with speech transcription. EchoJournal begins with voice transcription as the gateway to your thoughts. From there, it provides precise, AI-powered organization of your journal entries and a companion powered by a state-of-the-art voice-native large language model.

### **Features**

- **Journal‑centric Agent** (Alpha Feature) — Built on a voice‑native LLM, the agent understands context, emotion, and timelines, letting users ask things like "What patterns did you notice in my mood the last three months?" or "Remind me of the goals I set after my Japan trip."

  - **Deterministic long‑term memory via context tool (no RAG in Module C)** — Entries are stored in relational tables (Postgres JSONB). The agent retrieves user context by calling a dedicated `fetch_user_context` tool that translates natural‑language time phrases into explicit parameters (e.g., today/week/month, anchorDate, custom ranges) and queries `daily_summaries`, `daily_question`, and `period_reflections`. This approach increases precision and reduces latency and operational complexity. Optional vector/graph integration may be explored later for fuzzy recall.
  - **Human‑level voice interaction experience** — Uses state‑of‑the‑art voice‑native models to ensure the interaction feels natural—supporting push‑to‑talk, interruption handling, stable emotional tone, supportive personality traits, and seamless voice switching.
  - **Customizable voice** — Users can personalize the assistant's tone and speech via selectable voice profiles.

- **Voice‑focused user interaction on journaling** — A hybrid STT pipeline feeds the assistant while remaining invisible to the user—journaling is fully conversational.

  - **Conversational input → journal format:** Transcription + AI rephrasing produces readable first‑person entries.
  - **Voice recording & optional real‑time subtitles:** Voice entries are saved with synchronized transcription.
  - **Automatic sentiment and goal detection:** The system analyzes content to infer mood and identify implicit goals.

- **Scheduled Self-Reflection Event:** Users receive regular reflection prompts (weekly, monthly, quarterly).
- **Privacy by Design** — End‑to‑end AES‑GCM, zero‑knowledge key management and differential‑privacy analytics.

### **Problems(pain points)**

- Typing journals is tedious—over 60 % of diarists quit within a month.
- Voice notes are unstructured; insights are hard to retrieve.
- Reflections rarely translate into actionable goals.
- Privacy worries stop many from cloud‑based diary apps.

### **Target Users**

- Habitual diarists who want lower‑friction capture.
- Self‑improvers seeking data‑driven reflections.

### **Challenges & Mitigations**

- STT accuracy & cost: Hybrid model, silence trimming, GPU batch inference
- LLM token spend: Context pruning, caching, tiered pricing
- Context retrieval: Deterministic relational queries with explicit time bounds; proper indexes and lightweight caching
- Privacy & compliance: end‑to‑end encryption, local key storage, regular audits

### **Deliverables**

1. **AI voice companion** using OpenAI Agents SDK (Realtime) with push‑to‑talk, voice profiles, and ephemeral session tokens.
2. **Deterministic context tool + relational retrieval** (Supabase) for precise user context; optional vector/graph integration later.
3. **Minimalist Web UI (PWA):** Record, playback, history, and conversational agent integration.
4. **Report** – Project progress and status summary.
5. **Foundational data schema** – Postgres JSONB tables (`audio_files`, `transcripts`, `daily_question`, `daily_summaries`, `period_reflections`) suitable for future extensions.
