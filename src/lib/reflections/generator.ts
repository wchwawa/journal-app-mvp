import OpenAI from 'openai';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import {
  countEmotions,
  fetchAggregatesInRange,
  fetchDailyAggregate,
  getPeriodBounds,
  resolveAnchorDate
} from './aggregate';
import type { DailyAggregate } from './aggregate';
import { reflectionAISchema } from './schema';
import type { ReflectionCard, ReflectionMode } from './types';
import type { Json, TablesInsert, TablesUpdate } from '@/types/supabase';

type AdminClient = SupabaseClient<Database>;

interface GenerateOptions {
  supabase: AdminClient;
  openai: OpenAI;
  userId: string;
  mode: ReflectionMode;
  anchorDate?: string;
}

const MODEL_NAME = process.env.OPENAI_REFLECTION_MODEL ?? 'gpt-4o-mini';
const GEN_VERSION = 'module-b-v1';

const sanitizeArray = (value: string[] | null | undefined) =>
  value?.filter((item) => item && item.trim().length > 0) ?? [];

type StatsShape =
  | {
      entryCount?: number;
      topEmotions?: string[];
      keywords?: string[];
    }
  | null
  | undefined;

const cleanStats = (stats: StatsShape): Json | null => {
  if (!stats) return null;
  const obj: Record<string, unknown> = {};
  if (typeof stats.entryCount === 'number') obj.entryCount = stats.entryCount;
  if (Array.isArray(stats.topEmotions)) obj.topEmotions = stats.topEmotions;
  if (Array.isArray(stats.keywords)) obj.keywords = stats.keywords;
  return Object.keys(obj).length ? (obj as unknown as Json) : null;
};

const buildContextForDaily = ({ summary, mood }: DailyAggregate) => {
  const parts: string[] = [
    `Date: ${summary.date}`,
    `Daily summary: ${summary.summary}`,
    `Entry count: ${summary.entry_count ?? 0}`
  ];

  if (summary.mood_quality) {
    parts.push(`Mood quality: ${summary.mood_quality}`);
  }

  const emotions =
    summary.dominant_emotions?.length || mood?.emotions?.length
      ? [
          'Emotions:',
          sanitizeArray(summary.dominant_emotions ?? []).join(', ') ||
            sanitizeArray(mood?.emotions ?? []).join(', ')
        ]
      : [];

  if (emotions.length) {
    parts.push(emotions.join(' '));
  }

  if (mood?.day_quality && !summary.mood_quality) {
    parts.push(`Mood (check-in): ${mood.day_quality}`);
  }

  return parts.join('\n');
};

const buildContextForPeriod = (mode: Exclude<ReflectionMode, 'daily'>) => {
  const label = mode === 'weekly' ? 'week' : 'month';
  return `You are summarising the user's ${label}. Consider the progression across days, highlight sustained achievements and commitments, and reflect on overall mood.`;
};

const buildAggregatedText = (
  aggregates: Awaited<ReturnType<typeof fetchAggregatesInRange>>
) =>
  aggregates
    .map(({ summary, mood }) => {
      const dayParts = [
        `Date: ${summary.date}`,
        `Summary: ${summary.summary}`,
        `Entries: ${summary.entry_count ?? 0}`
      ];
      if (summary.mood_quality || mood?.day_quality) {
        dayParts.push(
          `Mood: ${summary.mood_quality ?? mood?.day_quality ?? 'unknown'}`
        );
      }
      const emotions = sanitizeArray(
        summary.dominant_emotions ?? mood?.emotions ?? []
      );
      if (emotions.length) {
        dayParts.push(`Emotions: ${emotions.join(', ')}`);
      }
      return dayParts.join(' | ');
    })
    .join('\n');

