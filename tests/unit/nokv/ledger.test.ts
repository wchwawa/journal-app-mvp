import { describe, expect, it } from 'vitest';
import {
  foldLedger,
  ledgerShardPath,
  serializeEvent,
  type LedgerEvent
} from '@/lib/nokv/ledger';

const ev = (
  partial: Partial<LedgerEvent> &
    Pick<LedgerEvent, 'event_id' | 'kind' | 'date'>
): string =>
  serializeEvent({
    v: 1,
    ts: '2026-08-05T00:00:00Z',
    ...partial
  } as LedgerEvent);

describe('ledger fold', () => {
  it('shards by event month', () => {
    expect(ledgerShardPath('2026-08-05')).toBe('ledger/2026-08.jsonl');
  });

  it('folds created minus deleted with event_id dedupe', () => {
    const lines = [
      ev({
        event_id: 'e1',
        kind: 'entry_created',
        date: '2026-08-05',
        entry_id: 'a'
      }),
      ev({
        event_id: 'e1',
        kind: 'entry_created',
        date: '2026-08-05',
        entry_id: 'a'
      }), // timeout replay
      ev({
        event_id: 'e2',
        kind: 'entry_created',
        date: '2026-08-05',
        entry_id: 'b'
      }),
      ev({
        event_id: 'e3',
        kind: 'entry_deleted',
        date: '2026-08-05',
        entry_id: 'a'
      })
    ].flatMap((l) => l.split('\n').filter(Boolean));

    const state = foldLedger(lines);
    expect([...state.byDate.get('2026-08-05')!.liveEntryIds]).toEqual(['b']);
  });

  it('keeps the last mood and summary per day', () => {
    const lines = [
      ev({
        event_id: 'm1',
        kind: 'mood_set',
        date: '2026-08-05',
        day_quality: 'bad',
        emotions: []
      }),
      ev({
        event_id: 'm2',
        kind: 'mood_set',
        date: '2026-08-05',
        day_quality: 'good',
        emotions: ['calm']
      }),
      ev({
        event_id: 's1',
        kind: 'summary_written',
        date: '2026-08-05',
        mood_quality: 'good',
        entry_count: 3
      })
    ].flatMap((l) => l.split('\n').filter(Boolean));

    const day = foldLedger(lines).byDate.get('2026-08-05')!;
    expect(day.mood?.day_quality).toBe('good');
    expect(day.summary?.entry_count).toBe(3);
  });

  it('tolerates malformed lines', () => {
    const state = foldLedger(['not json', '', '{"v":1}']);
    expect(state.byDate.size).toBe(0);
  });
});
