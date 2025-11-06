import { z } from 'zod';
import type { ReflectionMode } from './types';

export const reflectionModeSchema = z.enum(['daily', 'weekly', 'monthly']);

export const statsSchema = z
  .object({
    entryCount: z.number().int().nonnegative().optional(),
    topEmotions: z.array(z.string().trim().min(1)).max(5).optional(),
    keywords: z.array(z.string().trim().min(1)).max(8).optional()
  })
  .strict()
  .partial()
  .optional();

export const reflectionAISchema = z
  .object({
    achievements: z.array(z.string().trim().min(1)).max(3).default([]),
    commitments: z.array(z.string().trim().min(1)).max(3).default([]),
    mood: z
      .object({
        overall: z.string().trim().min(1).max(32).nullable(),
        reason: z.string().trim().min(1).max(160).nullable()
      })
      .strict()
      .default({ overall: null, reason: null }),
    flashback: z.string().trim().min(1).max(160).nullable().default(null),
    stats: statsSchema
  })
  .strict();

export type ReflectionAIShape = z.infer<typeof reflectionAISchema>;

export const syncPayloadSchema = z
  .object({
    mode: reflectionModeSchema,
    anchorDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
  })
  .strict();

export const patchDailySchema = z
  .object({
    achievements: z.array(z.string().trim().min(1)).max(3).optional(),
    commitments: z.array(z.string().trim().min(1)).max(3).optional(),
    moodOverall: z.string().trim().min(1).max(32).nullable().optional(),
    moodReason: z.string().trim().min(1).max(160).nullable().optional(),
    flashback: z.string().trim().min(1).max(160).nullable().optional()
  })
  .strict()
  .refine(
    (payload) =>
      Object.values(payload).some(
        (value) => value !== undefined && value !== null
      ),
    {
      message: 'At least one field must be provided for update.'
    }
  );

export const patchPeriodSchema = patchDailySchema;

export type SyncPayload = z.infer<typeof syncPayloadSchema>;
export type PatchDailyPayload = z.infer<typeof patchDailySchema>;
export type PatchPeriodPayload = z.infer<typeof patchPeriodSchema>;

export const REFLECTION_MODE_ORDER: ReflectionMode[] = [
  'daily',
  'weekly',
  'monthly'
];
