# Final Report

School of Computer Science Postgraduate Capstone Project

COMP5709/DATA5709/CSEC5709

Changhao Wang (530357966)

## Abstract

**Requirements:** The abstract should be between 150-600 words. Briefly summarise your project/research. The abstract is usually written last, when you have a clear idea of your project as a whole. The aim of this section is to quickly introduce the reader to the project, and ideally engage their interest and encourage them to read the rest of the proposal. You should include an overview of the project, its motivation, the objectives, and the methods you have used, and discussions and findings. Do not include details in this section , you will have plenty of space in later sections. Also remember that the reader may not understand the technical details of your project so avoid jargon and leave in-depth discussion for later sections.

## Table of Contents

- [Abstract](#abstract)
- [1. Introduction](#introduction)
- [2. Related Literature](#related-literature)
  - [2.1 Literature Review](#literature-review)
- [3. Research/Project Problems](#researchproject-problems)
  - [3.1 Research/Project Aims & Objectives](#researchproject-aims-objectives)
  - [3.2 Research/Project Questions](#researchproject-questions)
  - [3.3 Research/Project Scope](#researchproject-scope)
- [4. Methodologies](#methodologies)
  - [4.1 Methods](#methods)
  - [4.2 Data Collection](#data-collection)
  - [4.3 Data Analysis](#data-analysis)
  - [4.4 Deployment](#deployment)
  - [4.5 Testing](#testing)
- [5. Resources](#resources)
  - [5.1 Hardware & Software](#hardware-software)
  - [5.2 Materials](#materials)
- [6. Milestones / Schedule](#milestones-schedule)
- [7. Results](#results)
- [8. Discussion](#discussion)
- [9. Limitations and Future Works](#limitations-and-future-works)
- [References](#references)

---

**Note:** The final report has a similar structure to the proposal and it is acceptable to reuse some of the materials from the proposal (i.e., the literature review). However, when you reuse the materials, you need to keep in mind that the similarity score of any report cannot be higher than 35%. Therefore, please revise and update the content with relevant literature to complement your results/discussions/findings.

---

# Introduction

**Requirements:** In this section you will describe the context of your project. You will introduce the general background knowledge needed to understand the research topic (as it relates to your proposal), the motivation for your project, and the benefits that may be provided by addressing the research question. This should enable a clear and concise description of the problem that your proposal addresses. Write in a way that people or reader who does not have the same background will be able to follow or understand. No technical information is needed to be described in this section.

In contemporary life, digital tools have become deeply embedded in how people manage their well‑being, organise their time, and reflect on their experiences. Among these tools, journaling is widely recognised as a simple but powerful practice for emotional regulation, self‑reflection, and long‑term personal growth. Prior work on expressive writing and self‑disclosure suggests that regularly externalising thoughts and feelings can improve mood, resilience, and even physical health over time. However, the existence of these benefits does not automatically translate into widespread or sustained adoption of journaling in everyday life.

In practice, many users struggle to maintain a consistent digital journaling habit. Writing long‑form text on a keyboard or mobile screen often feels effortful, especially on busy days or during emotionally intense moments when people have the most to say but the least patience to type. Early user interviews and observations around digital journaling platforms indicate that a significant proportion of users abandon journaling apps within the first few weeks, frequently citing typing fatigue, time pressure, or the sense that “it is too much work” to keep entries updated. At the same time, simple voice memos—while convenient to record—tend to accumulate as unstructured audio files that are difficult to revisit, search, or reflect on in a meaningful way. As a result, important insights about mood, goals, and life events remain fragmented and effectively inaccessible.

Recent advances in artificial intelligence, particularly in speech recognition and large language models (LLMs), create an opportunity to rethink what a digital journaling experience can look like. High‑quality speech‑to‑text models now make it feasible to transcribe spontaneous spoken reflections with reasonable accuracy, even in casual or emotionally charged speech. In parallel, LLMs are increasingly capable of transforming raw text into coherent summaries, extracting patterns, and generating supportive, conversational feedback. When combined, these capabilities suggest a new interaction paradigm: instead of typing into a static diary, users could simply talk to a system that listens, organises their reflections, and acts as an intelligent companion over time.

EchoJournal is designed within this emerging space as a voice‑first journaling application that lowers the friction of self‑reflection while preserving the depth and long‑term value of traditional diaries. Rather than treating voice notes as disposable recordings, EchoJournal treats them as primary input into a structured personal knowledge base. Users speak about their day, their emotions, or specific events; the system transcribes these recordings, rewrites them into readable first‑person entries, and organises them into daily summaries and periodic reflections. Over time, this creates a searchable, emotionally aware history that users can revisit in a more intentional way than scrolling through raw audio files.

A central motivation for this project is the observation that people often lack an accessible way to “look back” on their lives in context. They may remember isolated highlights or low points, but not the gradual shifts in mood, habits, or goals. EchoJournal aims to bridge this gap by combining low‑effort capture with high‑value retrieval and reflection. The application not only records what users say but also helps them see patterns: for example, how their mood has evolved over the past few months, which commitments they tend to follow through on, or how major life events influenced their emotional trajectory. This perspective is particularly relevant in the broader digital wellness landscape, where there is growing interest in tools that support self‑awareness and behaviour change without replacing professional mental health services.

Another important aspect of the project is interaction design. Human conversations are naturally spoken, time‑based, and emotionally nuanced, whereas most digital journaling tools still rely on static text fields and rigid interfaces. EchoJournal explores a more human‑centred modality by letting users interact with an AI companion through voice. The assistant is designed to understand references to time (for example, “last week” or “over the past three months”), recall relevant context from past entries, and respond in a supportive and reflective tone. Instead of simply presenting charts or lists, the system can answer questions such as “What patterns have you noticed in my mood recently?” or “What goals did I set after my Japan trip?”, making the experience feel closer to talking with a thoughtful partner than operating a piece of software.

At the same time, the project is grounded in strong privacy and security considerations. Personal diaries often contain highly sensitive information about mental health, relationships, and life decisions. Any system that records, transcribes, and analyses such data must therefore be designed with confidentiality as a core requirement rather than an afterthought. EchoJournal takes a conservative stance on how AI components access personal data: instead of pushing all journal content into a long‑lived, global retrieval system, the assistant relies on purpose‑built tools that fetch only the specific context needed for a given interaction within a temporary session. This design reduces unnecessary data exposure and avoids coupling user privacy to the internal behaviour of large, evolving models, while still allowing the system to provide personalised, context‑aware support.

EchoJournal originated as a postgraduate capstone project but has also received early validation in an entrepreneurial context. The concept was accepted into the University of Sydney’s Genesis program, a competitive startup incubator, indicating that the idea resonates beyond an academic setting. This dual identity—as both a research‑driven prototype and a potential commercial product—shapes the project’s goals. On the one hand, the project seeks to explore how voice‑first interaction and AI‑driven analysis can improve personal journaling. On the other hand, it aims to demonstrate a realistic, deployable system that could serve real users in the near term.

In summary, this project addresses a concrete gap between the proven psychological benefits of journaling and the practical difficulties people face in maintaining a journaling habit. By leveraging voice input, modern AI models, careful interaction design, and privacy‑by‑design principles, EchoJournal aspires to make reflective practice more natural, sustainable, and personally meaningful. The remainder of this report details the relevant literature, the specific research questions and scope, the methodologies used to design and implement the system, and the results and implications of deploying a voice‑first AI journaling application in practice.

# Related Literature

This project sits at the intersection of several research and practice areas: expressive writing and digital journaling for well‑being, voice‑based and conversational interfaces, AI‑powered personal assistants, and privacy‑conscious handling of sensitive data. Understanding prior work in these domains is essential for positioning EchoJournal, clarifying what is genuinely new, and identifying where the system deliberately follows established best practices. This section reviews key strands of literature that inform the design of EchoJournal and highlights the gaps that motivate the project.

The related work can be grouped into four broad themes. First, research on expressive writing and journaling provides the psychological foundation for why recording and revisiting personal experiences can benefit mental health and self‑reflection. Second, studies on digital behaviour and user experience explain why many people still fail to sustain journaling habits despite knowing about these benefits. Third, work on conversational agents and voice interfaces demonstrates how natural, dialog‑based interaction can support emotional support and engagement, but also reveals limitations when such systems are not grounded in a rich, personal context. Finally, recent advances in large language models, retrieval techniques, and privacy‑preserving data practices provide both opportunities and constraints for building AI‑driven, voice‑first journaling systems that handle highly sensitive information.

## Literature Review

Journaling and expressive writing have a long history in psychology as tools for emotional processing, coping, and meaning‑making. Classic work on expressive writing shows that regularly putting thoughts and feelings into words can lead to improvements in psychological well‑being and, in some cases, physical health indicators over time (e.g., Pennebaker & Chung, 2011). These studies typically involve participants writing about stressful or personally significant experiences over multiple sessions, and they suggest that structured reflection helps people organise their experiences and integrate them into a coherent life narrative. More recent digital health research extends these ideas into online and mobile contexts, where journaling becomes one element of broader interventions for mood tracking, stress management, or behavioural change.

Despite this evidence, there is also a substantial body of work documenting the challenges of sustaining digital health behaviours. Many users begin journaling or tracking with enthusiasm but gradually drop off as the perceived effort outweighs the perceived benefit. In the context of journaling, typing long entries on smartphones or laptops can feel laborious, particularly when users are tired, busy, or emotionally overwhelmed. Studies of mobile app engagement report high attrition rates for self‑tracking and well‑being applications, often within the first few weeks of use. Together, these findings suggest that reducing friction at the point of capture is crucial if journaling is to become a sustainable habit in everyday life.

At the same time, research on user engagement in digital health and behaviour‑change interventions emphasises that interface and interaction design are as important as core functionality. Frameworks such as persuasive systems design and the Fogg behaviour model highlight that even well‑designed interventions may fail if they require too much effort at the moment of use or if the desired actions are not salient and easy to perform. Empirical studies of mobile health apps consistently find that clearer navigation, responsive layouts, and context‑appropriate prompts are associated with higher adherence and longer‑term retention. In other words, seamless, “low‑friction” user experiences are not merely aesthetic choices; they directly influence whether users return to an application often enough for its psychological benefits to materialise.

Voice‑based interaction has been proposed as one way to lower this barrier. Speech is a primary and highly natural human communication channel, and many people find it easier to “talk through” their day than to write it down. Advances in automatic speech recognition have significantly improved the feasibility of voice‑based applications, enabling robust transcription of conversational speech across a range of accents and environments (e.g., Radford et al., 2022). Parallel work in computational paralinguistics explores how vocal features can reflect emotional states and personality traits, highlighting the potential richness of voice as a medium for capturing affective information. These developments have inspired a range of voice diaries and note‑taking tools, but many such systems still treat recordings as isolated artefacts rather than integrating them into a long‑term, structured reflection process.

In parallel, conversational agents and chatbots have emerged as an accessible way to deliver psychological support and self‑help interventions at scale. Systems such as Woebot demonstrate that fully automated conversational agents can deliver elements of cognitive‑behavioural therapy and reduce self‑reported symptoms of anxiety and depression in non‑clinical populations (Fitzpatrick et al., 2017). Other studies examine how people form ongoing relationships with chatbots, treating them as companions, confidants, or coaching partners. These findings suggest that dialog‑based interfaces can feel engaging and supportive, especially when they adopt an empathetic tone and provide timely, context‑aware responses. However, many existing agents operate primarily on ephemeral conversation history or generic prompts; they do not always maintain a rich, structured memory of the user’s long‑term experiences that can be queried in a precise, transparent way.

Recent progress in large language models and retrieval‑augmented generation (RAG) provides one avenue for building more context‑aware assistants. In RAG architectures, a model retrieves relevant documents from an external knowledge base and conditions its responses on that material, allowing the system to ground its outputs in factual or personalised data (Lewis et al., 2020). For personal information management, this raises both opportunities and challenges. On the positive side, RAG can, in principle, enable an assistant to answer detailed questions about a user’s history, goals, and patterns. On the other hand, storing and retrieving large volumes of intimate diary content through generic retrieval pipelines introduces privacy, transparency, and controllability concerns, especially when the retrieval behaviour of the model is difficult to predict or audit. Knowledge‑graph approaches face similar trade‑offs: they provide rich, interconnected representations but also risk over‑exposing relationships that users might consider private.

Literature on privacy and security in digital health systems reinforces the need for cautious handling of sensitive data. Work on encryption, secure messaging, and data protection frameworks emphasises that technical safeguards must be complemented by clear data‑minimisation strategies and least‑privilege access policies. In the context of AI‑driven applications, this implies not only securing storage and transport of data, but also carefully controlling when and how models can access personal information. There is growing recognition that “always‑on” data collection and broad‑scope retrieval can erode user trust, particularly in domains involving mental health, relationships, and identity.

Taken together, these strands of literature reveal both an opportunity and a gap. On the one hand, there is strong evidence that journaling and reflective practice can be beneficial; voice and conversational interfaces can make these practices more accessible and engaging; and modern AI models can help users extract patterns and insights from large collections of personal data. On the other hand, many existing systems tackle only one part of this puzzle: they may offer text‑based journaling without low‑friction capture, or they provide chatbots without deep integration into a user’s long‑term history, or they propose powerful retrieval mechanisms without fully addressing privacy and user control. EchoJournal aims to contribute to this space by combining a voice‑first journaling experience, structured daily and periodic reflections, and a voice‑native AI companion that accesses personal data through explicit, purpose‑built tools within temporary sessions. This approach seeks to retain the benefits of AI‑assisted reflection while aligning with emerging best practices in digital well‑being and privacy‑by‑design.

# Research/Project Problems

Digital journaling sits in a curious position: it is widely recommended as a low‑cost practice for improving self‑awareness and emotional well‑being, yet many people struggle to sustain it beyond the first few weeks. Existing work highlights that users often abandon journaling apps because they find typing long entries time‑consuming, cognitively demanding, or simply incompatible with how they naturally reflect at the end of a day. At the same time, simple voice memos and note‑taking tools lower the barrier to recording but rarely provide meaningful support for organising, revisiting, or learning from past entries. Users accumulate large collections of unstructured audio or text that are difficult to search and even harder to relate to broader patterns in mood, goals, or life events.

Beyond the mechanics of input, there are deeper challenges around reflection and engagement. Many current systems focus either on capturing entries or on presenting basic statistics (for example, mood charts or streak counters), but they do not actively help users interpret their own histories in context. Users who wish to ask more complex questions—such as how their mood has evolved over several months, which commitments they tend to keep, or how major events affected their emotional trajectory—often lack tools that can answer these questions in an intelligible and supportive way. Conversational agents and chatbots offer one promising direction, but without access to a structured, privacy‑respecting memory of the user’s diary, they risk falling back to generic advice or superficial encouragement.

There is also a growing recognition that user experience and interaction design play a crucial role in whether people continue to use well‑being applications. Fragmented interfaces, heavy navigation, or visually cluttered dashboards can make even a powerful system feel difficult to approach in everyday life. Conversely, a seamless, mobile‑friendly interface that foregrounds the right actions at the right time can make it significantly easier for users to integrate journaling into their routines. For a voice‑first system, this includes not only visual layout but also how recording, playback, and AI interactions are orchestrated in a way that feels fluid rather than technical.

Finally, any system that records, transcribes, and analyses highly personal reflections must consider privacy and trust as first‑class concerns. Conventional retrieval‑augmented generation (RAG) and long‑lived knowledge‑graph approaches can offer powerful recall over a user’s history, but they also introduce questions about how much sensitive data is stored, how it is retrieved, and how tightly it is coupled to the internal behaviour of large models. For many users, it is not enough that a system is technically secure; they also need to understand and feel comfortable with when and how their data is accessed by AI components.

Taken together, the core problem this project addresses can be stated as follows: how can we design, implement, and critically reflect on a voice‑first, AI‑augmented journaling system that (1) reduces the effort required to capture daily experiences, (2) supports meaningful, long‑term reflection on mood and goals, (3) presents a seamless and approachable user experience, and (4) respects strong privacy expectations by limiting how AI components access and use personal data?

## Research/Project Aims & Objectives

The overarching aim of this project is to design and implement a voice‑first, AI‑enhanced journaling system that makes reflective practice more accessible, engaging, and privacy‑conscious, while remaining realistic to deploy as a modern web application. Within this broad aim, the work is structured around a set of concrete objectives that guide both the implementation and the subsequent evaluation.

The specific objectives are:

- **O1 – Voice‑first daily journaling pipeline.** Implement a browser‑based pipeline that allows users to record spoken reflections, transcribe them to text, and rewrite them into readable first‑person entries with minimal friction.
- **O2 – Structured daily and periodic reflections.** Develop mechanisms to automatically generate daily, weekly, and monthly summaries that highlight key themes, moods, and commitments, and present them in a way that supports long‑term reflection.
- **O3 – Voice‑native AI companion.** Build a voice‑driven AI companion that can engage in natural conversations about a user’s past entries, answer questions about patterns over time, and provide supportive, reflective feedback.
- **O4 – Privacy‑aware context access.** Design and integrate a context‑access approach in which the AI retrieves personal data through explicit, purpose‑built tools and temporary sessions, rather than relying on long‑lived, generic RAG or knowledge‑graph pipelines.
- **O5 – Technical and integration evaluation.** Examine the practical challenges of combining web audio recording, speech recognition, language modelling, and cloud data services within a single Progressive Web App, and document how these challenges are addressed in the implementation.
- **O6 – Seamless, retention‑supporting user experience.** Investigate how a PWA‑first, mobile‑friendly interface and interaction design—covering elements such as the overview dashboard, journaling flows, and reflection views—can contribute to a seamless experience that encourages users to return and continue journaling over time.

## Research/Project Questions

Aligned with these objectives, the project is guided by the following research and design questions:

- **RQ1 – Voice‑first capture:** How can a voice‑first journaling pipeline be implemented in a web environment, and to what extent does it reduce the perceived effort and friction compared with traditional text‑based digital journaling?
- **RQ2 – Reflections and pattern awareness:** To what extent do automatically generated daily, weekly, and monthly reflections help users identify emotional patterns, behavioural trends, and goal progress in their journals?
- **RQ3 – Context‑aware yet privacy‑respecting AI:** How well does a tool‑based, temporary‑session approach to context retrieval support useful, personalised AI conversations about a user’s history while aligning with strong privacy expectations?
- **RQ4 – AI companionship and engagement:** In what ways can a voice‑native AI companion provide supportive, engaging dialogue that feels more like a reflective partner than a generic chatbot, and what limitations emerge in practice?
- **RQ5 – Engineering trade‑offs:** What technical and integration challenges arise when combining browser audio APIs, speech‑to‑text models, summarisation models, and a cloud‑hosted data backend, and how can these challenges be mitigated within the constraints of a capstone project?
- **RQ6 – User experience and retention:** How do specific user interface and interaction design choices—for example, push‑to‑talk controls, the layout of the dashboard, and the presentation of reflection cards—influence perceived seamlessness, user satisfaction, and willingness to continue using the system over time?

## Research/Project Scope

The problem space around mental health, behaviour change, and AI‑mediated reflection is broad, and it is not feasible for a single capstone project to address all aspects of it. This report therefore focuses on a clearly bounded scope that balances ambition with practicality.

On the implementation side, the scope includes:

- Designing and building a web‑based Progressive Web App that runs in modern browsers on desktop and mobile devices.
- Implementing the three main functional modules: daily records (mood check‑ins and audio journals), structured reflections (daily, weekly, and monthly “Echos”), and a voice‑native AI companion.
- Integrating core AI services for speech‑to‑text transcription and text‑based summarisation, as well as a real‑time voice agent for conversational interaction.
- Establishing a relational data model and backend using managed cloud services, along with essential security measures such as authentication, row‑level access control, and CSRF protection.
- Conducting a combination of manual evaluations and targeted automated tests to validate key flows, supported by logs and qualitative observations.

Several important areas are deliberately kept out of scope or treated only at a conceptual level:

- Developing native mobile applications or offline‑first functionality; the focus remains on a web‑based PWA.
- Implementing a full‑scale RAG or knowledge‑graph memory system; instead, the project evaluates a more constrained, tool‑based context access pattern.
- Performing large‑scale clinical or longitudinal studies on the psychological impact of the system; any evaluation remains exploratory and limited to small‑scale usage and developer observations.
- Integrating with third‑party health platforms, wearables, or enterprise wellness programs.

By defining this scope, the project can make concrete contributions in the design and implementation of a voice‑first, AI‑augmented journaling system, while clearly acknowledging that questions about long‑term clinical effectiveness, large‑scale deployment, and broader ecosystem integration lie beyond the boundaries of this work and are candidates for future research.

# Methodologies

## Methods

The methodology of this project follows a design‑science and feature‑driven software engineering approach. The primary artefact is a functioning web application that embodies the ideas discussed in the earlier sections: a voice‑first, AI‑augmented journaling system with structured reflections and a privacy‑aware context model. Rather than treating implementation and evaluation as separate phases, the project iterates between designing, building, and reflecting on the artefact, using each iteration to refine both the system and the underlying research questions.

### Overall Approach

The project is organised around iterative, feature‑based development cycles. Early iterations focused on implementing the core daily record pipeline (Module A), followed by structured reflections (Module B), and finally the voice‑native AI companion (Module C). Each module is developed as a relatively self‑contained feature set, with clear responsibilities and integration points, allowing the system to grow incrementally while keeping complexity manageable.

From an interaction perspective, EchoJournal is implemented as a mobile‑oriented Progressive Web App (PWA). Although it runs in any modern browser, the layout, navigation, and interaction patterns are primarily optimised for smartphone use: the dashboard is designed for thumb‑reachable controls, the audio recorder is centred around a large push‑to‑talk affordance, and reflection views are structured as swipe‑friendly cards. This mobile‑first orientation aligns with the reality that many users engage in journaling and self‑reflection in short, informal sessions on their phones rather than on desktop computers.

The choice of an iterative, PWA‑based approach reflects both practical and research considerations. Practically, it allows rapid deployment, testing, and refinement within the constraints of a capstone project. From a research perspective, it enables the team to observe how the combination of voice‑first input, structured reflections, and mobile‑friendly UI design interacts with the barriers and opportunities identified in the literature.

### System Architecture and Module Design

At the architectural level, the system adopts a layered design built on a modern web stack. Next.js 15 with the App Router and React provides a unified platform for both client‑side interaction and server‑side API routes. Clerk handles user authentication and session management in the frontend and API layers, while Supabase supplies a managed PostgreSQL database, file storage, and row‑level security policies, acting as the single source of truth for user data. OpenAI services provide speech‑to‑text transcription, text summarisation, and realtime voice agent capabilities.

Within this stack, the application is structured around three main functional modules:

- **Module A – Daily Record:** Implements daily mood check‑ins and audio journaling. The methodological focus here is on lowering the friction of capture while preserving enough structure (for example, mood questionnaires and time‑bounded recordings) to support later analysis.
- **Module B – Echos (Reflections):** Aggregates daily summaries and mood data into structured daily, weekly, and monthly reflection cards. This module operationalises the idea of periodic, AI‑assisted reflection and provides a concrete surface for evaluating how well the system surfaces meaningful patterns.
- **Module C – Voice Companion:** Provides a voice‑native AI companion that can converse about the user’s history using a tool‑based context model. This module allows the project to explore how conversational interfaces can be grounded in a user’s own data without resorting to unconstrained retrieval over a large, opaque memory.

This modular design is not only a software engineering choice but also a methodological one. It enables the project to examine each research question in a focused way—for example, evaluating voice‑first capture primarily within Module A, or periodic reflections within Module B—while still understanding how the modules interact as a cohesive system.

### Privacy‑by‑Design and Context Access

Given the sensitivity of journaling data, privacy and security considerations are integrated into the methodology from the outset rather than being treated as an afterthought. At the data layer, the system uses a relational schema with per‑user isolation enforced by row‑level security policies. All access to core tables such as audio files, transcripts, daily summaries, and reflections is scoped to the authenticated user, with administrative operations restricted to server‑side contexts.

For AI integration, the project deliberately avoids pushing all diary content into a long‑lived vector store or global knowledge graph. Instead, it adopts a tool‑based context access model: the voice agent calls explicit tools (such as a “fetch user context” function) that query the database for well‑defined slices of data—typically for a specific day, week, or month—within a temporary session. This approach embodies a privacy‑by‑design methodology in which:

- The scope of each AI operation is clearly bounded by time and user identity.
- Data minimisation is enforced at the level of tool inputs, rather than relying solely on downstream model behaviour.
- The system can evolve its prompts and tools without altering the underlying guarantees about how much personal data is exposed in a given interaction.

By combining a mobile‑oriented PWA, a modular architecture, and a conservative context‑access strategy, the methods used in this project aim to balance ambitious interaction design with realistic engineering constraints and strong privacy expectations.

## Data Collection

Data collection in this project serves two distinct but related purposes. First, the system must capture rich, structured data about users’ reflections in order to deliver its core functionality—voice journaling, mood tracking, and AI‑generated summaries. Second, the project needs sufficient observational data about how the system is used to evaluate the research questions outlined earlier. In both cases, data collection is constrained by strong privacy considerations and by the practical scope of a capstone project; the emphasis is on depth and quality of data per user rather than on large sample sizes.

### Application Data

The primary source of data is the application itself, running as a mobile‑oriented PWA in real browsers. When a logged‑in user interacts with EchoJournal, the following categories of data are collected and stored in Supabase under their account:

- **Voice journals and transcripts:** Audio recordings captured via the browser’s media APIs are uploaded to a secure storage bucket, with metadata recorded in the `audio_files` table (for example, user identifier, storage path, timestamps). Corresponding speech‑to‑text transcripts and AI‑rewritten entries are stored in the `transcripts` table, linked to the original audio.
- **Daily mood check‑ins:** Responses to the daily mood questionnaire are stored in the `daily_question` table, including overall day quality and selected emotions. Each record is associated with a specific date and user identifier, enabling later aggregation with journal content.
- **Daily and periodic summaries:** AI‑generated daily summaries and structured reflections (daily, weekly, monthly “Echos”) are stored in the `daily_summaries` and `period_reflections` tables. These records capture both the generated text (for example, achievements, commitments, mood explanations) and metadata such as generation timestamps and whether entries have been manually edited.

All of this application data is created during normal use of the system. For the purposes of this project, usage is limited to the author and a small number of informal testers; there is no public release or large‑scale deployment. This allows the project to generate realistic data flows while keeping the total volume of sensitive information under tight control.

### Interaction and Usage Data

To understand how the system supports (or fails to support) seamless journaling and reflection, the project also collects lightweight interaction and usage data. This includes:

- **Feature‑level usage counts:** For example, how often the daily mood modal is completed, how many audio recordings are created and processed, how frequently reflection cards are generated or refreshed, and how often the voice companion is invoked.
- **Session‑level observations:** Informal notes on when and how the PWA is used on mobile devices (for instance, typical session length, whether users complete tasks in one sitting or across multiple visits, and how often they return to the dashboard).
- **Error and performance logs:** Selected server‑side logs and development‑time metrics (for example, transcription latency, reflection generation time, and realtime connection stability) that help diagnose engineering trade‑offs relevant to RQ5.

These interaction data are obtained through a combination of Supabase query logs, limited analytics tools in the development environment, and manual observation recorded in development journals. No invasive tracking or third‑party advertising analytics are used; the focus is on metrics that directly inform system design and research questions, such as perceived friction and retention‑relevant behaviour.

### Development and Test Data

Finally, the project makes use of development and test data to validate functionality and explore edge cases:

- **Synthetic and seeded content:** Sample audio recordings and journal entries created by the author are used to test transcription, summarisation, and reflection pipelines without relying solely on long‑term personal data.
- **Automated test fixtures:** Unit and integration tests use fixture data to simulate database rows, API responses, and error conditions. These fixtures mirror the shape of real records in tables such as `audio_files`, `transcripts`, `daily_summaries`, and `period_reflections` but do not contain sensitive content.
- **Manual test scenarios:** Structured test cases described in the testing documentation (for example, “record and summarise a 10‑minute journal”, “generate and edit a weekly reflection”, “invoke the voice agent with different time‑range questions”) guide how the system is exercised during development.

Across all categories, data collection is limited to what is necessary to operate and evaluate the system within the scope of this project. Personal identifiers are confined to the managed authentication and database layers, and there is no attempt to combine EchoJournal data with external datasets or third‑party profiles. This constrained, privacy‑aware collection strategy aligns with the project’s methodological focus: understanding the behaviour and implications of a voice‑first, AI‑assisted journaling system at small scale, rather than maximising the quantity of data.

## Data Analysis

The analysis methods in this project are primarily descriptive and qualitative, reflecting the exploratory nature and small scale of the work. Rather than aiming for statistical generalisation, the goal is to understand how the implemented system behaves in practice and how well it addresses the research questions defined earlier.

At a high level, the analysis proceeds along three axes:

- examining sample application data (journals, summaries, reflections) to assess the quality and usefulness of AI‑generated outputs;
- interpreting interaction and usage patterns to understand friction, engagement, and retention‑related behaviour in the mobile‑oriented PWA;
- reviewing development and test data to identify engineering trade‑offs and reliability characteristics.

### Analysing Application Data

For research questions related to reflection quality and AI support (RQ2, RQ3, RQ4), the project uses close reading and comparative analysis of sample records:

- **Daily and periodic reflections (RQ2):** A subset of daily summaries and weekly/monthly reflection cards is inspected alongside the underlying journal entries and mood check‑ins. The analysis asks whether the summaries capture the main themes, emotional tone, and key events of the period, and whether the structured fields (for example, achievements, commitments, flashbacks) align with what a human reader would consider salient.
- **Context‑aware conversations (RQ3, RQ4):** Transcripts of selected interactions with the voice companion are reviewed to determine whether the agent retrieves the correct time‑bounded context (for example, “last week”, “the past month”), responds with information grounded in the user’s data rather than generic advice, and maintains an appropriate, supportive tone. Particular attention is paid to how well the tool‑based context model respects the intended privacy boundaries while still enabling meaningful answers.

These analyses are qualitative and narrative rather than numerical: findings are presented as examples and patterns observed across multiple cases, not as aggregate statistics over a large population.

### Analysing Interaction and Usage Data

For questions about voice‑first capture, user experience, and retention (RQ1, RQ6), the project combines lightweight metrics with observational insights:

- **Usage metrics:** Feature‑level counts (such as the number of recordings, completed mood check‑ins, and generated reflection cards) are aggregated over the evaluation period. While absolute numbers are small, trends such as increased use after specific UI refinements or reduced drop‑off in particular flows are noted.
- **Flow and friction analysis:** Typical user journeys—such as “open dashboard → record audio → review summary” or “open reflections page → swipe through cards → edit a commitment”—are mapped out, and points where users hesitate, make errors, or abandon tasks are recorded during manual testing sessions. These observations inform judgements about perceived friction and the effectiveness of mobile‑first design choices.

Again, the emphasis is on understanding how the interface and interaction patterns influence the experience of journaling and reflection, rather than on precise numerical estimates of retention rates.

### Analysing Engineering and Test Data

For the engineering‑focused research question (RQ5), the project analyses development and test data to characterise technical trade‑offs:

- **Performance and reliability:** Logs and development‑time metrics are used to estimate typical and worst‑case latencies for key operations such as transcription, summary generation, and reflection syncing, as well as the stability of realtime voice sessions. These measurements are interpreted in the context of user experience—for example, whether delays remain acceptable for conversational use.
- **Test outcomes:** Results from unit and integration tests, along with manual test scenarios, are reviewed to identify recurring failure modes, integration pain points (such as authentication boundaries between Clerk and Supabase), and areas where additional safeguards were needed (for example, stricter input validation or improved error messages).

The conclusions drawn from these analyses are correspondingly scoped: they speak to the behaviour and feasibility of EchoJournal as implemented in this project, rather than making claims about all possible voice‑first journaling systems.

## Deployment

Deployment in this project focuses on making the EchoJournal prototype reliably accessible as a web application while preserving the security and privacy properties described earlier. Rather than building and operating custom infrastructure, the project leverages managed platforms that are well suited to small, iterative web applications: Vercel for hosting the Next.js app and Supabase for database and storage services, with Clerk providing hosted authentication.

### Hosting and Environments

The application is deployed on Vercel, which natively supports Next.js 15 and the App Router. This choice simplifies the deployment pipeline: commits to the main branch of the project’s Git repository trigger automatic builds and deployments to a production URL, while pull requests and feature branches can be deployed to temporary preview environments. This model aligns with the project’s iterative methods, making it easy to test new features on real devices before merging them.

Supabase hosts the PostgreSQL database and file storage used by the application. The production Supabase project runs with row‑level security enabled for core tables and exposes only the minimal keys required by the frontend (for example, an anonymous client key) and by server‑side API routes (for example, a service‑role key held in server‑only environment variables). Clerk manages user authentication and sits at the boundary between the browser and the backend: the frontend uses Clerk components and hooks to handle sign‑in and session state, while server‑side logic relies on Clerk’s server SDK to identify the current user.

For the purposes of this capstone project, the effective environment set‑up is intentionally simple: a local development environment using `.env.local` files and a single production‑like deployment on Vercel and Supabase. This is sufficient to exercise the full stack—from the mobile‑oriented PWA shell through to the AI integrations—without introducing the operational overhead of multiple staging environments.

### Configuration and Security Considerations

Sensitive configuration values, including API keys for OpenAI, Supabase service‑role credentials, and Clerk secrets, are managed exclusively through environment variables in the Vercel and Supabase dashboards and in local `.env` files that are not committed to version control. The Next.js build distinguishes between public and server‑only variables, ensuring that secret keys are never exposed to client‑side code.

On the backend, all database access from the browser goes through the Supabase anonymous client with row‑level security enforcing per‑user isolation. Server‑side API routes that need elevated privileges—such as audio transcription, reflection generation, or context tools for the voice agent—use a Supabase admin client initialised with service‑role credentials, but only after verifying the user’s identity via Clerk and, where appropriate, checking the request origin to guard against cross‑site request forgery.

From a deployment‑method perspective, the emphasis is on using platform features (such as Vercel’s serverless functions and Supabase’s managed RLS) to enforce security boundaries, rather than building custom infrastructure. This approach keeps the deployment reproducible and maintainable within the constraints of a student project while still reflecting realistic patterns for modern web applications that handle sensitive personal data.

## Testing

The testing methodology for EchoJournal is designed to balance rigour on core logic and security‑sensitive components with the practical constraints of a capstone project and the use of external AI services. Rather than adopting strict test‑driven development, the project uses a layered strategy informed by the test plan in `docs/testing-doc/test_plan.md`, with emphasis on Modules A–C and cross‑cutting utilities such as timezone handling and security helpers.

### Testing Strategy

Testing is prioritised according to risk and impact:

- **P0:** Daily record pipeline and `/api/transcribe`, reflection generation and sync logic, voice agent state machine and tools, and security helpers (origin checks, search quota, row‑level access assumptions).
- **P1:** Journals listing and filtering, dashboard widgets, and reflection editing endpoints.
- **P2:** Purely presentational components, layout shells, and non‑critical analytics.

Within this prioritisation, the project focuses automated tests on P0 concerns while relying on manual exploratory testing for higher‑level UI flows and realtime audio behaviour. This reflects the reality that some aspects of the system—such as WebRTC connections and device‑specific audio quirks—are difficult to reproduce faithfully in a headless test runner.

### Test Types and Tools

Automated tests are organised under the `tests/` directory and executed with Vitest:

- **Unit tests:** Cover shared libraries (for example, timezone calculations in `lib/timezone`, origin checks in `lib/security`, and quota logic in `lib/agent/search-quota`) and selected module‑specific logic such as mood utilities and the `useVoiceAgent` hook (with mocked realtime sessions). These tests run in a Node environment with `happy-dom` or `jsdom` to simulate browser APIs where needed.
- **Integration tests:** Exercise key server‑side flows in isolation, such as the reflection generation pipeline (`tests/integration/moduleB/generate-reflection.test.ts`) with mocked OpenAI and Supabase clients. These tests validate that API routes orchestrate external services and database operations correctly without hitting real endpoints.
- **Manual end‑to‑end testing:** For flows that depend on real devices or external services—such as recording audio on a mobile browser, running the full transcription and reflection chain, or establishing realtime voice sessions with the agent—the project relies on structured manual tests described in the test plan. These scenarios are executed against the deployed PWA on mobile devices and recorded in development and QA notes.

Vitest is configured to produce both console reports and machine‑readable outputs: a JUnit XML file (`tests/reports/vitest-junit.xml`) and coverage reports (`tests/reports/coverage/`). This supports repeatable test runs and provides visibility into which parts of the codebase are most thoroughly exercised.

### Coverage and Limitations

The most recent automated test run (`pnpm vitest run --coverage`) reports overall line coverage of around 60%, with substantially higher coverage in several critical areas: `lib/timezone` and `lib/security` exceed 90% line coverage, and the search‑quota logic and mood utilities reach 100%. Coverage for the `useVoiceAgent` hook is lower, reflecting the difficulty of fully simulating WebRTC and OpenAI Realtime behaviour in a Node environment; nonetheless, class‑based mocks exercise the core state machine and tool‑invocation paths.

Some modules, particularly parts of the reflections aggregation logic that depend on real database pagination and timezone filters, remain only partially covered by unit tests. Extending coverage there would require either a full database test harness or more extensive integration tests than are feasible within this project. Instead, the current methodology documents these limitations explicitly and treats them as priorities for future work.

Overall, the testing approach aims to ensure that the most safety‑critical and behaviour‑defining parts of EchoJournal—time and date handling, security checks, AI orchestration, and the main journaling pipeline—are exercised by automated tests, while acknowledging that real‑world conversational and audio behaviour must still be validated through careful manual testing on actual devices.

# Resources

## Hardware & Software

The EchoJournal project relies on a combination of commodity hardware, modern web technologies, and hosted cloud services. The resources were chosen to support rapid, iterative development of a mobile‑oriented PWA while remaining realistic for a small team and aligned with common industry practices.

On the hardware side:

- **Development machines:** Modern laptops running macOS, Windows, or Linux with at least 16 GB of RAM and multi‑core CPUs. These machines are used for local development, running the Next.js dev server, executing tests, and building the application.
- **Mobile devices:** A small set of iOS and Android smartphones and tablets used to test the PWA in real‑world conditions, including audio capture quality, touch interactions, and network variability.
- **Audio equipment (optional):** Consumer‑grade and mid‑range microphones and headsets used during testing to evaluate how different input qualities affect transcription accuracy and user experience.

On the software and service side:

- **Frontend framework:** Next.js 15 with React and the App Router is used to implement the PWA, chosen for its first‑class support on Vercel, strong developer tooling, and ability to unify server‑rendered pages with client‑side interactions.
- **Styling and UI components:** Tailwind CSS and shadcn‑ui (built on Radix UI) provide a flexible design system that supports the “intelligent minimalism” visual style and responsive, mobile‑first layouts.
- **Authentication:** Clerk is used for user authentication and session management, offering secure, hosted auth flows that integrate cleanly with Next.js and Supabase without requiring the project to implement its own identity provider.
- **Database and storage:** Supabase provides a managed PostgreSQL database, object storage, and row‑level security. It is selected for its tight integration with JavaScript clients, built‑in authentication compatibility, and ability to enforce per‑user data isolation.
- **AI services:** OpenAI APIs supply speech‑to‑text (Whisper), text summarisation (GPT‑4o‑mini), and realtime voice agent capabilities. These services are chosen for their quality, developer tooling, and alignment with the project’s focus on voice‑native interaction.
- **Testing and tooling:** Vitest, Testing Library, and related Node tooling support unit and integration tests; additional tools such as ESLint and Prettier are used to maintain code quality and consistency. Husky enforces pre‑commit checks, and `pnpm` serves as the primary package manager for installing and running project dependencies.
- **Development environment and collaboration:** A modern IDE (for example, Visual Studio Code) with TypeScript, ESLint, and Git integration is used for day‑to‑day development; Git and GitHub manage version control and code review; Chrome DevTools (including MCP-based helpers) and Supabase MCP integrations assist with debugging and inspecting backend state; Sentry is used selectively for error monitoring in production‑like environments; simple HTTP client tools are used during API design and debugging.

All core services (Vercel, Supabase, Clerk, OpenAI) offer generous free or low‑cost tiers adequate for a capstone project, while still reflecting the types of platforms a production system might use. This makes the resource choices both practically accessible and pedagogically valuable.

## Materials

In addition to hardware and software, the project makes use of several non‑code materials:

- **Documentation and design guidelines:** Internal documents under `docs/`—including project specifications, design guidelines, security notes, testing plans, and troubleshooting guides—serve as reference materials throughout development and evaluation.
- **Development journals:** Module‑specific development journals (`docs/development-journal/module-*.md`) record implementation decisions, challenges, and lessons learned for Modules A, B, and C. These act as complementary material to the main report, providing deeper technical context where needed.
- **Sample and synthetic data:** Curated sample journal entries, audio recordings, and seeded database records are used during testing and demonstration to showcase system behaviour without exposing sensitive personal data.
- **External references:** Academic papers and industry articles on expressive writing, digital health, conversational agents, speech technologies, and privacy inform the design and evaluation of EchoJournal; these are cited in the References section.

Together, these resources enable the project to move from concept to a working, evaluable prototype while staying within the constraints of typical postgraduate capstone work.

# Milestones / Schedule

The EchoJournal project was developed over a single semester (2025 Semester 2). The schedule reflects an iterative, feature‑driven approach: early weeks focus on establishing the core web architecture and Module A, mid‑semester iterations deliver Modules B and C, and the final weeks emphasise testing, security hardening, and documentation.

At a high level, the work can be grouped into four phases:

- **Phase 1 – Analysis and foundation:** Refine research questions, review literature, and set up the core Next.js/Clerk/Supabase stack.
- **Phase 2 – Core functionality:** Implement and stabilise Modules A and B (daily records and reflections).
- **Phase 3 – Voice companion and polish:** Implement Module C, refine the mobile‑oriented PWA experience, and harden security.
- **Phase 4 – Evaluation and reporting:** Consolidate testing, analyse results, and complete the final report and presentation.

The week‑by‑week milestones are summarised below (without calendar dates):

| **Week**   | **Milestone**                                                       | **Key Tasks / Deliverables**                                                                                                                                                                                                                                            |
| ---------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Week 1     | Client meeting I & topic framing                                    | Meet with client (Dr Imdad Ullah) to discuss the initial topic; refine the high‑level research problem; begin background reading on expressive writing, digital journaling, and conversational agents.                                                                  |
| Week 2     | Client meeting II & proposal                                        | Hold a second client meeting to refine scope and expectations; draft the project proposal; align on deliverables, constraints, and evaluation criteria for the semester.                                                                                                |
| Week 3     | Project initialisation                                              | Set up the repository and development environment; initialise a Next.js 15 + React App Router project; configure basic Clerk and Supabase integration; design the initial database schema.                                                                              |
| Week 4     | Core web features I (Module A skeleton)                             | Implement core layout and navigation for the dashboard; create the initial mood check‑in and audio recording components; wire them to Supabase tables; deploy an early PWA prototype to Vercel for internal testing.                                                    |
| Week 5     | Genesis selection & AI integration                                  | Refine the MVP and submit it to the Genesis incubator; confirm selection into the program; integrate OpenAI Whisper for transcription and GPT‑based summarisation; deliver the first end‑to‑end voice‑first journaling flow.                                            |
| Week 6     | Core features II & architecture refinement                          | Complete the Module A daily pipeline (mood + audio + daily summary); begin the journals listing view; explore native mobile options (React Native/Flutter) and formally decide to focus on a mobile‑oriented PWA instead of a separate native app.                      |
| Week 7     | Module B – Echos reflections                                        | Design the reflections schema and APIs; implement daily/weekly/monthly reflection generation; build the initial Echos UI; connect background sync from Module A to ensure reflections stay in step with new journal entries.                                            |
| Week 8     | Core feature testing & optimisation                                 | Conduct functional testing of journaling and reflection flows; optimise recorder state management and UI performance; begin cross‑device browser testing on iOS and Android for the PWA.                                                                                |
| Week 9     | Module C – Voice companion (baseline)                               | Implement token issuance (`/api/agent/token`) and tool endpoints; integrate the voice‑native agent and push‑to‑talk UI; establish realtime sessions using OpenAI Realtime; verify basic context tool calls against Supabase data.                                       |
| Week 10    | Security hardening & system integration tests                       | Apply and verify Supabase row‑level security; strengthen CSRF and origin checks; add search quota controls; update troubleshooting and security documentation; run system integration tests across Modules A–C.                                                         |
| Week 11    | Genesis pitch & performance tuning                                  | Prepare and refine the Genesis accelerator pitch deck; conduct black‑box testing of the full application; profile performance and address bottlenecks; optimise database queries and caching strategies.                                                                |
| Week 12–13 | Client verification & finalisation of implementation and evaluation | Address outstanding issues in Modules A–C; refine UX and security based on test feedback; meet with the client to demonstrate the near‑final system and collect feedback; complete analysis of collected data; draft the Results, Discussion, and Limitations chapters. |
| Week 14    | Deliverables submission                                             | Finalise and submit the written report and accompanying artefacts (source code, documentation, and demonstration materials); perform a final regression pass on the deployed PWA prior to submission.                                                                   |
| Week 15    | Final presentation                                                  | Prepare and deliver the capstone presentation, demonstrating the system to stakeholders and reflecting on project outcomes, client feedback, and lessons learned.                                                                                                       |

# Results

This section summarises the concrete outcomes of the EchoJournal project. It describes the functionality and behaviour of the implemented prototype, relates these outcomes to the research questions, and highlights both the strengths and the practical limitations observed during evaluation.

## 7.1 Prototype Overview

At the end of the project, EchoJournal is delivered as a working, mobile‑oriented Progressive Web App that integrates three major functional modules:

- **Daily records (Module A):** A voice‑first journaling pipeline and daily mood check‑in experience that runs entirely in the browser and persists data in Supabase.
- **Structured reflections (Module B – “Echos”):** AI‑generated daily, weekly, and monthly reflection cards that consolidate mood and journaling data into concise, structured summaries.
- **Voice‑native companion (Module C):** A realtime voice agent that can converse about a user’s history using a tool‑based, privacy‑aware context model.

The system is deployed on Vercel, backed by Supabase (PostgreSQL and storage), and uses Clerk for authentication and OpenAI for speech‑to‑text and language modelling. All major flows, from logging in to recording an entry, generating reflections, and speaking with the agent, can be exercised on modern mobile browsers.

## 7.2 Module A – Daily Records

Module A aims to lower the friction of daily journaling while capturing sufficient structure for later analysis. The implemented features include:

- **Daily mood check‑ins:** On visiting the dashboard, authenticated users see a daily mood modal when no entry exists for the current date. They answer a simple single‑choice question about overall day quality and a multi‑choice question about emotions. Entries can be created and updated, with the “Mood today” widget reflecting the current state in real time.
- **Voice journaling:** Users can record spoken reflections directly in the browser using a push‑to‑record interface. Recordings are limited to ten minutes and show live duration feedback. After stopping, the audio is uploaded to Supabase storage; OpenAI Whisper transcribes the speech and GPT‑4o‑mini rewrites the transcript into a clean, first‑person narrative.
- **Data persistence and linkage:** Audio metadata is stored in the `audio_files` table, transcripts and rewritten entries in `transcripts`, and mood entries in `daily_question`. The system enforces one mood record per user per day while allowing multiple audio journals, each linked to a specific date and user.

From a functional perspective, the pipeline is stable: test runs show that recordings of several minutes can be transcribed and summarised within a few seconds, and that new entries reliably appear in the journaling and reflection views. Manual testing on mobile devices confirms that the PWA interface is usable on small screens, with the recorder and mood check‑ins accessible via thumb‑reachable controls.

## 7.3 Module B – Echos Reflections

Module B builds on Module A’s data to provide higher‑level reflections:

- **Daily summaries:** For each day with journal activity, the system can generate or refresh a daily summary stored in the `daily_summaries` table. Summaries integrate mood information with the content of that day’s journals, highlighting themes, emotional tone, and notable events. Each summary includes structured fields (achievements, commitments, mood explanation, flashback) in addition to a free‑form text summary.
- **Weekly and monthly reflections:** Using the `period_reflections` table, the system aggregates daily summaries across weeks and months to produce reflection cards for longer periods. Each card summarises the user’s recent period in terms of achievements, commitments, mood, and key themes.
- **Echos UI:** The `/dashboard/echos` view presents these reflections as swipeable cards, grouped into daily, weekly, and monthly segments. Cards show concise, readable copy and expose light editing controls, allowing users to adjust AI‑generated text while marking the card as edited.

Sample inspection of daily and period cards shows that the model generally captures the main topics and emotional patterns present in the underlying entries, especially when journals are reasonably detailed. The structured fields provide a useful scaffold for reflection (for example, prompting users to think about achievements and commitments explicitly), though more nuanced or long‑term trends remain an area for future work.

## 7.4 Module C – Voice Companion

Module C introduces a voice‑native companion designed to answer questions about a user’s history and provide supportive, reflective dialogue:

- **Realtime voice sessions:** Users can activate an on‑screen floating button to open a voice panel and start a push‑to‑talk session. The frontend requests a temporary session token from `/api/agent/token`, then establishes a realtime connection to OpenAI’s voice agent endpoint. Sessions are time‑bounded and can be interrupted or resumed by the user.
- **Tool‑based context access:** When the agent needs information about the user’s history, it calls explicit tools exposed by the application—for example, a `fetch user context` tool that retrieves daily summaries, mood entries, and period reflections for a specified time range. These tools query Supabase using time‑bounded parameters (today, week, month, custom ranges) and return structured JSON.
- **Conversational behaviour:** In test interactions, the agent can answer questions such as “What patterns have you noticed in my mood over the past few weeks?” or “Remind me what I was focused on last month,” by using the tools to access relevant summaries and mood data, then generating a natural‑sounding spoken response.

Due to the reliance on live audio, WebRTC, and external services, Module C is primarily evaluated through manual testing rather than automated tests. These tests confirm that the core state machine (session creation, push‑to‑talk, tool calls, teardown) behaves as expected under normal conditions. However, the current implementation depends on seeded or limited real data for demonstrative richness, and comprehensive evaluation of long‑term conversational behaviour remains future work.

## 7.5 Security and Privacy Outcomes

Security and privacy were design priorities and are reflected in the deployed system:

- **Row‑level security:** Supabase row‑level security policies are enabled for key tables (`audio_files`, `transcripts`, `daily_summaries`, `period_reflections`), ensuring that users can only access their own data. Anonymous clients in the browser operate strictly within these policies.
- **Server‑side access control:** API routes that require elevated privileges (for example, audio transcription, reflection generation, agent context tools) are implemented as server‑side handlers that authenticate users via Clerk and use a Supabase admin client only in controlled environments. Origin checks and CSRF safeguards are applied to write endpoints.
- **Context minimisation for AI:** Instead of feeding the entire journal history into a generic vector store or knowledge graph, the system constrains AI access to explicit, time‑bounded tool calls within temporary sessions. This reduces unnecessary exposure of sensitive content and makes it easier to reason about what data the agent can see in each interaction.

These outcomes do not in themselves guarantee formal privacy proofs, but they demonstrate that privacy‑by‑design principles can be applied in a practical, cloud‑hosted system without sacrificing key functionality.

## 7.6 Testing and Quality Results

The testing strategy described earlier yielded the following notable results:

- **Automated coverage:** A Vitest run with coverage reports shows overall line coverage of approximately 60%, with much higher coverage in critical utilities. Timezone handling, origin checking, and search quota logic achieve over 90–100% coverage, indicating strong confidence in cross‑cutting security and time‑based behaviours.
- **Module‑level verification:** Unit tests validate mood utilities and the `useVoiceAgent` hook (with mocked realtime sessions), while integration tests confirm that the reflection generation API orchestrates OpenAI and Supabase correctly. These tests help catch regressions when iterating on prompts, schema changes, or Supabase queries.
- **Manual end‑to‑end tests:** Structured manual scenarios verify that users can (1) sign in, (2) record and process audio, (3) see generated daily and period reflections, and (4) converse with the voice agent about recent history in the deployed PWA. These tests also revealed edge cases—such as network interruptions, long processing times, and empty datasets—that informed improvements to error handling and UI feedback.

Some areas remain only partially covered by automated tests, notably reflections aggregation logic that depends on real database pagination and timezones, and the full behaviour of realtime voice sessions. These are documented limitations rather than overlooked issues, and they provide a clear roadmap for future quality improvements.

Although performance and cost were not primary research targets, they were considered in the design. In practice, typical end‑to‑end latency for recording, transcribing, and summarising short journals falls within a few seconds, which manual testing suggests is acceptable for reflective use. The system caps individual recording sessions at ten minutes and enforces file size limits to avoid excessive processing time or resource usage. Cost‑wise, the most expensive operations—transcription, summarisation, and reflection generation—are tied to explicit user actions or low‑frequency background jobs, and safeguards such as daily reflection quotas and web search limits help keep AI usage within a reasonable budget for a student‑scale deployment.

## 7.7 Alignment with Research Questions

Finally, the observed outcomes can be mapped back to the research questions:

- **RQ1 – Voice‑first capture:** The implemented voice journaling pipeline demonstrates that a browser‑based, voice‑first interface can reliably capture daily reflections with lower mechanical effort than typing, especially on mobile devices. Informal testing suggests that users are more willing to record short audio entries than to type equivalent text, although formal user studies would be needed to quantify this effect.
- **RQ2 – Reflections and pattern awareness:** Daily and period reflections provide a tangible summary of recent mood and activity. Sample analyses show that users can quickly recall what they focused on during particular weeks or months and see how their mood labels relate to the themes surfaced by the summaries, supporting the intended pattern‑awareness goal.
- **RQ3 – Context‑aware yet privacy‑respecting AI:** The tool‑based, temporary‑session approach allows the voice agent to answer time‑bounded questions using real user data while keeping the scope of each query explicit and limited. This validates, at least at prototype scale, that useful context‑aware conversations are possible without a monolithic, always‑on RAG or knowledge‑graph memory.
- **RQ4 – AI companionship and engagement:** The voice companion can hold short, supportive dialogues grounded in journal data, and early interactions feel more personalised than generic chatbots because the agent can reference concrete past entries. However, sustaining long‑term companionship and handling richer emotional nuance remains an open challenge beyond the current scope.
- **RQ5 – Engineering trade‑offs:** The project surfaces several pragmatic trade‑offs in combining web audio, AI services, and cloud data: managing transcription latency, handling model and SDK changes, and reconciling authentication boundaries between Clerk and Supabase. The implemented system, supported by testing and troubleshooting documentation, shows that these trade‑offs can be managed within the resource constraints of a postgraduate capstone.
- **RQ6 – User experience and retention:** The mobile‑oriented PWA design, with a focused dashboard, prominent recorder, and concise reflection cards, provides a coherent experience that encourages short, frequent interactions. While the project does not measure long‑term retention quantitatively, the iterative design process and testing indicate that reducing friction at the point of capture and presenting reflections in an accessible way are crucial for encouraging repeated use.

Overall, the results demonstrate that a voice‑first, AI‑augmented journaling system with a privacy‑conscious architecture is technically feasible and functionally convincing at prototype scale. The artefact built in this project provides a concrete foundation for future work on larger‑scale evaluation, richer conversational capabilities, and extended integrations in the digital well‑being ecosystem.

# Discussion

**Requirements:** In this section, discuss the results, implications and significance of your project contributions. The implication should be explained in more detail in the final report than your initial proposal. This section is also where you state how your findings contribute to existing gaps in the field or recommendations -- practical suggestions to implementation of findings/outcomes.

# Limitations and Future Works

While the project demonstrates that a voice‑first, AI‑augmented journaling system is technically feasible, several important limitations constrain the current prototype and the conclusions that can be drawn from it.

From an evaluation perspective, the most significant limitation is the lack of large‑scale, systematic user studies. The findings about reduced friction, perceived usefulness of reflections, and engagement with the voice companion are based primarily on the author’s own use and a small number of informal testers. There is no quantitative evidence about long‑term retention, changes in journaling frequency, or psychological outcomes such as mood improvements. As a result, the project cannot make strong claims about efficacy in real‑world populations; it can only suggest that the interaction patterns appear promising.

The system’s conversational capabilities are likewise constrained. The voice companion can handle short, focused dialogues grounded in recent journal data, but it does not maintain rich, long‑term conversational context beyond what is stored in daily summaries and reflections. It also does not implement advanced safety features such as explicit crisis detection or escalation paths, which would be essential in a mental‑health‑adjacent product. The current implementation is therefore better understood as a reflective assistant for everyday use than as a clinical or therapeutic tool.

Technical limitations also shape the current prototype. The application depends on several external services (Supabase, OpenAI, Clerk), which introduces latency and availability risks outside the project’s direct control. Realtime voice sessions require stable network conditions and modern browsers, and there is no offline‑first functionality; users cannot record and queue entries entirely offline. Automated tests cover many core utilities and some key flows, but certain paths—particularly reflections aggregation logic tied to real database queries and the full behaviour of realtime sessions—remain under‑tested and rely on manual verification.

Finally, the project’s privacy guarantees, while stronger than a naive design, are still pragmatic rather than formally verified. Row‑level security, tool‑based context access, and careful use of environment variables reduce risk, but there has been no formal security audit or formal verification. Cost control and rate limiting for AI calls are only partially implemented in the prototype, leaving open the risk of accidental overuse in a larger deployment.

These limitations point directly to several avenues for future work:

- **User studies and impact evaluation:** Conduct structured user studies with a larger, more diverse participant pool to measure journaling adherence, perceived effort, satisfaction, and potential well‑being effects over several weeks or months. Mixed‑methods designs combining quantitative metrics with qualitative interviews would help validate and refine the design.
- **Richer conversational capabilities and safety features:** Extend the voice companion with improved dialogue management, better handling of ambiguous time references, and explicit safety measures (for example, detecting crisis phrases and providing appropriate guidance). This may involve refining prompts, adding specialised tools, or integrating with human support channels where appropriate.
- **Offline and resilience improvements:** Explore offline‑first or “store‑and‑forward” capabilities so users can record entries and view recent reflections even without stable connectivity. This would likely require local caching strategies and careful reconciliation with the cloud backend.
- **Expanded testing and observability:** Increase automated test coverage for reflections aggregation and API contracts, and introduce end‑to‑end tests using tools like Playwright to cover main flows across devices. Additional observability—such as structured logging or metrics dashboards—would support monitoring and debugging in larger deployments.
- **Formal security and privacy review:** Subject the system design to a more formal security review, including threat modelling and potential penetration testing. Explore stronger privacy techniques where appropriate, such as more granular data retention policies, configurable deletion options, or client‑side encryption for especially sensitive content.
- **Performance and cost modelling at scale:** Develop more systematic performance benchmarks (for example, end‑to‑end latency under concurrent load) and cost models (per‑user token and storage budgets), and use these to guide further optimisation of batching, caching, model selection, and rate limiting in preparation for larger‑scale deployments.

Pursuing these directions would move EchoJournal from a compelling prototype towards a more mature, robust, and ethically grounded system that could be evaluated and potentially deployed at scale in the digital well‑being ecosystem.

# References

**Requirements and Example:**

Example: American Psychological Association (APA). (2010). _Publication Manual of the American Psychological Association_ (6th Ed.). Washington, DC: Author.

- You are strongly encouraged to use information from reputable websites such as Wall Street Journal, New York Times, and websites from Governments, as well as books, academic journals and magazines (e.g., The Economist). Some well-regarded journals you may refer to are: Harvard Business Review, Information Systems Research, Management Science and MIS Quarterly.

- Please cite all references at the end of your paper (both proposal and final report). You should include references to facts, figures and any other information that you obtained from various sources. References from relevant papers in the University Digital Library are preferred over Internet sources as Internet sources may not always be reliable.

- Whenever you quote, paraphrase, summarise or refer to ideas, facts, figures or findings from another source (e.g. research paper, book, website), you should cite the source, with appropriate formatting, in the sentence that mentions these ideas or figures. It is not sufficient to just provide a list of references at the end of your paper. The source that you use should be cited in the text of your paper, either in parentheses or as part of the text itself. We suggest the use of APA style for referencing. If the references quite a lot, you can use the reference management system such as Endnote that provided by the University of Sydney (http://libguides.library.usyd.edu.au/endnote).

- You are reminded that the University takes plagiarism infringements seriously. If the sources are not cited correctly, it may be deemed as plagiarism. Please note that your submission will be forwarded to an automated plagiarism checking system.
