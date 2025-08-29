**Project Description**

EchoJournal, is developing an diary application to help digital diary writers capture their daily reflections with voice transcription. EchoJournal begins with voice transcription as the gateway to your thoughts. From there, it provides high-accuracy, AI-powered organization of your journal entries and a companion powered by a state-of-the-art voice-native large language model.

### **Features**

- **Journal‑centric Agent** (Alpha Feature) — Built on the cutting-edged voice native llm, the voice agent understands context, emotion and timelines, letting users ask things like "What patterns did you notice in my mood the last three months?" or "Remind me of the goals I set after my Japan trip."

  - **Life‑Term Memory powered by agentic RAG orchestration system** — Each entry is broken into structured facets (mood, topics, entities, goals) stored in Postgres JSONB and mirrored as a Neo4j knowledge graph. Full text is embedded into Supabase Vector for semantic recall.
  - **Human-level voice interaction experience** — By adopt state-of-the-art voice-native models to ensure the interaction feels as natural as speaking with a human companion—supporting real-time interruptions, natural tone and inflection, emotionally stable responses, supportive personality traits, multilingual interaction, and seamless language switching.
  - **Customiseable voice** - Users can personalize the assistant's tone, pronunciation, personality, and speech speed.

- **Voice-focused User interaction on Journal taking**— A hybrid STT pipeline feeds the assistant, but remains behind the scenes—the journal taking will almost exclusively with the conversational agent.

  - **Conversational Input to Journal Format:** A hybrid speech-to-text (STT) pipeline powers the assistant while remaining invisible to the user—interactions are fully conversational.
  - **Voice Recording & Real-Time Subtitles(optional):** Voice entries are saved with synchronized transcription display.
  - **Automatic Sentiment and Goal Detection:** The system analyzes content to infer mood and identify implicit personal goals.

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
- RAG latency: Two‑stage retrieval (metadata → vector), edge caching
- Privacy & compliance: end-to-end encryption, local key storage, regular audits

### **Deliverables**

1. **Agentic AI voice system** (OpenAI Agent SDK / LangGraph).
2. **Agentic RAG system** (Supabase, mem0, Firebase, neo4j, langgraph).
3. **Minimalist Web UI (PWA):** Record, playback, history and converse with the agentic system
4. **Report** – A report of the project progress and status.
5. **Foundational Data Schema** – Postgres JSONB + vector index + graph, ready for future feature pivots.