const buildUserPrompt = (
  mode: ReflectionMode,
  contextText: string,
  aggregates: Awaited<ReturnType<typeof fetchAggregatesInRange>>
) => {
  const stats = {
    totalEntries: aggregates.reduce(
      (total, aggregate) => total + (aggregate.summary.entry_count ?? 0),
      0
    ),
    topEmotions: countEmotions(aggregates)
  };

  return `Use the JSON schema from the system message to summarise the following ${
    mode === 'daily' ? 'day' : mode
  }.

Context:
${contextText}

Aggregated stats:
- Total entries: ${stats.totalEntries}
- Top emotions: ${stats.topEmotions.join(', ') || 'None'}

Remember:
- achievements: ≤3 concise bullet statements focusing on wins or progress.
- commitments: ≤3 upcoming focus points or promises hinted in the context.
- mood.overall: one-word or short phrase descriptor (e.g. "happy", "reflective").
- mood.reason: ≤120 chars justification rooted in the context.
- flashback: ≤120 chars hook to re-engage the user later.
- stats: optionally include entryCount, topEmotions, keywords if helpful.

Return JSON only.`;
};

const SYSTEM_PROMPT = `You are an empathetic journaling coach. Respond strictly with JSON matching:
{
  "achievements": string[<=3],
  "commitments": string[<=3],
  "mood": {
    "overall": string | null,
    "reason": string | null
  },
  "flashback": string | null,
  "stats": {
    "entryCount"?: number,
    "topEmotions"?: string[],
    "keywords"?: string[]
  }
}`;

