import { useEffect, useState } from 'react';
import { useChatContext } from '../app/ChatContext';
import { searchMessages } from '../services/messageService';
import type { ChatMessage } from '../types/chat';
import { formatTime } from '../utils/dateGrouping';

interface SearchPageProps {
  onBack: () => void;
}

export function SearchPage({ onBack }: SearchPageProps) {
  const { conversationId, me } = useChatContext();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const found = await searchMessages(conversationId, trimmed);
        setResults(found);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, conversationId]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b border-black/5 px-3 py-2">
        <button onClick={onBack} className="text-xl">
          ←
        </button>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search messages"
          className="flex-1 rounded-lg bg-[var(--surface)] px-3 py-2 text-base outline-none"
        />
      </header>
      <div className="flex-1 overflow-y-auto">
        {loading && <div className="p-4 text-center text-sm text-[var(--text-muted)]">Searching…</div>}
        {results.map((m) => (
          <div key={m.id} className="border-b border-black/5 px-4 py-3">
            <div className="text-sm">{m.senderId === me.id ? 'You' : ''}</div>
            <div className="truncate text-[var(--text)]">{m.content}</div>
            <div className="text-xs text-[var(--text-muted)]">{formatTime(m.createdAt)}</div>
          </div>
        ))}
        {!loading && query.trim().length >= 2 && results.length === 0 && (
          <div className="p-4 text-center text-sm text-[var(--text-muted)]">No results.</div>
        )}
      </div>
    </div>
  );
}
