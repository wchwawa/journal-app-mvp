import { describe, expect, it } from 'vitest';
import {
  buildBlock,
  extractBlock,
  parseDoc,
  serializeDoc
} from '@/lib/nokv/journal-doc';

const sampleDay = {
  schema: 'echojournal.day.v1',
  user_id: 'user_abc',
  date: '2026-08-05',
  tz: 'Australia/Sydney',
  mood: {
    day_quality: 'good',
    emotions: ['calm', 'focused'],
    created_at: '2026-08-05T01:00:00.000Z',
    updated_at: '2026-08-05T02:00:00.000Z'
  },
  summary: null,
  reflection: null
};

describe('journal-doc serialization discipline', () => {
  it('extractBlock returns the byte-exact block buildBlock produces', () => {
    const text = serializeDoc(sampleDay);
    for (const key of ['mood', 'summary', 'reflection', 'date']) {
      const extracted = extractBlock(text, key);
      expect(extracted).not.toBeNull();
      expect(extracted).toBe(
        buildBlock(key, (sampleDay as Record<string, unknown>)[key] as never)
      );
    }
  });

  it('survives a serialize -> parse -> serialize byte roundtrip', () => {
    const text = serializeDoc(sampleDay);
    expect(serializeDoc(parseDoc(text))).toBe(text);
  });

  it('block replacement composes into a valid document', () => {
    const text = serializeDoc(sampleDay);
    const oldBlock = extractBlock(text, 'summary')!;
    const newBlock = buildBlock('summary', {
      text: 'A "quoted" day\nwith a newline',
      entry_count: 2,
      mood_quality: 'good',
      dominant_emotions: [],
      generated_at: 'x',
      updated_at: 'y'
    });
    const next = text.replace(oldBlock, newBlock);
    const parsed = parseDoc<{ summary: { text: string } }>(next);
    expect(parsed.summary.text).toBe('A "quoted" day\nwith a newline');
    // Untouched blocks stay byte-identical.
    expect(extractBlock(next, 'mood')).toBe(extractBlock(text, 'mood'));
  });

  it('top-level marker cannot collide with string content', () => {
    const tricky = {
      a: 'contains \n  "mood": fake marker in a string',
      mood: null
    };
    const text = serializeDoc(tricky);
    // The real newline pattern appears exactly once (string newlines are escaped).
    const occurrences = text.split('\n  "mood":').length - 1;
    expect(occurrences).toBe(1);
  });
});