export async function generateReflection({
  supabase,
  openai,
  userId,
  mode,
  anchorDate
}: GenerateOptions): Promise<ReflectionCard> {
  const resolvedDate = resolveAnchorDate(anchorDate);
  const bounds = getPeriodBounds(mode, resolvedDate);

  if (mode === 'daily') {
    const dailyData = await fetchDailyAggregate(supabase, userId, resolvedDate);

    if (!dailyData) {
      throw new Error('No daily summary found for date');
    }

    const contextText = buildContextForDaily(dailyData);
    const aggregates = await fetchAggregatesInRange(
      supabase,
      userId,
      bounds.start,
      bounds.end
    );

    const completion = await openai.chat.completions.create({
      model: MODEL_NAME,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: buildUserPrompt('daily', contextText, aggregates)
        }
      ]
    });

    const raw = completion.choices[0]?.message?.content as any;
    const text = Array.isArray(raw)
      ? raw.map((chunk) => chunk?.text ?? '').join('')
      : (raw ?? '');

    let parsed;
    try {
      const obj = JSON.parse(text || '{}');
      // sanitize before schema validation
      if (Array.isArray(obj.achievements))
        obj.achievements = obj.achievements.slice(0, 3);
      if (Array.isArray(obj.commitments))
        obj.commitments = obj.commitments.slice(0, 3);
      if (obj.stats && Array.isArray(obj.stats.keywords))
        obj.stats.keywords = obj.stats.keywords.slice(0, 8);
      parsed = reflectionAISchema.parse(obj);
    } catch (err) {
      console.error('Reflection JSON parse failed (daily):', { text, err });
      throw err;
    }

    const existing = dailyData.summary;
    const stats = parsed.stats ?? {
      entryCount: existing.entry_count ?? 0,
      topEmotions: countEmotions(aggregates)
    };

    const shouldPreserve = existing.edited ?? false;

    const updatePayload: TablesUpdate<'daily_summaries'> = {
      achievements: shouldPreserve
        ? (existing.achievements ?? [])
        : parsed.achievements,
      commitments: shouldPreserve
        ? (existing.commitments ?? [])
        : parsed.commitments,
      mood_overall: shouldPreserve
        ? existing.mood_overall
        : parsed.mood.overall,
      mood_reason: shouldPreserve ? existing.mood_reason : parsed.mood.reason,
      flashback: shouldPreserve ? existing.flashback : parsed.flashback,
      stats: cleanStats(stats),
      gen_version: GEN_VERSION,
      last_generated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('daily_summaries')
      .update(updatePayload)
      .eq('id', existing.id)
      .select()
      .single();

    if (error) {
      console.error('Failed to update daily reflection', error);
      throw error;
    }

    return {
      recordId: data.id,
      period: {
        type: 'daily',
        start: bounds.start,
        end: bounds.end,
        date: resolvedDate
      },
      achievements: sanitizeArray(data.achievements),
      commitments: sanitizeArray(data.commitments),
      moodOverall: data.mood_overall,
      moodReason: data.mood_reason,
      flashback: data.flashback,
      stats: (data.stats as Record<string, unknown> | null) ?? null,
      edited: data.edited ?? false,
      lastGeneratedAt: data.last_generated_at,
      genVersion: data.gen_version ?? undefined
    };
  }

  const aggregates = await fetchAggregatesInRange(
    supabase,
    userId,
    bounds.start,
    bounds.end
  );

  if (!aggregates.length) {
    throw new Error('No summaries found for period');
  }

  const periodLabel =
    mode === 'weekly'
      ? `Week of ${bounds.start} - ${bounds.end}`
      : `Month of ${bounds.start.slice(0, 7)}`;

  const context = `${buildContextForPeriod(mode)}\n\n${buildAggregatedText(
    aggregates
  )}`;

  const completion = await openai.chat.completions.create({
    model: MODEL_NAME,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `${periodLabel}\n\n${buildUserPrompt(
          mode,
          context,
          aggregates
        )}`
      }
    ]
  });

  const raw2 = completion.choices[0]?.message?.content as any;
  const text2 = Array.isArray(raw2)
    ? raw2.map((chunk) => chunk?.text ?? '').join('')
    : (raw2 ?? '');

  let parsed;
  try {
    const obj2 = JSON.parse(text2 || '{}');
    if (Array.isArray(obj2.achievements))
      obj2.achievements = obj2.achievements.slice(0, 3);
    if (Array.isArray(obj2.commitments))
      obj2.commitments = obj2.commitments.slice(0, 3);
    if (obj2.stats && Array.isArray(obj2.stats.keywords))
      obj2.stats.keywords = obj2.stats.keywords.slice(0, 8);
    parsed = reflectionAISchema.parse(obj2);
  } catch (err) {
    console.error('Reflection JSON parse failed (period):', { text2, err });
    throw err;
  }

  const { data: existing, error: existingError } = await supabase
    .from('period_reflections')
    .select('*')
    .eq('user_id', userId)
    .eq('period_type', mode)
    .eq('period_start', bounds.start)
    .maybeSingle();

  if (existingError) {
    console.error('Failed to fetch period reflection', existingError);
    throw existingError;
  }

  const shouldPreserve = existing?.edited ?? false;

  const baseStats = parsed.stats ?? {
    entryCount: aggregates.reduce(
      (total, aggregate) => total + (aggregate.summary.entry_count ?? 0),
      0
    ),
    topEmotions: countEmotions(aggregates)
  };

  const upsertPayload: TablesInsert<'period_reflections'> = {
    user_id: userId,
    period_type: mode,
    period_start: bounds.start,
    period_end: bounds.end,
    achievements: shouldPreserve
      ? (existing?.achievements ?? [])
      : parsed.achievements,
    commitments: shouldPreserve
      ? (existing?.commitments ?? [])
      : parsed.commitments,
    mood_overall: shouldPreserve
      ? (existing?.mood_overall ?? null)
      : parsed.mood.overall,
    mood_reason: shouldPreserve
      ? (existing?.mood_reason ?? null)
      : parsed.mood.reason,
    flashback: shouldPreserve
      ? (existing?.flashback ?? null)
      : parsed.flashback,
    stats: cleanStats(baseStats),
    gen_version: GEN_VERSION,
    last_generated_at: new Date().toISOString(),
    edited: existing?.edited ?? false
  };

  const { data, error } = await supabase
    .from('period_reflections')
    .upsert(upsertPayload, { onConflict: 'user_id,period_type,period_start' })
    .select()
    .single();

  if (error) {
    console.error('Failed to upsert period reflection', error);
    throw error;
  }

  return {
    recordId: data.id,
    period: {
      type: mode,
      start: data.period_start,
      end: data.period_end
    },
    achievements: sanitizeArray(data.achievements),
    commitments: sanitizeArray(data.commitments),
    moodOverall: data.mood_overall,
    moodReason: data.mood_reason,
    flashback: data.flashback,
    stats: (data.stats as Record<string, unknown> | null) ?? null,
    edited: data.edited ?? false,
    lastGeneratedAt: data.last_generated_at,
    genVersion: data.gen_version ?? undefined
  };
}
