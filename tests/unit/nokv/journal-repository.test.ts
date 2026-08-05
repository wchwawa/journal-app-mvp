import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeWorkbench, FakeToolError } from '../../mocks/fake-workbench';

// One shared fake per test file run; reset in beforeEach.
const fake = new FakeWorkbench();

vi.mock('@/lib/nokv/mcp-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/nokv/mcp-client')>();
  class NokvToolError extends Error {}
  return {
    ...actual,
    NokvToolError,
    isNokvEnabled: () => true,
    callWorkbenchTool: async (name: string, args: Record<string, unknown>) => {
      try {
        return fake.dispatch(name, args);
      } catch (err) {
        if (err instanceof FakeToolError) {
          throw new NokvToolError(err.message);
        }
        throw err;
      }
    }
  };
});

vi.mock('@/lib/nokv/blob-cli', () => ({
  collectBlob: async (
    wb: string,
    section: string,
    path: string,
    data: Buffer
  ) => fake.collect(wb, section, path, data),
  materializeBlob: async (wb: string, section: string, path: string) =>
    fake.materialize(wb, section, path)
}));

import { NokvJournalRepository } from '@/lib/nokv/journal-repository';

const USER = 'user_test1';

function freshRepo(): NokvJournalRepository {
  fake.workbenches.clear();
  fake.blobs.clear();
  return new NokvJournalRepository();
}

describe('NokvJournalRepository — mood', () => {
  let repo: NokvJournalRepository;
  beforeEach(() => {
    repo = freshRepo();
  });

  it('upserts and reads back a mood', async () => {
    await repo.upsertMood(USER, '2026-08-05', {
      dayQuality: 'good',
      emotions: ['calm']
    });
    const mood = await repo.getMood(USER, '2026-08-05');
    expect(mood?.day_quality).toBe('good');
    expect(mood?.emotions).toEqual(['calm']);
  });

  it('update preserves created_at and changes values', async () => {
    const first = await repo.upsertMood(USER, '2026-08-05', {
      dayQuality: 'bad',
      emotions: []
    });
    const second = await repo.upsertMood(USER, '2026-08-05', {
      dayQuality: 'good',
      emotions: ['happy']
    });
    expect(second.created_at).toBe(first.created_at);
    expect((await repo.getMood(USER, '2026-08-05'))?.day_quality).toBe('good');
  });

  it('returns null for a day without mood', async () => {
    expect(await repo.getMood(USER, '2026-01-01')).toBeNull();
  });
});

describe('NokvJournalRepository — entries', () => {
  let repo: NokvJournalRepository;
  beforeEach(() => {
    repo = freshRepo();
  });

  async function create(text = 'hello world') {
    return repo.createEntry(USER, {
      audio: Buffer.from([1, 2, 3, 4]),
      mimeType: 'audio/webm',
      transcript: text,
      rephrasedText: `Polished: ${text}`,
      language: 'en'
    });
  }

  it('creates, lists, reads and serves audio', async () => {
    const entry = await create();
    const listed = await repo.listEntriesForDay(USER, entry.date);
    expect(listed.map((e) => e.id)).toEqual([entry.id]);

    const roundtrip = await repo.getEntry(USER, entry.id);
    expect(roundtrip?.transcript.rephrased_text).toBe('Polished: hello world');

    const blob = await repo.getAudioBlob(USER, entry.id);
    expect(blob?.data.equals(Buffer.from([1, 2, 3, 4]))).toBe(true);
    expect(blob?.mimeType).toBe('audio/webm');
  });

  it('updates rephrased text via block edit', async () => {
    const entry = await create();
    const updated = await repo.updateRephrasedText(USER, entry.id, 'better');
    expect(updated.transcript.rephrased_text).toBe('better');
    expect(
      (await repo.getEntry(USER, entry.id))?.transcript.rephrased_text
    ).toBe('better');
  });

  it('delete hides the entry from every view', async () => {
    const entry = await create();
    await repo.deleteEntry(USER, entry.id);
    expect(await repo.getEntry(USER, entry.id)).toBeNull();
    expect(await repo.listEntriesForDay(USER, entry.date)).toEqual([]);
    expect(await repo.getAudioBlob(USER, entry.id)).toBeNull();
    const stats = await repo.getEntryStats(USER);
    expect(stats.totalEntries).toBe(0);
  });

  it('counts stats from the ledger fold', async () => {
    await create('one');
    await create('two');
    const stats = await repo.getEntryStats(USER);
    expect(stats.totalEntries).toBe(2);
    expect(stats.currentStreak).toBeGreaterThanOrEqual(1);
  });
});

