import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { listOutbox } from '../lib/idbCache';

interface DiagnosticsPageProps {
  onBack: () => void;
}

interface DiagnosticsState {
  supabaseConnected: boolean | null;
  realtimeStatus: string;
  storageAccessible: boolean | null;
  userId: string | null;
  displayMode: string;
  serviceWorkerActive: boolean;
  online: boolean;
  latencyMs: number | null;
  outboxPending: number;
}

export function DiagnosticsPage({ onBack }: DiagnosticsPageProps) {
  const [state, setState] = useState<DiagnosticsState>({
    supabaseConnected: null,
    realtimeStatus: 'unknown',
    storageAccessible: null,
    userId: null,
    displayMode: 'browser',
    serviceWorkerActive: false,
    online: navigator.onLine,
    latencyMs: null,
    outboxPending: 0,
  });

  useEffect(() => {
    (async () => {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user.id ?? null;

      const start = performance.now();
      const { error } = await supabase.from('profiles').select('id').limit(1);
      const latencyMs = performance.now() - start;

      const { data: bucketList, error: storageError } = await supabase.storage.listBuckets();

      const displayMode = window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser';
      const swActive = 'serviceWorker' in navigator && !!navigator.serviceWorker.controller;
      const outbox = await listOutbox();

      setState({
        supabaseConnected: !error,
        realtimeStatus: supabase.realtime.isConnected() ? 'connected' : 'disconnected',
        storageAccessible: !storageError && !!bucketList,
        userId,
        displayMode,
        serviceWorkerActive: swActive,
        online: navigator.onLine,
        latencyMs: Math.round(latencyMs),
        outboxPending: outbox.length,
      });
    })();
  }, []);

  const rows: Array<[string, string]> = [
    ['Supabase connection', state.supabaseConnected === null ? '…' : state.supabaseConnected ? 'OK' : 'Failed'],
    ['Realtime status', state.realtimeStatus],
    ['Storage access', state.storageAccessible === null ? '…' : state.storageAccessible ? 'OK' : 'Failed'],
    ['Current user', state.userId ?? 'None'],
    ['Display mode', state.displayMode],
    ['Service worker', state.serviceWorkerActive ? 'Active' : 'Inactive'],
    ['Network', state.online ? 'Online' : 'Offline'],
    ['DB round-trip latency', state.latencyMs !== null ? `${state.latencyMs} ms` : '…'],
    ['Outbox pending', String(state.outboxPending)],
  ];

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b border-black/5 px-3 py-2">
        <button onClick={onBack} className="text-xl">
          ←
        </button>
        <h1 className="text-base font-semibold">Diagnostics</h1>
      </header>
      <div className="flex-1 overflow-y-auto p-4">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between border-b border-black/5 py-2 text-sm">
            <span className="text-[var(--text-muted)]">{label}</span>
            <span className="font-mono">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
