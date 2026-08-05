import 'server-only';

import type { JournalDataRepository } from './repository';
import { NokvUnavailableError } from './repository';
import { SupabaseJournalRepository } from './supabase-repository';
import { NokvJournalRepository } from '@/lib/nokv/journal-repository';

// DATA_BACKEND=supabase (default) | nokv
// In nokv mode reads fall back to Supabase when the NoKV transport is down
// (dual writes keep it fresh during migration); writes surface the error so
// routes return 503 instead of split-braining across two primaries.

const READ_METHODS = new Set<keyof JournalDataRepository>([
  'getMood',
  'listMoodsInRange',
  'getEntry',
  'getAudioBlob',
  'listEntriesForDay',
  'getEntryStats',
  'getDailySummary',
  'listDailySummaries',
  'listDailySummariesInRange',
  'queryJournalDays',
  'getPeriodReflection',
  'getPeriodReflectionById',
  'listPeriodReflections'
]);

function withReadFallback(
  primary: JournalDataRepository,
  fallback: JournalDataRepository
): JournalDataRepository {
  return new Proxy(primary, {
    get(target, prop: string | symbol) {
      const value = Reflect.get(target, prop);
      if (
        typeof value !== 'function' ||
        !READ_METHODS.has(prop as keyof JournalDataRepository)
      ) {
        return typeof value === 'function' ? value.bind(target) : value;
      }
      return async (...args: unknown[]) => {
        try {
          return await (value as (...a: unknown[]) => Promise<unknown>).apply(
            target,
            args
          );
        } catch (err) {
          if (err instanceof NokvUnavailableError) {
            // eslint-disable-next-line no-console
            console.error(
              `[data] nokv unavailable for ${String(prop)}; falling back to supabase`
            );
            const fb = Reflect.get(fallback, prop) as (
              ...a: unknown[]
            ) => Promise<unknown>;
            return fb.apply(fallback, args);
          }
          throw err;
        }
      };
    }
  });
}

let repoMemo: JournalDataRepository | null = null;

export function getJournalRepo(): JournalDataRepository {
  if (repoMemo) return repoMemo;
  const backend = process.env.DATA_BACKEND ?? 'supabase';
  if (backend === 'nokv') {
    repoMemo = withReadFallback(
      new NokvJournalRepository(),
      new SupabaseJournalRepository()
    );
  } else {
    repoMemo = new SupabaseJournalRepository();
  }
  return repoMemo;
}

export type { JournalDataRepository } from './repository';
export * from './repository';
