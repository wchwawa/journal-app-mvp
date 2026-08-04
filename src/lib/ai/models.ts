// Central OpenAI model registry. Every call site reads from here so models
// can be swapped per environment without code changes.
// Note: gpt-5.x family models reject non-default `temperature` and require
// `max_completion_tokens` instead of `max_tokens`.
export const TRANSCRIBE_MODEL =
  process.env.OPENAI_TRANSCRIBE_MODEL ?? 'gpt-4o-mini-transcribe';

export const REPHRASE_MODEL =
  process.env.OPENAI_REPHRASE_MODEL ?? 'gpt-5.6-luna';

export const SUMMARY_MODEL = process.env.OPENAI_SUMMARY_MODEL ?? 'gpt-5.6-luna';

export const REALTIME_MODEL =
  process.env.OPENAI_REALTIME_MODEL ?? 'gpt-realtime-2.1';
