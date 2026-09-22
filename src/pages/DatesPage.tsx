import { useEffect, useState } from 'react';
import { useChatContext } from '../app/ChatContext';
import {
  addSpecialDate,
  daysUntilNextOccurrence,
  deleteSpecialDate,
  listSpecialDates,
  type SpecialDate,
} from '../services/memoriesService';
import type { SpecialDateType } from '../types/database';

interface DatesPageProps {
  onBack: () => void;
}

export function DatesPage({ onBack }: DatesPageProps) {
  const { conversationId, me } = useChatContext();
  const [dates, setDates] = useState<SpecialDate[]>([]);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [type, setType] = useState<SpecialDateType>('custom');
  const [recurs, setRecurs] = useState(true);

  const refresh = () => void listSpecialDates(conversationId).then(setDates);
  useEffect(refresh, [conversationId]);

  const submit = async () => {
    if (!title.trim() || !date) return;
    await addSpecialDate({
      conversation_id: conversationId,
      title,
      date,
      type,
      recurs_yearly: recurs,
      created_by: me.id,
    });
    setTitle('');
    setDate('');
    setAdding(false);
    refresh();
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b border-black/5 px-3 py-2">
        <button onClick={onBack} className="text-xl">
          ←
        </button>
        <h1 className="text-base font-semibold">Special dates</h1>
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
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg bg-[var(--surface)] px-3 py-2 outline-none"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value as SpecialDateType)}
            className="rounded-lg bg-[var(--surface)] px-3 py-2 outline-none"
          >
            <option value="anniversary">Anniversary</option>
            <option value="birthday">Birthday</option>
            <option value="first_meeting">First meeting</option>
            <option value="custom">Custom</option>
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={recurs} onChange={(e) => setRecurs(e.target.checked)} />
            Repeats yearly
          </label>
          <button onClick={submit} className="rounded-lg bg-[var(--accent)] py-2 text-white">
            Add date
          </button>
        </div>
      )}

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
        {dates.map((d) => {
          const remaining = daysUntilNextOccurrence(d.date, d.recurs_yearly);
          return (
            <div key={d.id} className="flex items-center justify-between rounded-xl bg-[var(--surface)] p-3">
              <div>
                <div className="font-medium">
                  ❤️ {d.title} — {remaining === 0 ? 'Today' : `${remaining} days remaining`}
                </div>
                <div className="text-xs text-[var(--text-muted)]">{d.date}</div>
              </div>
              <button onClick={() => void deleteSpecialDate(d.id).then(refresh)} className="text-xs text-red-500">
                Delete
              </button>
            </div>
          );
        })}
        {dates.length === 0 && !adding && (
          <div className="py-10 text-center text-sm text-[var(--text-muted)]">No special dates yet.</div>
        )}
      </div>
    </div>
  );
}
