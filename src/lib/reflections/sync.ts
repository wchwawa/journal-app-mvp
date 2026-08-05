import OpenAI from 'openai';
import { getJournalRepo } from '@/lib/data';
import { generateReflection } from './generator';
import type { ReflectionMode } from './types';

const SYNC_MODES: ReflectionMode[] = ['daily', 'weekly', 'monthly'];

export async function syncReflectionsForDate(opts: {
  openai: OpenAI;
  userId: string;
  anchorDate: string;
}): Promise<void> {
  const { openai, userId, anchorDate } = opts;
  const repo = getJournalRepo();

  for (const mode of SYNC_MODES) {
    try {
      await generateReflection({
        repo,
        openai,
        userId,
        mode,
        anchorDate
      });
    } catch (error) {
      console.error(`Failed to sync ${mode} reflection`, error);
    }
  }
}
