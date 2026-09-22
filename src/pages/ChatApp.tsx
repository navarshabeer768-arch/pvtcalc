import { useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { bootstrapConversation, type ConversationBootstrap } from '../services/conversationService';
import { getSettings, type UserSettings } from '../services/settingsService';
import { startPresenceHeartbeat } from '../services/presenceService';
import { flushOutbox } from '../services/outboxService';
import { ChatContext } from '../app/ChatContext';
import { ChatPage } from './ChatPage';
import { SettingsPage } from './SettingsPage';
import { SearchPage } from './SearchPage';
import { PinnedPage } from './PinnedPage';
import { FavoritesPage } from './FavoritesPage';
import { CouplePage } from './CouplePage';
import { MemoriesPage } from './MemoriesPage';
import { DatesPage } from './DatesPage';
import { DiagnosticsPage } from './DiagnosticsPage';

export type ChatView =
  | 'chat'
  | 'search'
  | 'pinned'
  | 'favorites'
  | 'couple'
  | 'memories'
  | 'dates'
  | 'settings'
  | 'diagnostics';

interface ChatAppProps {
  onLock: () => void;
  onAutoLockSecondsChange: (seconds: number) => void;
}

function OfflineBanner() {
  const [online, setOnline] = useState(navigator.onLine);
  const [justChanged, setJustChanged] = useState(false);

  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      setJustChanged(true);
      void flushOutbox();
      setTimeout(() => setJustChanged(false), 3000);
    };
    const goOffline = () => {
      setOnline(false);
      setJustChanged(true);
    };
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  if (online && !justChanged) return null;
  return (
    <div
      className={`px-3 py-1 text-center text-xs font-medium text-white ${online ? 'bg-emerald-600' : 'bg-neutral-700'}`}
    >
      {online ? 'Back online' : "You're offline"}
    </div>
  );
}

function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex h-dvh w-full max-w-[520px] flex-col bg-[var(--bg)] text-[var(--text)]">
      <OfflineBanner />
      {children}
    </div>
  );
}

export function ChatApp({ onLock, onAutoLockSecondsChange }: ChatAppProps) {
  const [bootstrap, setBootstrap] = useState<ConversationBootstrap | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [view, setView] = useState<ChatView>('chat');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user.id;
      if (!userId) {
        setError('Session expired.');
        return;
      }
      try {
        const [conv, userSettings] = await Promise.all([bootstrapConversation(userId), getSettings(userId)]);
        if (cancelled) return;
        setBootstrap(conv);
        setSettings(userSettings);
        onAutoLockSecondsChange(userSettings.auto_lock_seconds);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load your conversation.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [onAutoLockSecondsChange]);

  useEffect(() => {
    if (!bootstrap || !settings?.show_online) return;
    return startPresenceHeartbeat(bootstrap.me.id);
  }, [bootstrap, settings?.show_online]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings?.theme ?? 'default');
    document.documentElement.dataset.fontSize = settings?.font_size ?? 'default';
  }, [settings?.theme, settings?.font_size]);

  const refreshSettings = async () => {
    if (!bootstrap) return;
    const next = await getSettings(bootstrap.me.id);
    setSettings(next);
    onAutoLockSecondsChange(next.auto_lock_seconds);
  };

  if (error) {
    return (
      <AppShell>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-[var(--text-muted)]">{error}</p>
          <button onClick={onLock} className="rounded-lg bg-[var(--accent)] px-4 py-2 text-white">
            Back
          </button>
        </div>
      </AppShell>
    );
  }

  if (!bootstrap || !settings) {
    return (
      <AppShell>
        <div className="flex flex-1 items-center justify-center text-[var(--text-muted)]">Loading…</div>
      </AppShell>
    );
  }

  return (
    <ChatContext.Provider value={{ ...bootstrap, settings, refreshSettings }}>
      <AppShell>
        {view === 'chat' && <ChatPage onLock={onLock} onNavigate={setView} />}
        {view === 'search' && <SearchPage onBack={() => setView('chat')} />}
        {view === 'pinned' && <PinnedPage onBack={() => setView('chat')} />}
        {view === 'favorites' && <FavoritesPage onBack={() => setView('chat')} />}
        {view === 'couple' && <CouplePage onBack={() => setView('chat')} />}
        {view === 'memories' && <MemoriesPage onBack={() => setView('chat')} />}
        {view === 'dates' && <DatesPage onBack={() => setView('chat')} />}
        {view === 'settings' && (
          <SettingsPage onBack={() => setView('chat')} onLock={onLock} onOpenDiagnostics={() => setView('diagnostics')} />
        )}
        {view === 'diagnostics' && <DiagnosticsPage onBack={() => setView('settings')} />}
      </AppShell>
    </ChatContext.Provider>
  );
}
