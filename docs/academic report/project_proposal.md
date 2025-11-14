# ECHOJOURNAL: VOICE FIRST DIARY APP FOR EFFORTLESS REFLECTION

## Project Proposal

School of Computer Science Postgraduate Capstone Project

COMP5709/DATA5709/CSEC5709

Changhao Wang (530357966)

---

## ABSTRACT

The AI-based voice journaling application EchoJournal serves as a tool which enables users to document their daily activities through a new method. The project addresses the main issue with conventional journaling because numerous users lose interest in this practice. The first month of digital writing proves challenging for more than 60% of users because typing becomes a tedious task. EchoJournal enables users to transform their spoken words into searchable journal entries through its combination of modern voice recognition and natural language processing systems which preserve the authentic emotional elements of spoken speech. The application features a large language model which functions well through spoken commands. The model functions as an intelligent assistant which recognizes both the emotional content and time-based sequences and contextual elements within the journal entries. It can have natural conversations about past entries, spot behavioral patterns, and offer personal insights for self-reflection. The system uses PostgreSQL for database management of structured data and vector databases for semantic search operations and knowledge graphs to establish relationships between data points while ensuring complete end-to-end encryption for privacy protection. The project will deliver three main outcomes which consist of a working progressive web application and an AI voice interface that replicates human communication and a RAG system for journal content retrieval and analysis during extended periods.

---

## TABLE OF CONTENTS