describe('NokvJournalRepository — daily summaries', () => {
  let repo: NokvJournalRepository;
  beforeEach(() => {
    repo = freshRepo();
  });

  it('upserts and projects a summary', async () => {
    const s = await repo.upsertDailySummary(USER, '2026-08-05', {
      summary: 'A fine day of shipping.',
      entryCount: 2,
      moodQuality: 'good',
      dominantEmotions: ['calm']
    });
    expect(s.summary).toBe('A fine day of shipping.');
    expect(s.id).toBe('daily:2026-08-05');
    const read = await repo.getDailySummary(USER, '2026-08-05');
    expect(read?.entry_count).toBe(2);
  });

  it('generation preserves user edits behind the latch', async () => {
    await repo.upsertDailySummary(USER, '2026-08-05', {
      summary: 'day',
      entryCount: 1,
      moodQuality: 'good',
      dominantEmotions: []
    });
    // User edit: marks edited (creates the create-only latch).
    await repo.updateDailySummaryReflection(
      USER,
      '2026-08-05',
      { achievements: ['user wrote this'], flashback: 'user flashback' },
      { markEdited: true }
    );
    // Background regeneration must NOT clobber user fields...
    const after = await repo.updateDailySummaryReflection(
      USER,
      '2026-08-05',
      {
        achievements: ['machine output'],
        flashback: 'machine flashback',
        gen_version: 'v2',
        last_generated_at: '2026-08-05T10:00:00Z'
      },
      { preserveIfEdited: true }
    );
    expect(after.achievements).toEqual(['user wrote this']);
    expect(after.flashback).toBe('user flashback');
    // ...but generation metadata still advances.
    expect(after.gen_version).toBe('v2');
    expect(after.edited).toBe(true);
  });

  it('lists summaries with cursor and range semantics', async () => {
    for (const d of ['2026-08-01', '2026-08-03', '2026-08-05']) {
      await repo.upsertDailySummary(USER, d, {
        summary: `sum ${d}`,
        entryCount: 1,
        moodQuality: null,
        dominantEmotions: []
      });
    }
    const latest = await repo.listDailySummaries(USER, { limit: 2 });
    expect(latest.map((s) => s.date)).toEqual(['2026-08-05', '2026-08-03']);

    const upTo = await repo.listDailySummaries(USER, {
      before: '2026-08-03',
      limit: 10
    });
    expect(upTo.map((s) => s.date)).toEqual(['2026-08-03', '2026-08-01']);

    const range = await repo.listDailySummariesInRange(
      USER,
      '2026-08-02',
      '2026-08-04'
    );
    expect(range.map((s) => s.date)).toEqual(['2026-08-03']);
  });
});

describe('NokvJournalRepository — queryJournalDays', () => {
  let repo: NokvJournalRepository;
  beforeEach(async () => {
    repo = freshRepo();
    await repo.upsertDailySummary(USER, '2026-08-01', {
      summary: 'Walked by the harbour and thought about NoKV.',
      entryCount: 1,
      moodQuality: 'good',
      dominantEmotions: []
    });
    await repo.upsertDailySummary(USER, '2026-08-02', {
      summary: 'Rainy day indoors.',
      entryCount: 1,
      moodQuality: 'bad',
      dominantEmotions: []
    });
    await repo.upsertMood(USER, '2026-08-02', {
      dayQuality: 'bad',
      emotions: ['tired']
    });
  });

  it('returns the exact total count with no filters', async () => {
    const { days, totalCount } = await repo.queryJournalDays(USER, {
      page: 1,
      limit: 10
    });
    expect(totalCount).toBe(2);
    expect(days.map((d) => d.date)).toEqual(['2026-08-02', '2026-08-01']);
    expect(days[0].mood?.emotions).toEqual(['tired']);
  });

  it('filters by mood with exact count', async () => {
    const { days, totalCount } = await repo.queryJournalDays(USER, {
      moods: ['good'],
      page: 1,
      limit: 10
    });
    expect(totalCount).toBe(1);
    expect(days[0].date).toBe('2026-08-01');
  });

  it('filters by keyword through the sidecar grep', async () => {
    const hit = await repo.queryJournalDays(USER, {
      keyword: 'harbour',
      page: 1,
      limit: 10
    });
    expect(hit.totalCount).toBe(1);
    expect(hit.days[0].date).toBe('2026-08-01');

    const miss = await repo.queryJournalDays(USER, {
      keyword: 'nonexistent-keyword',
      page: 1,
      limit: 10
    });
    expect(miss.totalCount).toBe(0);
  });
});

describe('NokvJournalRepository — period reflections', () => {
  let repo: NokvJournalRepository;
  beforeEach(() => {
    repo = freshRepo();
  });

  it('creates, regenerates and preserves user edits', async () => {
    const created = await repo.upsertPeriodReflection(
      USER,
      'weekly',
      '2026-08-03',
      '2026-08-09',
      { achievements: ['machine v1'], gen_version: 'v1' }
    );
    expect(created.id).toBe('weekly:2026-08-03');

    // User edits -> latch drops.
    await repo.updatePeriodReflectionFields(USER, 'weekly:2026-08-03', {
      achievements: ['user version']
    });

    // Regeneration keeps user content, advances metadata.
    const regen = await repo.upsertPeriodReflection(
      USER,
      'weekly',
      '2026-08-03',
      '2026-08-09',
      { achievements: ['machine v2'], gen_version: 'v2' }
    );
    expect(regen.achievements).toEqual(['user version']);
    expect(regen.gen_version).toBe('v2');
    expect(regen.edited).toBe(true);
  });

  it('lists newest first', async () => {
    await repo.upsertPeriodReflection(
      USER,
      'weekly',
      '2026-07-27',
      '2026-08-02',
      {}
    );
    await repo.upsertPeriodReflection(
      USER,
      'weekly',
      '2026-08-03',
      '2026-08-09',
      {}
    );
    const list = await repo.listPeriodReflections(USER, 'weekly', 12);
    expect(list.map((r) => r.period_start)).toEqual([
      '2026-08-03',
      '2026-07-27'
    ]);
  });
});

describe('NokvJournalRepository — privacy', () => {
  it('deleteAllUserData short-circuits every read', async () => {
    const repo = freshRepo();
    await repo.upsertDailySummary(USER, '2026-08-05', {
      summary: 'to be deleted',
      entryCount: 1,
      moodQuality: null,
      dominantEmotions: []
    });
    await repo.deleteAllUserData(USER);
    expect(await repo.getDailySummary(USER, '2026-08-05')).toBeNull();
    expect(await repo.getMood(USER, '2026-08-05')).toBeNull();
    expect(
      (await repo.queryJournalDays(USER, { page: 1, limit: 10 })).totalCount
    ).toBe(0);
  });
});
