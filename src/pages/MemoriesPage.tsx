import { useEffect, useState } from 'react';
import { useChatContext } from '../app/ChatContext';
import { addMemory, deleteMemory, listMemories, type Memory } from '../services/memoriesService';

interface MemoriesPageProps {
  onBack: () => void;
}

export function MemoriesPage({ onBack }: MemoriesPageProps) {
  const { conversationId, me } = useChatContext();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const refresh = () => void listMemories(conversationId).then(setMemories);
  useEffect(refresh, [conversationId]);

  const submit = async () => {
    if (!title.trim()) return;
    await addMemory({
      conversation_id: conversationId,
      title,
      description: description || null,
      media_path: null,
      source_message_id: null,
      date: new Date().toISOString().slice(0, 10),
      created_by: me.id,
    });
    setTitle('');
    setDescription('');
    setAdding(false);
    refresh();
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b border-black/5 px-3 py-2">
        <button onClick={onBack} className="text-xl">
          ←
        </button>
        <h1 className="text-base font-semibold">Memories</h1>
        <button className="ml-auto text-xl text-[var(--accent)]" onClick={() => setAdding((v) => !v)}>
          +
        </button>
      </header>

      {adding && (
        <div className="flex flex-col gap-2 border-b border-black/5 p-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="rounded-lg bg-[var(--surface)] px-3 py-2 outline-none"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Note"
            className="rounded-lg bg-[var(--surface)] px-3 py-2 outline-none"
          />
          <button onClick={submit} className="rounded-lg bg-[var(--accent)] py-2 text-white">
            Add memory
          </button>
        </div>
      )}

      <div className="grid flex-1 grid-cols-2 gap-3 overflow-y-auto p-3">
        {memories.map((m) => (
          <div key={m.id} className="rounded-xl bg-[var(--surface)] p-3">
            <div className="font-medium">{m.title}</div>
            {m.description && <div className="mt-1 text-sm text-[var(--text-muted)]">{m.description}</div>}
            {m.date && <div className="mt-2 text-xs text-[var(--text-muted)]">{m.date}</div>}
            <button
              onClick={() => void deleteMemory(m.id).then(refresh)}
              className="mt-2 text-xs text-red-500"
            >
              Delete
            </button>
          </div>
        ))}
        {memories.length === 0 && !adding && (
          <div className="col-span-2 py-10 text-center text-sm text-[var(--text-muted)]">No memories yet.</div>
        )}
      </div>
    </div>
  );
}
