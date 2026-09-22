import { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../../types/chat';
import { formatTime } from '../../utils/dateGrouping';
import { linkify } from '../../utils/linkify';
import { getSignedUrl } from '../../services/storageService';

export type ReadState = 'sent' | 'delivered' | 'read';

interface MessageBubbleProps {
  message: ChatMessage;
  isMine: boolean;
  reactions: Array<{ userId: string; reaction: string }>;
  isPinned: boolean;
  isFavorite: boolean;
  readState: ReadState;
  replyPreview: { senderLabel: string; snippet: string } | null;
  highlighted?: boolean;
  onOpenActions: () => void;
  onTapReply: () => void;
  onOpenMedia: () => void;
}

function replySnippet(message: ChatMessage): string {
  if (message.type === 'image') return '📷 Photo';
  if (message.type === 'voice') return '🎤 Voice message';
  return message.content ?? '';
}

export { replySnippet };

export function MessageBubble({
  message,
  isMine,
  reactions,
  isPinned,
  isFavorite,
  readState,
  replyPreview,
  highlighted,
  onOpenActions,
  onTapReply,
  onOpenMedia,
}: MessageBubbleProps) {
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (message.mediaPath && !message.deletedAt) {
      void getSignedUrl('chat-media', message.mediaPath).then(setMediaUrl).catch(() => setMediaUrl(null));
    }
  }, [message.mediaPath, message.deletedAt]);

  const startPress = () => {
    pressTimer.current = setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate(10);
      onOpenActions();
    }, 450);
  };
  const cancelPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  };

  const bubbleBg = isMine ? 'bg-[var(--bubble-mine)] text-white' : 'bg-[var(--bubble-theirs)] text-[var(--text)]';

  return (
    <div className={`flex px-3 py-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[78%] select-none rounded-2xl px-3 py-2 no-select ${bubbleBg} ${
          highlighted ? 'ring-2 ring-[var(--accent)]' : ''
        }`}
        onPointerDown={startPress}
        onPointerUp={cancelPress}
        onPointerLeave={cancelPress}
        onContextMenu={(e) => {
          e.preventDefault();
          onOpenActions();
        }}
      >
        {replyPreview && (
          <button
            onClick={onTapReply}
            className="mb-1 block w-full rounded-lg border-l-2 border-white/40 bg-black/10 px-2 py-1 text-left text-xs opacity-90"
          >
            <div className="font-medium">{replyPreview.senderLabel}</div>
            <div className="truncate">{replyPreview.snippet}</div>
          </button>
        )}

        {message.deletedAt ? (
          <div className="italic opacity-70">This message was deleted</div>
        ) : message.type === 'text' ? (
          <div className="whitespace-pre-wrap break-words text-[0.95rem]">{linkify(message.content ?? '')}</div>
        ) : message.type === 'image' ? (
          <button onClick={onOpenMedia} className="block">
            {mediaUrl ? (
              <img src={mediaUrl} alt="" className="max-h-64 w-full rounded-lg object-cover" loading="lazy" />
            ) : (
              <div className="h-40 w-52 animate-pulse rounded-lg bg-black/10" />
            )}
            {message.content && <div className="mt-1 text-sm">{linkify(message.content)}</div>}
          </button>
        ) : (
          <VoicePlayer url={mediaUrl} durationMs={message.mediaMeta?.duration ?? 0} />
        )}

        <div className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-70">
          {message.isEdited && <span>Edited</span>}
          <span>{formatTime(message.createdAt)}</span>
          {isMine && (
            <span>{readState === 'read' ? '✓✓' : readState === 'delivered' ? '✓✓' : '✓'}</span>
          )}
        </div>

        {reactions.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-0.5 text-xs">
            {reactions.map((r, i) => (
              <span key={i} className="rounded-full bg-black/10 px-1.5 py-0.5">
                {r.reaction}
              </span>
            ))}
          </div>
        )}
        {(isPinned || isFavorite) && (
          <div className="mt-0.5 flex gap-1 text-[10px] opacity-70">
            {isPinned && <span>📌</span>}
            {isFavorite && <span>⭐</span>}
          </div>
        )}
      </div>
    </div>
  );
}

function VoicePlayer({ url, durationMs }: { url: string | null; durationMs: number }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) audioRef.current.pause();
    else void audioRef.current.play();
  };

  const totalSeconds = Math.round(durationMs / 1000);

  return (
    <div className="flex w-48 items-center gap-2">
      <button
        onClick={toggle}
        disabled={!url}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-black/10 disabled:opacity-40"
      >
        {playing ? '⏸' : '▶'}
      </button>
      <input
        type="range"
        min={0}
        max={100}
        value={progress}
        onChange={(e) => {
          if (!audioRef.current) return;
          const pct = Number(e.target.value);
          audioRef.current.currentTime = (pct / 100) * (audioRef.current.duration || 0);
        }}
        className="h-1 flex-1"
      />
      <span className="text-[10px] tabular-nums">
        {String(Math.floor(totalSeconds / 60)).padStart(1, '0')}:{String(totalSeconds % 60).padStart(2, '0')}
      </span>
      {url && (
        <audio
          ref={audioRef}
          src={url}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onTimeUpdate={(e) => {
            const el = e.currentTarget;
            if (el.duration) setProgress((el.currentTime / el.duration) * 100);
          }}
        />
      )}
    </div>
  );
}
