import { Suspense, lazy, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';

const EmojiPicker = lazy(() => import('emoji-picker-react'));

interface ComposerProps {
  replyPreview: { senderLabel: string; snippet: string } | null;
  onCancelReply: () => void;
  onSendText: (text: string) => void;
  onSendImage: (file: File, caption: string) => void;
  onSendVoice: (blob: Blob, mimeType: string, durationMs: number) => void;
  onTyping: () => void;
}

export function Composer({
  replyPreview,
  onCancelReply,
  onSendText,
  onSendImage,
  onSendVoice,
  onTyping,
}: ComposerProps) {
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recorder = useVoiceRecorder();

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSendText(trimmed);
    setText('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    } else if (e.key === 'Escape') {
      if (replyPreview) onCancelReply();
    }
  };

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onSendImage(file, '');
    e.target.value = '';
  };

  const handleMicDown = async () => {
    await recorder.start();
  };

  const handleMicUp = async () => {
    const result = await recorder.stop();
    if (result && result.durationMs > 300) {
      onSendVoice(result.blob, result.mimeType, result.durationMs);
    }
  };

  return (
    <div className="border-t border-black/5 bg-[var(--bg)]" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {replyPreview && (
        <div className="flex items-center justify-between border-b border-black/5 px-3 py-1.5 text-xs">
          <div className="truncate">
            <span className="font-medium">{replyPreview.senderLabel}: </span>
            {replyPreview.snippet}
          </div>
          <button onClick={onCancelReply} className="ml-2 text-[var(--text-muted)]">
            ✕
          </button>
        </div>
      )}
      <div className="flex items-end gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setShowEmoji((v) => !v)}
          aria-label="Emoji"
          className="flex h-11 w-11 shrink-0 items-center justify-center text-xl"
        >
          😊
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Attach image"
          className="flex h-11 w-11 shrink-0 items-center justify-center text-xl"
        >
          📎
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            onTyping();
          }}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          rows={1}
          className="max-h-32 min-h-[44px] flex-1 resize-none rounded-2xl bg-[var(--surface)] px-4 py-2.5 text-base outline-none"
        />

        {text.trim() ? (
          <button
            type="button"
            onClick={handleSend}
            aria-label="Send"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-lg text-white"
          >
            ➤
          </button>
        ) : (
          <button
            type="button"
            onPointerDown={handleMicDown}
            onPointerUp={handleMicUp}
            onPointerLeave={() => recorder.isRecording && handleMicUp()}
            aria-label="Record voice message"
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg ${
              recorder.isRecording ? 'bg-red-500 text-white' : 'text-[var(--text-muted)]'
            }`}
          >
            🎤
          </button>
        )}
      </div>

      {showEmoji && (
        <Suspense fallback={null}>
          <div className="max-h-72 overflow-hidden">
            <EmojiPicker
              onEmojiClick={(emojiData) => {
                setText((t) => t + emojiData.emoji);
                setShowEmoji(false);
              }}
              width="100%"
            />
          </div>
        </Suspense>
      )}
    </div>
  );
}
