import { useEffect, useState } from 'react';
import { useChatContext } from '../app/ChatContext';
import { updateSettings } from '../services/settingsService';
import { changeUnlockCode, signOut } from '../services/unlockService';
import { updateProfile } from '../services/profileService';
import { clearCachedMedia, clearCachedMessages } from '../lib/idbCache';
import type { FontSize, Theme } from '../types/database';

interface SettingsPageProps {
  onBack: () => void;
  onLock: () => void;
  onOpenDiagnostics: () => void;
}

export function SettingsPage({ onBack, onLock, onOpenDiagnostics }: SettingsPageProps) {
  const { me, settings, refreshSettings } = useChatContext();
  const [storageEstimate, setStorageEstimate] = useState<{ usage: number; quota: number } | null>(null);
  const [versionTaps, setVersionTaps] = useState(0);
  const [showDiagnosticsHint, setShowDiagnosticsHint] = useState(false);
  const [changingCode, setChangingCode] = useState(false);
  const [currentCode, setCurrentCode] = useState('');
  const [newCode, setNewCode] = useState('');
  const [codeMessage, setCodeMessage] = useState<string | null>(null);

  useEffect(() => {
    if ('storage' in navigator && navigator.storage.estimate) {
      void navigator.storage.estimate().then((est) => setStorageEstimate({ usage: est.usage ?? 0, quota: est.quota ?? 0 }));
    }
  }, []);

  const diagnosticsEnabled = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DIAGNOSTICS === 'true';

  const set = (patch: Parameters<typeof updateSettings>[1]) => void updateSettings(me.id, patch).then(refreshSettings);

  const handleChangeCode = async () => {
    setCodeMessage(null);
    const result = await changeUnlockCode(currentCode, newCode);
    setCodeMessage(result.success ? 'Unlock code updated.' : result.message ?? 'Could not update the code.');
    if (result.success) {
      setCurrentCode('');
      setNewCode('');
    }
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <header className="flex items-center gap-2 border-b border-black/5 px-3 py-2">
        <button onClick={onBack} className="text-xl">
          ←
        </button>
        <h1 className="text-base font-semibold">Settings</h1>
      </header>

      <section className="p-4">
        <h2 className="mb-2 text-xs font-semibold uppercase text-[var(--text-muted)]">Account</h2>
        <div className="rounded-xl bg-[var(--surface)] p-3">
          <div className="font-medium">{me.name}</div>
          <div className="text-sm text-[var(--text-muted)]">{me.email}</div>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span>Pronoun</span>
            <select
              value={me.pronoun_label}
              onChange={(e) => void updateProfile(me.id, { pronoun_label: e.target.value as 'She' | 'He' })}
              className="rounded bg-black/5 px-2 py-1"
            >
              <option value="She">She</option>
              <option value="He">He</option>
            </select>
          </div>
          <button
            onClick={() => void signOut().then(onLock)}
            className="mt-3 text-sm text-red-500"
          >
            Log out
          </button>
        </div>
      </section>

      <section className="p-4 pt-0">
        <h2 className="mb-2 text-xs font-semibold uppercase text-[var(--text-muted)]">Chat</h2>
        <div className="flex flex-col gap-2 rounded-xl bg-[var(--surface)] p-3">
          <label className="flex items-center justify-between text-sm">
            Theme
            <select
              value={settings.theme}
              onChange={(e) => set({ theme: e.target.value as Theme })}
              className="rounded bg-black/5 px-2 py-1"
            >
              <option value="default">Default</option>
              <option value="pink">Pink</option>
              <option value="purple">Purple</option>
              <option value="midnight">Midnight</option>
              <option value="custom">Custom</option>
            </select>
          </label>
          <label className="flex items-center justify-between text-sm">
            Font size
            <select
              value={settings.font_size}
              onChange={(e) => set({ font_size: e.target.value as FontSize })}
              className="rounded bg-black/5 px-2 py-1"
            >
              <option value="small">Small</option>
              <option value="default">Default</option>
              <option value="large">Large</option>
            </select>
          </label>
        </div>
      </section>

      <section className="p-4 pt-0">
        <h2 className="mb-2 text-xs font-semibold uppercase text-[var(--text-muted)]">Privacy</h2>
        <div className="flex flex-col gap-2 rounded-xl bg-[var(--surface)] p-3">
          <label className="flex items-center justify-between text-sm">
            Show online status
            <input
              type="checkbox"
              checked={settings.show_online}
              onChange={(e) => set({ show_online: e.target.checked })}
            />
          </label>
          <label className="flex items-center justify-between text-sm">
            Read receipts
            <input
              type="checkbox"
              checked={settings.send_read_receipts}
              onChange={(e) => set({ send_read_receipts: e.target.checked })}
            />
          </label>
          <label className="flex items-center justify-between text-sm">
            Auto-lock after
            <select
              value={settings.auto_lock_seconds}
              onChange={(e) => set({ auto_lock_seconds: Number(e.target.value) })}
              className="rounded bg-black/5 px-2 py-1"
            >
              <option value={60}>1 minute</option>
              <option value={120}>2 minutes</option>
              <option value={300}>5 minutes</option>
              <option value={600}>10 minutes</option>
            </select>
          </label>

          <button
            onClick={() => setChangingCode((v) => !v)}
            className="mt-1 text-left text-sm text-[var(--accent)]"
          >
            Change unlock code
          </button>
          {changingCode && (
            <div className="flex flex-col gap-2">
              <input
                type="password"
                inputMode="numeric"
                placeholder="Current code"
                value={currentCode}
                onChange={(e) => setCurrentCode(e.target.value)}
                className="rounded-lg bg-black/5 px-3 py-2 outline-none"
              />
              <input
                type="password"
                inputMode="numeric"
                placeholder="New code (4-8 digits)"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                className="rounded-lg bg-black/5 px-3 py-2 outline-none"
              />
              {codeMessage && <div className="text-xs text-[var(--text-muted)]">{codeMessage}</div>}
              <button onClick={() => void handleChangeCode()} className="rounded-lg bg-[var(--accent)] py-2 text-white">
                Update code
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="p-4 pt-0">
        <h2 className="mb-2 text-xs font-semibold uppercase text-[var(--text-muted)]">Storage</h2>
        <div className="flex flex-col gap-2 rounded-xl bg-[var(--surface)] p-3 text-sm">
          {storageEstimate && (
            <div className="text-[var(--text-muted)]">
              {(storageEstimate.usage / 1024 / 1024).toFixed(1)} MB used of{' '}
              {(storageEstimate.quota / 1024 / 1024).toFixed(0)} MB
            </div>
          )}
          <button onClick={() => void clearCachedMedia()} className="text-left text-[var(--accent)]">
            Clear cached media
          </button>
          <button onClick={() => void clearCachedMessages()} className="text-left text-[var(--accent)]">
            Clear local message cache
          </button>
        </div>
      </section>

      <section className="p-4 pt-0 pb-10">
        <h2 className="mb-2 text-xs font-semibold uppercase text-[var(--text-muted)]">App</h2>
        <div className="rounded-xl bg-[var(--surface)] p-3 text-sm">
          <button
            onClick={() => {
              const next = versionTaps + 1;
              setVersionTaps(next);
              if (next >= 7 && diagnosticsEnabled) setShowDiagnosticsHint(true);
            }}
            className="text-[var(--text-muted)]"
          >
            Version 0.1.0
          </button>
          {showDiagnosticsHint && (
            <button onClick={onOpenDiagnostics} className="mt-2 block text-xs text-[var(--accent)]">
              Open diagnostics
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
