import { useEffect, useState } from 'react';
import { useChatContext } from '../app/ChatContext';
import { daysTogether, getCoupleProfile, upsertCoupleProfile, type CoupleProfile } from '../services/coupleService';

interface CouplePageProps {
  onBack: () => void;
}

export function CouplePage({ onBack }: CouplePageProps) {
  const { conversationId, me, partner } = useChatContext();
  const [profile, setProfile] = useState<CoupleProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState('');
  const [tagline, setTagline] = useState('');
  const [start, setStart] = useState('');

  useEffect(() => {
    (async () => {
      const p = await getCoupleProfile(conversationId);
      setProfile(p);
      setNickname(p?.nickname ?? '');
      setTagline(p?.tagline ?? '');
      setStart(p?.relationship_start ?? '');
    })();
  }, [conversationId]);

  const save = async () => {
    await upsertCoupleProfile(conversationId, {
      nickname: nickname || null,
      tagline: tagline || null,
      relationship_start: start || null,
    });
    setProfile((p) => ({ ...(p ?? { conversation_id: conversationId, background_path: null, updated_at: '' }), nickname, tagline, relationship_start: start }));
    setEditing(false);
  };

  const days = daysTogether(profile?.relationship_start ?? null);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b border-black/5 px-3 py-2">
        <button onClick={onBack} className="text-xl">
          ←
        </button>
        <h1 className="text-base font-semibold">Couple space</h1>
        <button className="ml-auto text-sm text-[var(--accent)]" onClick={() => setEditing((v) => !v)}>
          {editing ? 'Cancel' : 'Edit'}
        </button>
      </header>

      <div className="flex flex-1 flex-col items-center gap-4 overflow-y-auto px-6 py-10 text-center">
        <span className="text-4xl">❤️</span>
        {editing ? (
          <div className="flex w-full max-w-xs flex-col gap-3">
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Couple nickname"
              className="rounded-lg bg-[var(--surface)] px-3 py-2 text-center outline-none"
            />
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="rounded-lg bg-[var(--surface)] px-3 py-2 text-center outline-none"
            />
            <input
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="A short tagline"
              className="rounded-lg bg-[var(--surface)] px-3 py-2 text-center outline-none"
            />
            <button onClick={save} className="rounded-lg bg-[var(--accent)] py-2 text-white">
              Save
            </button>
          </div>
        ) : (
          <>
            <div className="text-xl font-semibold">
              {me.name} &amp; {partner.name}
            </div>
            {profile?.nickname && <div className="text-[var(--text-muted)]">"{profile.nickname}"</div>}
            {days !== null && (
              <div>
                <div className="text-sm text-[var(--text-muted)]">Together for</div>
                <div className="text-3xl font-bold text-[var(--accent)]">{days} days</div>
              </div>
            )}
            {profile?.tagline && <div className="italic text-[var(--text-muted)]">{profile.tagline}</div>}
          </>
        )}
      </div>
    </div>
  );
}
