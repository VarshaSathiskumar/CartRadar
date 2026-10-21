import { callFunction } from '../services/functions';
import type { Utterance } from '../core/types';

/**
 * Everything the app needs from Bee. The Bee token never reaches the app: the bee-sync Edge Function
 * (supabase/functions/bee-sync) holds it and returns the transcript lines.
 */
export interface BeeClient {
  /** Recent utterances, oldest first. May include ones already returned earlier; callers de-duplicate by id. */
  fetchRecentUtterances(since?: number): Promise<Utterance[]>;
}

export class FunctionBeeClient implements BeeClient {
  async fetchRecentUtterances(since?: number): Promise<Utterance[]> {
    const { utterances } = await callFunction<{ utterances: Utterance[] }>('bee-sync', { since });
    return utterances;
  }
}
