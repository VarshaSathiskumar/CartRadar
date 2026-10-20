import type { Utterance } from '../core/types';

/**
 * Everything the app needs from Bee. Keep Bee-specific details inside this
 * file so a change in Bee's API only touches one place.
 */
export interface BeeClient {
  /** Recent utterances, oldest first. May include ones already returned earlier; callers de-duplicate by id. */
  fetchRecentUtterances(): Promise<Utterance[]>;
}

export class BeeAuthError extends Error {}

/**
 * ASSUMPTIONS TO VERIFY against https://docs.bee.computer (not reachable when
 * this was written, so the shapes below come from secondary sources):
 *  - base URL https://api.bee.computer, `Authorization: Bearer <token>`
 *  - GET /v1/conversations lists conversations; GET /v1/conversations/{id} returns one with utterances
 * `parseConversation` is deliberately tolerant about field names; adjust it once the real payload is confirmed.
 */
export class HttpBeeClient implements BeeClient {
  constructor(
    private readonly token: string,
    private readonly baseUrl = 'https://api.bee.computer',
    private readonly conversationLimit = 10,
  ) {}

  private async get(path: string): Promise<unknown> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${this.token}`, Accept: 'application/json' },
    });
    if (res.status === 401 || res.status === 403) throw new BeeAuthError('Bee rejected the access token');
    if (!res.ok) throw new Error(`Bee request failed (${res.status})`);
    return res.json();
  }

  async fetchRecentUtterances(): Promise<Utterance[]> {
    const list = (await this.get(`/v1/conversations?limit=${this.conversationLimit}`)) as Record<string, unknown>;
    const conversations = (Array.isArray(list) ? list : (list.conversations ?? list.data ?? [])) as Record<string, unknown>[];

    const out: Utterance[] = [];
    for (const summary of conversations) {
      let conversation = summary;
      if (!findUtterances(summary) && summary.id !== undefined) {
        conversation = (await this.get(`/v1/conversations/${String(summary.id)}`)) as Record<string, unknown>;
        conversation = ((conversation.conversation as Record<string, unknown>) ?? conversation) as Record<string, unknown>;
      }
      out.push(...parseConversation(conversation));
    }
    return out.sort((a, b) => a.at - b.at);
  }
}

type Raw = Record<string, unknown>;

function findUtterances(c: Raw): Raw[] | undefined {
  const candidate = c.utterances ?? c.transcriptions ?? c.transcript;
  return Array.isArray(candidate) ? (candidate as Raw[]) : undefined;
}

const asTime = (...values: unknown[]): number | undefined => {
  for (const v of values) {
    if (typeof v === 'number') return v < 1e12 ? v * 1000 : v;
    if (typeof v === 'string') {
      const t = Date.parse(v);
      if (!Number.isNaN(t)) return t;
    }
  }
  return undefined;
};

export function parseConversation(c: Raw): Utterance[] {
  const convoId = String(c.id ?? 'unknown');
  const convoTime = asTime(c.start_time, c.started_at, c.created_at) ?? Date.now();
  const raw = findUtterances(c);

  if (raw) {
    return raw.flatMap((u, i) => {
      const text = String(u.text ?? u.transcript ?? '').trim();
      if (!text) return [];
      return [
        {
          id: `${convoId}:${u.id ?? i}`,
          text,
          at: asTime(u.spoken_at, u.start_time, u.created_at) ?? convoTime + i,
          speaker: typeof u.speaker === 'string' ? u.speaker : undefined,
        },
      ];
    });
  }
  // Some payloads carry the whole transcript as one string.
  if (typeof c.transcript === 'string' && c.transcript.trim()) {
    return [{ id: `${convoId}:full`, text: c.transcript.trim(), at: convoTime }];
  }
  return [];
}

const DEMO_LINES = [
  "Hey, how was your day?",
  "Pretty good. Oh, we need to buy eggs, we're out of it.",
  "Yeah and I think we ran out of noodles too, we need to buy it.",
  "Did you see the game last night?",
  "We should pick up a gallon of milk and some bread.",
  "Don't forget we're running low on coffee.",
  "We don't need rice, we already have plenty.",
  "Add paper towels and dish soap to the grocery list.",
  "I'm out of time, I have to run.",
];

/** Feeds a scripted conversation, two lines per call, so the full flow can be tried without a Bee device. */
export class DemoBeeClient implements BeeClient {
  private cursor = 0;
  private round = 0;

  async fetchRecentUtterances(): Promise<Utterance[]> {
    const lines = DEMO_LINES.slice(this.cursor, this.cursor + 2);
    const now = Date.now();
    const out = lines.map((text, i) => ({ id: `demo:${this.round}:${this.cursor + i}`, text, at: now + i }));
    this.cursor += 2;
    if (this.cursor >= DEMO_LINES.length) {
      this.cursor = 0;
      this.round += 1;
    }
    return out;
  }
}
