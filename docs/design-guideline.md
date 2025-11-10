## Frontend Design Guidelines

### Core Philosophy

- **PWA-first design**: Prioritize mobile-friendly experience.
- **Human-Centered Interaction**: Create natural, fluid conversational experiences where technology serves people
- **Intelligent Minimalism**: Restrained, elegant interfaces that highlight AI capabilities over visual decoration
- **Real-time First**: Prioritize real-time voice interactions with millisecond-level feedback
- **Context-Aware**: Dynamically adjust interface based on user state and needs

### Design Principles


### Visual Standards

- **Card Shells**: Default container uses rounded-3xl corners, `border-border/30`, and `bg-card/90` to create a calm glassmorphism effect.
- **Typography**: Body copy uses the product sans stack; reserve monospaced fonts (`"JetBrains Mono", "Fira Code"`) for timers, counters, and typewriter copy to signal “system feedback.”
- **Accent Treatments**: Gradients run from primary → pink → orange and should only wrap short spans (CTA labels, idle facts) to avoid overwhelming the minimalist palette.
- **Micro-animation**: Prefer subtle typewriter, caret blink, or opacity fades; avoid large translate/scale motions that disrupt journaling flow.

### Color System

#### Light Mode - Breathing Space

- **Canvas**: Warm beige `oklch(0.94 0.015 85)` - Soft foundation that recedes
- **Voice**: Deep taupe `oklch(0.35 0.02 75)` - Words float naturally
- **Accent**: Terracotta whisper `oklch(0.5 0.12 35)` - Gentle guidance, never intrusion
- **Principle**: Maximum whitespace, minimal boundaries
- **Philosophy**: Like meditation on paper - space to breathe and think

#### Dark Mode - Night Sanctuary

- **Canvas**: Warm void `oklch(0.13 0.02 25)` - Infinite depth for reflection
- **Voice**: Cream whisper `oklch(0.9 0.015 50)` - Thoughts emerge from darkness
- **Accent**: Lavender glow `oklch(0.65 0.12 320)` - Subtle comfort in the night
- **Principle**: Content floats in space, no rigid containers
- **Philosophy**: Like stargazing - vast emptiness that invites contemplation

### Component Patterns

#### Audio Recorder (Overview)
- **Idle State**: When no recording exists, fill the waveform area with rotating journaling facts rendered via a typewriter effect (emoji + blinking caret). Facts must pause once the user starts recording or re-enters playback.
- **Live State**: Keep the widget width fixed. Swap to wavesurfer output, but do not move the buttons; only the waveform layer changes.
- **Action Row**: Primary record button is a 68px circular CTA centered in the widget. Secondary actions (pause/restart or playback/discard/process) share equal-sized icon buttons to prevent layout jumps across states.

#### Reflection Cards
- **Badges**: Use secondary or outline badges for “Edited” / “In progress” to avoid overpowering the copy.
- **Copy Blocks**: Flashback + mood reason stay within 120 characters. Follow the encouraging, data-backed tone established by the audio recorder facts.

### Motion & Microcopy

- **Typewriter Rules**: animate both entering and deletion from the same anchor point, then advance to the next fact. This predictable motion reinforces the reflective narrative.
- **Tone**: Microcopy should be specific, positive, and research-backed (e.g., “writing down goals makes them 42% more likely to happen”) to align with Module B’s reflective messaging.
