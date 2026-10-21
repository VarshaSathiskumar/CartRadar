import { describe, expect, it } from 'vitest';
import { changedSince, toUtterances } from './bee.ts';

describe('toUtterances', () => {
  it('flattens transcriptions into stable ids, skipping blank lines', () => {
    const out = toUtterances({
      id: 42,
      start_time: 1000,
      transcriptions: [
        { utterances: [{ id: 7, text: ' we need eggs ', speaker: 'Ann', spoken_at: 5000 }, { id: 8, text: '  ' }] },
        { utterances: [{ id: 9, text: 'ok' }] },
      ],
    });
    expect(out).toEqual([
      { id: '42:7', text: 'we need eggs', at: 5000, speaker: 'Ann' },
      { id: '42:9', text: 'ok', at: 1002, speaker: undefined },
    ]);
  });

  it('returns nothing for a conversation without a transcript', () => {
    expect(toUtterances({ id: 1 })).toEqual([]);
  });
});

describe('changedSince', () => {
  const list = [
    { id: 1, updated_at: 100, utterances_count: 5 },
    { id: 2, updated_at: 300, utterances_count: 5 },
    { id: 3, updated_at: 400, utterances_count: 0 },
  ];
  it('keeps everything with lines when there is no cutoff', () => {
    expect(changedSince(list, undefined).map((c) => c.id)).toEqual([1, 2]);
  });
  it('keeps only conversations changed at or after the cutoff', () => {
    expect(changedSince(list, 300).map((c) => c.id)).toEqual([2]);
  });
});
