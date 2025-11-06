import OpenAI from 'openai';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import { generateReflection } from './generator';
import type { ReflectionMode } from './types';

type AdminClient = SupabaseClient<Database>;

const DEFAULT_MODES: ReflectionMode[] = ['daily', 'weekly', 'monthly'];

interface SyncOptions {
  supabase: AdminClient;
  openai: OpenAI;
  userId: string;
  anchorDate: string;
  modes?: ReflectionMode[];
}

export async function syncReflectionsForDate({
  supabase,
  openai,
  userId,
  anchorDate,
  modes = DEFAULT_MODES
}: SyncOptions) {
  for (const mode of modes) {
    try {
      await generateReflection({
        supabase,
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
