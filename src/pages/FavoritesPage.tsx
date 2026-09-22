import { useEffect, useState } from 'react';
import { useChatContext } from '../app/ChatContext';
import { fetchFavoriteIds } from '../services/extrasService';
import { supabase } from '../lib/supabase';
import { rowToMessage, type ChatMessage } from '../types/chat';
import { formatTime } from '../utils/dateGrouping';

interface FavoritesPageProps {
  onBack: () => void;
}

export function FavoritesPage({ onBack }: FavoritesPageProps) {
  const { conversationId, me } = useChatContext();
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    (async () => {
      const ids = await fetchFavoriteIds(conversationId, me.id);
      if (ids.size === 0) return setMessages([]);
      const { data } = await supabase.from('messages').select('*').in('id', Array.from(ids));
      setMessages((data ?? []).map(rowToMessage));
    })();
  }, [conversationId, me.id]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b border-black/5 px-3 py-2">
        <button onClick={onBack} className="text-xl">
          ←
        </button>
        <h1 className="text-base font-semibold">Favorites</h1>
      </header>
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 && <div className="p-4 text-center text-sm text-[var(--text-muted)]">No favorites yet.</div>}
        {messages.map((m) => (
          <div key={m.id} className="border-b border-black/5 px-4 py-3">
            <div className="truncate">{m.content ?? (m.type === 'image' ? '📷 Photo' : '🎤 Voice message')}</div>
            <div className="text-xs text-[var(--text-muted)]">{formatTime(m.createdAt)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