- [Abstract](#abstract)
- [1. INTRODUCTION](#1-introduction)
- [2. RELATED LITERATURE](#2-related-literature)
  - [2.1 Literature Review](#21-literature-review)
- [3. RESEARCH/PROJECT PROBLEMS](#3-researchproject-problems)
  - [3.1 Research/Project Aims & Objectives](#31-researchproject-aims--objectives)
  - [3.2 Research/Project Questions](#32-researchproject-questions)
  - [3.3 Research/Project Scope](#33-researchproject-scope)
- [4. METHODOLOGIES](#4-methodologies)
  - [4.1 Methods](#41-methods)
  - [4.2 Data Collection](#42-data-collection)
  - [4.3 Data Analysis](#43-data-analysis)
  - [4.4 Deployment](#44-deployment)
  - [4.5 Testing](#45-testing)
- [5. RESOURCES](#5-resources)
  - [5.1 Hardware & Software](#51-hardware--software)
  - [5.2 Materials](#52-materials)
- [6. EXPECTED OUTCOMES](#6-expected-outcomes)
  - [6.1 Project Deliverables](#61-project-deliverables)
  - [6.2 Implications](#62-implications)
- [7. MILESTONES / SCHEDULE](#7-milestones--schedule)
- [REFERENCES](#references)

---

## 1. INTRODUCTION

Digital journaling serves as an effective method for self-reflection and emotional processing and personal development in the present day. The established mental health benefits of journaling do not guarantee that people will adopt digital journaling successfully or continue using it. The process of writing extended text on keyboards or mobile devices presents a significant challenge which becomes most difficult during emotional times because speaking provides a more natural way to communicate. Journaling apps fail to provide adequate organization systems which makes it impossible for users to find important insights from their recorded entries throughout time.

The fast growth of artificial intelligence, especially in natural language processing and voice recognition, offers a unique chance to rethink the journaling experience. Voice-based interaction functions as the most natural way for humans to communicate with each other. Users can freely share their thoughts and emotions through the platform because it does not require typing and minimizes the need for self-censorship when writing. Standard recording functions become a transformative tool for self-discovery and personal growth through the combination of smart analysis with voice journaling technology.

The Genesis Program at the University of Sydney selected EchoJournal for its Week 3 development phase as one of its leading incubators. The application pool contained 130 startups but only 11 companies managed to secure acceptance (9% acceptance rate). The market validation and commercial potential of this concept seem to be very strong. The project reached such success that it evolved from academic beginnings into a startup business with defined commercial objectives.

The EchoJournal application offers users a basic voice journaling system to address these issues. The system merges real-time spoken thought processing with modern artificial intelligence analytical capabilities. The application successfully records and transcribes spoken words and offers an intelligent assistant which engages in substantial dialogues about past events. The tool uses emotional pattern analysis to create individualized feedback which enables users to examine their emotional responses. The new method provides users with an easier journaling process which produces more valuable insights from their recorded experiences.

## 2. RELATED LITERATURE

The development of voice-based journaling applications with AI companions draws upon extensive research across multiple domains, including human-computer interaction, natural language processing, psychological well-being, and privacy-preserving technologies. Understanding the current state of these fields is essential for developing an effective and user-centered solution.

### 2.1 Literature Review

Recent studies in digital health interventions have demonstrated the therapeutic benefits of voice-based expression. Pennebaker and Chung (2011) found that expressive voice journaling leads to superior physical and psychological health outcomes. The researchers show that emotional expression through thoughts helps people deal with traumatic experiences by lowering their stress reactions. The research by Jayathilaka and Dampallessa (2025) built upon this base to study the particular benefits of voice-based emotional expression through the Kalmora app. The research demonstrated that voice recording delivered a more genuine experience than text entry and real-time emotion detection enabled users to better understand emotions while maintaining their interest in the application.

Speech-to-text technology has experienced major progress because of transformer-based model development. OpenAI's Whisper model (Radford et al. The model (2022) achieved state-of-the-art performance in multilingual speech recognition and showed strong performance in various acoustic conditions and speaking styles. The technology shows special value for journaling because users often speak with different emotional states which modify their speech characteristics and speaking clarity. Recent work by Zhang et al. (2021) on emotion-aware speech recognition further enhances the potential for capturing not just the content but also the emotional context of journal entries.

The field of conversational AI has experienced a transformation through large language models which now enables new ways for humans to interact with AI systems. Anthropic (2022) conducted research to create constitutional AI and RLHF (Reinforcement Learning from Human Feedback) models which enable extended dialogue understanding while following ethical standards. The integration of retrieval-augmented generation (RAG) systems, as demonstrated by Lewis et al. (The 2020 AI system provides access to extensive knowledge bases for reasoning which makes it suitable for journal companion applications that need to recall and analyze historical entries.

The primary concern of personal journaling applications remains their ongoing privacy problems. Homomorphic encryption techniques, as surveyed by Acar et al. (The 2018 paper enables encrypted data processing without decryption but developers face difficulties when applying this method to real-time systems. The Signal Protocol (Cohn-Gordon et al. uses end-to-end encryption with client-side key management as a more practical method. The research by (2017) demonstrates that privacy protection systems enable users to obtain both robust privacy protection and simple interface usability. The application of differential privacy techniques (Dwork and Roth, 2014) in analytics makes it possible to obtain aggregate insights without exposing personal information.

Research studies have conducted extensive investigations about the mental aspects which create human-AI companionship since the last few years. Turkle (2011) questioned the genuine nature of human connections with artificial intelligence systems and Skjuve et al. ( followed up with their study. Research conducted by (2021) shows users form genuine emotional bonds with AI companions. The research by (2021) demonstrates that users form genuine emotional connections with AI companions which provide actual support. The work of Fitzpatrick et al. (2017) on the Woebot chatbot demonstrated that AI-based therapeutic interventions can be effective in reducing symptoms of depression and anxiety, particularly when designed with evidence-based psychological principles.

Multimodal AI systems have achieved better performance in processing user context information through their development. The method described by Schuller and Batliner (2013) for speech analysis through prosodic features allows systems to recognize emotional details which text-based methods fail to identify. The journaling companion requires this function to generate suitable responses which align with the emotional state of the user.

## 3. RESEARCH/PROJECT PROBLEMS

The current digital journaling application market demonstrates major discrepancies between user needs and the capabilities of available tools. The number of journaling applications has increased yet users tend to stop using them after a short period because research indicates that 60% of digital journaling users leave the platform during their initial month of use. The high employee turnover rate at EchoJournal results from various linked issues which the company plans to solve through its new technological approaches.

### 3.1 Research/Project Aims & Objectives

The main objective of this project involves creating a market-ready voice-based journaling system which will transition from its academic roots to establish itself as an independent business operation. The specific objectives include:

- The system requires a voice-first interface that lets users make journal entries by recording audio naturally while speaking and pausing and expressing emotions without needing to edit or format their speech
- The system needs an exact speech-to-text system which performs transcription and analysis to find emotional content and important themes and create organized entries for better search capabilities.
- The system needs an AI Companion System that employs sophisticated language models to develop a conversational AI partner which monitors previous entries and identifies temporal patterns and delivers personalized assessments during extended dialogues.
- Native mobile applications achieve broad market reach through established professional distribution channels by using Apple App Store and Google Play Store to deploy their production-ready iOS and Android applications.
- The business model needs validation through B2C and B2B revenue model testing with pilot programs and user feedback to determine the best monetization approach.
- The company needs to use data-based marketing approaches to find its main user groups and boost user numbers and engagement levels which venture capital investors require for funding.
- The company needs to obtain seed funding from venture capital firms while using subscription models to generate revenue and prove its business model works.

### 3.2 Research/Project Questions

This project seeks to answer the following research questions:

**3.2.1 Primary Question:** How can voice-based interaction combined with AI companionship transform the digital journaling experience to achieve higher user engagement and retention compared to traditional text-based approaches?

**3.2.2 Secondary Questions:**

- The most effective speech recognition and natural language processing methods for emotional nuance detection in voice journal entries need identification.
- The optimization of retrieval-augmented generation (RAG) systems needs techniques to find suitable historical journal information while operating under real-time performance requirements.
- The privacy-preserving mechanisms will protect all user information completely while allowing the AI companion to generate personalized insights.
- The system needs methods to identify important behavioral patterns and emotional states of users and specific targets during extended periods of use.

### 3.3 Research/Project Scope

The scope of this project encompasses the development of a fully functional progressive web application with the following boundaries:

**In Scope:**

- Voice recording and real-time transcription functionality supporting up to 10-minute entries
- AI-powered conversation system with memory of past interactions and journal content
- Automated daily, weekly, and monthly summary generation
- Mood tracking and sentiment analysis capabilities
- Progressive Web Application for initial deployment
- React Native iOS applications for App Store
- End-to-end encryption for all user data
- Advanced analytics and pattern recognition features
- B2C subscription model for individual users
- B2B enterprise solutions for corporate wellness programs
- Integration with Genesis incubator milestones and investor requirements

**Out of Scope:**

- Real-time collaborative journaling features (initial version)
- Integration with third-party health or wellness applications (initial version)
- Support for video journaling
- Professional therapeutic or medical advice capabilities
- Offline-first functionality (initial version requires internet connection)

## 4. METHODOLOGIES

The development of EchoJournal follows an iterative, feature-driven approach with continuous deployment practices. The project has been developed using modern web technologies with a focus on rapid prototyping and user feedback integration. The methodology emphasizes delivering functional features incrementally while maintaining code quality and system reliability.

### 4.1 Methods

The project employs practical software engineering approaches tailored to the academic timeline:

**Development Approach:**

The project follows a practical development approach which starts with basic feature deployment before moving on to more complex system capabilities. Development follows a feature-based architecture where each module is self-contained and can be developed independently. The method gives priority to developing operational software instead of complete documentation at the beginning of development.

**System Architecture Implementation:**

The system has been built using a modern monolithic architecture with clear separation of concerns:

- **Frontend Layer:** Next.js 15 Progressive Web Application using App Router with React 19
- **API Layer:** Next.js API routes handling server-side logic and third-party integrations
- **Data Layer:** Supabase platform providing PostgreSQL database, authentication, and file storage

**Current AI Integration:**

The project has successfully integrated AI capabilities in a phased approach:

- **Speech-to-Text:** OpenAI Whisper API implementation for audio transcription (completed)
- **Content Processing:** GPT-5-mini for transcript rephrasing and daily summary generation (completed)
- **Self-reflection organizing:** GPT-5 for complex self-relection reasoning
- **Future RAG Pipeline:** Planned integration with vector databases and knowledge graphs (to be implemented)

### 4.2 Data Collection

Data collection occurs through multiple channels to ensure comprehensive system functionality:

**User Voice Data:**

- Voice recordings captured via Web Audio API with automatic silence detection and trimming
- Metadata collection including duration, timestamp, and device information
- Real-time quality assessment to ensure recording clarity

**User Interaction Data:**

- Daily mood questionnaires with structured single and multiple-choice responses
- Conversation logs with the AI companion for context maintenance
- User feedback and ratings on AI-generated summaries and insights

**System Performance Data:**

- API response times and error rates for optimization
- Transcription accuracy metrics through user corrections
- User engagement metrics including session duration and retention rates

### 4.3 Data Analysis

The system employs sophisticated data analysis techniques at multiple levels:

**Content Analysis:**

- Sentiment analysis using transformer-based models to identify emotional states
- Named entity recognition to extract people, places, and events mentioned in entries
- Topic modeling using Latent Dirichlet Allocation (LDA) to identify recurring themes

**Pattern Recognition:**

- Time-series analysis of mood patterns to identify trends and cycles
- Correlation analysis between mood states and mentioned topics or events
- Goal tracking through natural language understanding of stated intentions and achievements

**Personalization:**

- User behavior modeling to optimize interaction patterns
- Preference learning for AI companion personality and response style
- Adaptive summarization based on user feedback and reading patterns

### 4.4 Deployment

The deployment has been implemented using modern cloud platforms with automated workflows:

**Current Infrastructure:**

- Production deployment on Vercel with automatic scaling and edge functions
- Supabase hosted services providing PostgreSQL, authentication, file storage, and vector capabilities
- Vercel Edge Network for global content delivery and optimal performance

**Implemented CI/CD Pipeline:**

- GitHub repository with branch protection and pull request workflows
- Vercel automatic deployments triggered on main branch commits
- Preview deployments for all pull requests enabling pre-merge testing

**Active Monitoring:**

- Sentry integration configured for error tracking (conditionally enabled via environment variables)
- Vercel Analytics for performance monitoring and user metrics
- Supabase dashboard for database performance and query optimization

### 4.5 Testing

The testing strategy focuses on critical functionality and user experience:

**Current Testing Implementation:**

- Manual testing of core features including audio recording, transcription, and summary generation
- API endpoint validation through development tools and Postman
- Browser compatibility testing across Chrome, Safari, Firefox, and Edge

**Quality Assurance Practices:**

- ESLint and Prettier configured for code quality and consistency
- TypeScript strict mode enabled for type safety
- Pre-commit hooks using Husky for automated linting

**Planned Testing Enhancements:**

- Jest test suite setup for critical business logic
- React Testing Library for component testing
- Cypress or Playwright for end-to-end testing of user journeys

**Performance Validation:**

- Lighthouse audits for PWA performance metrics
- Real-world testing with various audio qualities and durations
- API response time monitoring through Vercel Analytics

## 5. RESOURCES

The successful completion of EchoJournal requires a combination of technological resources, development tools, and external services to ensure robust functionality and optimal user experience.

### 5.1 Hardware & Software

**Development Environment:**

- Development machines: MacOS/Linux/Windows systems with minimum 16GB RAM and modern processors
- Testing devices: Various smartphones and tablets for PWA compatibility testing
- Audio equipment: Professional microphones for testing voice recognition accuracy across different input qualities

**Implemented Technology Stack**

**Frontend Technologies (In Production):**

- Next.js 15 with React 19 and App Router for modern web application
- Tailwind CSS v4 with custom design system implementation
- Shadcn-ui components with Radix UI primitives for accessibility
- React Hook Form with Zod validation for robust form handling
- Zustand for global state management with persistence
- Clerk for authentication and user management

**Backend Infrastructure (Active):**

- Next.js API routes for server-side logic
- Supabase providing PostgreSQL, authentication, file storage, and vector capabilities
- Edge functions for serverless compute
- Real-time subscriptions for live updates

**AI Services (Integrated):**

- OpenAI Whisper API for speech-to-text transcription
- GPT-4o-mini for content rephrasing and summary generation
- Planned: LangChain and vector database integration for RAG capabilities
- Future: Knowledge graph implementation for relationship mapping

**Development Tools:**

- Visual Studio Code with ESLint and Prettier for code quality
- Docker for containerized development and deployment
- Git with GitHub for version control and collaboration
- Postman for API development and testing

**Monitoring and Analytics:**

- Sentry for error tracking and performance monitoring
- Google Analytics 4 for user behavior analysis
- Grafana for system metrics visualization

### 5.2 Materials

**External Services and APIs:**

- Clerk authentication service for user management and secure authentication
- Cloudflare for CDN and DDoS protection
- SendGrid for transactional email services
- Stripe for potential future payment processing

**Documentation and Learning Resources:**

- Official documentation for all frameworks and libraries
- Academic papers on speech recognition and natural language processing
- Privacy and security best practices documentation
- User experience research materials and design guidelines

**Testing Resources:**

- Sample voice recordings in multiple languages and accents
- Synthetic test data for load testing
- User testing recruitment through platforms like UserTesting.com

**Compliance and Legal Resources:**

- GDPR compliance documentation and tools
- Australian Privacy Principles guidelines
- Terms of service and privacy policy templates
- Data processing agreements with third-party services

## 6. EXPECTED OUTCOMES

The system creates a total voice journaling solution which transforms how users record and study their daily activities. The project will deliver technical results together with effects that extend to users and the digital wellness environment.

### 6.1 Project Deliverables

**Development of a Web-Based Prototype and a Mobile-Based MVP** This includes:

- Seamless voice transcription for capturing journal entries with high accuracy.
- High-accuracy, AI-powered organization of journal entries to structure and categorize content automatically.
- A self-reflection feature that enables users to review and gain insights from their entries.
- Journal companion powered by voice-native LLM, providing interactive conversations and personalized feedback based on historical data.

**Two Reports** This includes:

- A final report of the project, summarizing development process, results, challenges, and evaluations.
- A proposal report outlining the project's objectives, methodologies, and initial planning.

**Project Documentation** This includes:

- Project description detailing the overall architecture, features, and user workflows.
- Software specifications covering technical requirements, APIs, and integration details.
- Design guideline providing standards for UI/UX, security, and scalability.

**Startup Pitch Deck** From Genesis cohort 36, including market analysis, product demo, traction metrics, and funding requirements to showcase commercial potential.

### 6.2 Implications

**For the Startup Ecosystem:** EchoJournal's selection by Genesis incubator (5% acceptance rate from 200 applicants) validates the market opportunity and technical innovation. The project demonstrates how academic research can transform into viable commercial ventures, serving as a model for other student entrepreneurs. Success in securing VC funding will establish a pathway for similar AI-driven wellness startups in the Australian tech ecosystem.

**For Individual Users (B2C Market):** The application addresses a $2.1 billion global digital wellness market, providing accessible mental health support tools. With subscription tiers ranging from free basic access to premium AI features, users can choose engagement levels matching their needs and budgets. The voice-first approach particularly benefits users with disabilities, busy professionals, and non-native English speakers who find typing challenging.

**For Corporate Wellness (B2B Market):** EchoJournal offers enterprises a scalable employee wellness solution addressing the $13.6 billion corporate wellness market. Companies can provide employees with mental health support tools while maintaining privacy, potentially reducing healthcare costs and improving productivity. The B2B model includes analytics dashboards for HR departments (with aggregated, anonymized data) to track overall wellness trends without accessing individual entries.

**For Investors and Market Validation:** The project presents a compelling investment opportunity with multiple revenue streams, high user engagement metrics, and defensible AI technology. Early traction from Genesis incubator, combined with planned pilot programs, demonstrates product-market fit. The dual B2C/B2B model provides diversified revenue sources and reduces market risk.

**For Academic-Industry Collaboration:** This project exemplifies successful university-industry partnership, leveraging academic research for commercial innovation. The Genesis incubator connection creates opportunities for continued collaboration between the University of Sydney and the startup ecosystem. Success metrics and learnings will be documented for future academic entrepreneurship programs.

**Commercial Scalability:** The cloud-native architecture and AI-driven features position EchoJournal for rapid scaling. With marginal costs decreasing as user base grows, the business model demonstrates strong unit economics. International expansion potential exists given the universal nature of journaling and multi-language AI capabilities.

## 7. MILESTONES / SCHEDULE

### Phase 1: Foundation Development (Weeks 1-3)

| Week | Milestone | Achievements | Status |
|------|-----------|--------------|--------|
| Week-01 | Client meeting I | Meeting with Client Dr Imdad Ullah to discuss research topic | Completed |
| Week-02 | Client meeting II | Meeting with Client Dr Imdad Ullah to discuss research proposal | Completed |
| Week-03 | Project Initialization | • Set up Next.js 15 with React 19<br>• Configured Supabase backend<br>• Implemented Clerk authentication<br>• Created base UI components | Completed |
| Week-04 | Core Features I | • Built voice recording module<br>• Integrated Web Audio API<br>• Created dashboard layout<br>• Implemented mood tracking | Completed |
| Week-05 | Genesis Selection | • Selected for Genesis incubator (11/130)<br>• Integrated OpenAI Whisper<br>• Implemented GPT-5 summarization<br>• Deployed MVP to Vercel | Completed |
| Week-06 | Core Features II & Mobile Development Environment Setup | • React Native setup<br>• Dairy book (record storage)<br>• Self-reflection feature | Completed |

### Phase 2: Current Development & Commercialization (Week 7-11)

| Week | Milestone | Deliverables | Target Date |
|------|-----------|--------------|-------------|
| Week-07 | Mobile Development I | • Build core features for iOS using React Native or Flutter.<br>• Integrate voice transcription and AI companion modules.<br>• Conduct initial unit testing and device compatibility verification. | 19-09-2025 |
| Week-08 | Mobile Development II | • Develop Android version, synchronizing features with iOS.<br>• Optimize cross-platform code sharing.<br>• Integrate end-to-end encryption and privacy controls.<br>• Perform simulated user scenario testing. | 28-09-2025 |
| Week-09 | Mobile Deployment & Compliance I | • Prepare iOS for App Store (certificates, reviews).<br>• Address GDPR/privacy/accessibility. | 10-10-2025 |
| Week-10 | Mobile Deployment & Compliance II | • Complete security audits.<br>• Beta testing. | 17-10-2025 |

### Phase 3: Accelerator Pitch Deck, Client verification and Final Report (Week 11-13)

| Week | Milestone | Deliverables | Target Date |
|------|-----------|--------------|-------------|
| Week-11 | Genesis Accelerator Pitch Deck | Genesis Accelerator Pitch Deck Slides | 24-10-2025 |
| Week-12 | Client verification & Final Report I | Client meeting to verify the application | 21-10-2025 |
| Week-13 | Final Report II | Project final report | 07-11-2025 |

---

## REFERENCES

Acar, A., Aksu, H., Uluagac, A. S., & Conti, M. (2018). A survey on homomorphic encryption schemes: Theory and implementation. *ACM Computing Surveys*, *51*(4), 1–35. https://doi.org/10.1145/3214303

Anthropic. (2022). Constitutional AI: Harmlessness from AI feedback. *arXiv preprint arXiv:2212.08073*. https://doi.org/10.48550/arXiv.2212.08073

Cohn-Gordon, K., Cremers, C., Dowling, B., Garratt, L., & Stebila, D. (2017). A formal security analysis of the Signal messaging protocol. In *2017 IEEE European Symposium on Security and Privacy (EuroS&P)* (pp. 451–466). IEEE. https://doi.org/10.1109/EuroSP.2017.27

Dwork, C., & Roth, A. (2014). The algorithmic foundations of differential privacy. *Foundations and Trends® in Theoretical Computer Science*, *9*(3–4), 211–407. https://doi.org/10.1561/0400000042

Fitzpatrick, K. K., Darcy, A., & Vierhile, M. (2017). Delivering cognitive behavior therapy to young adults with symptoms of depression and anxiety using a fully automated conversational agent (Woebot): A randomized controlled trial. *JMIR Mental Health*, *4*(2), e19. https://doi.org/10.2196/mental.7785

Lewis, P., Perez, E., Piktus, A., Petroni, F., Karpukhin, V., Goyal, N., … & Kiela, D. (2020). Retrieval-augmented generation for knowledge-intensive NLP tasks. In *Advances in Neural Information Processing Systems* (Vol. 33, pp. 9459–9474). Curran Associates, Inc. https://proceedings.neurips.cc/paper/2020/hash/6b493230205f780e1bc26945df7481e5-Abstract.html

Park, G., Yaden, D. B., Schwartz, H. A., Kern, M. L., Eichstaedt, J. C., Kosinski, M., Stillwell, D., Ungar, L. H., & Seligman, M. E. P. (2016). Women are warmer but no less assertive than men: Gender and language on Facebook. *PLOS ONE*, *11*(5), e0155885. https://doi.org/10.1371/journal.pone.0155885

Pennebaker, J. W., & Chung, C. K. (2011). Expressive writing: Connections to physical and mental health. In H. S. Friedman (Ed.), *Oxford handbook of health psychology* (pp. 417–437). Oxford University Press.

Radford, A., Kim, J. W., Xu, T., Brockman, G., McLeavey, C., & Sutskever, I. (2022). Robust speech recognition via large-scale weak supervision. *arXiv preprint arXiv:2212.04356*. https://doi.org/10.48550/arXiv.2212.04356

Schuller, B., & Batliner, A. (2013). *Computational paralinguistics: Emotion, affect and personality in speech and language processing*. Wiley-Blackwell. https://doi.org/10.1002/9781118706664

Skjuve, M., Følstad, A., Fostervold, K. I., & Brandtzaeg, P. B. (2021). My chatbot companion – A study of human-chatbot relationships. *International Journal of Human-Computer Studies*, *149*, 102601. https://doi.org/10.1016/j.ijhcs.2021.102601

Turkle, S. (2011). *Alone together: Why we expect more from technology and less from each other*. Basic Books.

Zhang, Y., Wang, S., & Li, B. (2021). Emotion-aware speech recognition using multi-task learning with auxiliary emotion classification. In *2021 IEEE International Conference on Acoustics, Speech and Signal Processing (ICASSP)* (pp. 6284–6288). IEEE. https://doi.org/10.1109/ICASSP39728.2021.9414563