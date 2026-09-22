import { useEffect, useState } from 'react';
import {
  fetchFavoriteIds,
  fetchHiddenIds,
  fetchPinnedIds,
  fetchReactions,
  fetchReads,
  type ReactionSummary,
  type ReadSummary,
} from '../services/extrasService';

export function useMessageExtras(conversationId: string, userId: string, version: number) {
  const [reactions, setReactions] = useState<ReactionSummary>({});
  const [reads, setReads] = useState<ReadSummary>({});
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [r, rd, p, f, h] = await Promise.all([
        fetchReactions(conversationId),
        fetchReads(conversationId),
        fetchPinnedIds(conversationId),
        fetchFavoriteIds(conversationId, userId),
        fetchHiddenIds(conversationId, userId),
      ]);
      if (cancelled) return;
      setReactions(r);
      setReads(rd);
      setPinnedIds(p);
      setFavoriteIds(f);
      setHiddenIds(h);
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId, userId, version]);

  return { reactions, reads, pinnedIds, favoriteIds, hiddenIds };
}
