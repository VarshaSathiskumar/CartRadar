/**
 * Bee conversation payloads, as returned by GET /v1/conversations and /v1/conversations/:id.
 * Field names were checked against a live account (the docs at docs.bee.computer/docs/api list the
 * endpoints but not the response shapes). Timestamps are epoch milliseconds.
 */
export interface BeeConversationSummary {
  id: number | string;
  start_time?: number;
  updated_at?: number;
  utterances_count?: number;
}

export interface BeeConversation extends BeeConversationSummary {
  transcriptions?: { utterances?: { id?: number | string; text?: string; speaker?: string; spoken_at?: number }[] }[];
}

/** What the app works with; the id is stable across syncs so the app can skip lines it already read. */
export interface Utterance {
  id: string;
  text: string;
  at: number;
  speaker?: string;
}

export function toUtterances(c: BeeConversation): Utterance[] {
  const out: Utterance[] = [];
  let n = 0;
  for (const t of c.transcriptions ?? []) {
    for (const u of t.utterances ?? []) {
      const index = n++;
      const text = (u.text ?? '').trim();
      if (!text) continue;
      out.push({
        id: `${c.id}:${u.id ?? index}`,
        text,
        at: u.spoken_at ?? (c.start_time ?? Date.now()) + index,
        speaker: typeof u.speaker === 'string' ? u.speaker : undefined,
      });
    }
  }
  return out;
}

/** Conversations whose last change is before `since` were fully read on an earlier sync. */
export function changedSince(list: BeeConversationSummary[], since: number | undefined): BeeConversationSummary[] {
  return list.filter((c) => (c.utterances_count ?? 1) > 0 && (since === undefined || (c.updated_at ?? Infinity) >= since));
}
