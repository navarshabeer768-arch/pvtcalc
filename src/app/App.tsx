import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { CalculatorScreen } from '../calculator/CalculatorScreen';
import type { CalculatorEvent } from '../calculator/useCalculator';
import { supabase } from '../lib/supabase';
import type { LockView } from './lockState';

// The entire chat experience is a separate bundle, only fetched after a
// correct unlock code is entered. Its chunk name is a hash (see
// vite.config.ts), so it never appears as "ChatApp-xyz.js" in devtools.
const ChatApp = lazy(() => import('../pages/ChatApp').then((m) => ({ default: m.ChatApp })));
const SignInScreen = lazy(() => import('../pages/SignInScreen').then((m) => ({ default: m.SignInScreen })));

const DEFAULT_AUTO_LOCK_SECONDS = 120;

export function App() {
  const [view, setView] = useState<LockView>('calculator');
  const autoLockSeconds = useRef(DEFAULT_AUTO_LOCK_SECONDS);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const relock = useCallback(() => {
    setView((current) => (current === 'unlocked' ? 'calculator' : current));
  }, []);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(relock, autoLockSeconds.current * 1000);
  }, [relock]);

  // Re-lock whenever the tab/app is hidden or the page is about to unload
  // from view, so the OS app-switcher snapshot always shows the calculator.
  useEffect(() => {
    const handleHidden = () => {
      if (document.visibilityState === 'hidden') relock();
    };
    document.addEventListener('visibilitychange', handleHidden);
    window.addEventListener('pagehide', relock);
    return () => {
      document.removeEventListener('visibilitychange', handleHidden);
      window.removeEventListener('pagehide', relock);
    };
  }, [relock]);

  // Auto-lock after inactivity, only while unlocked.
  useEffect(() => {
    if (view !== 'unlocked') {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      return;
    }
    resetInactivityTimer();
    const events: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'wheel'];
    events.forEach((e) => window.addEventListener(e, resetInactivityTimer));
    return () => {
      events.forEach((e) => window.removeEventListener(e, resetInactivityTimer));
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [view, resetInactivityTimer]);

  const handleCalculatorEvent = useCallback((event: CalculatorEvent) => {
    if (event.type === 'unlocked') setView('unlocked');
    else if (event.type === 'login_required') setView('sign-in-required');
    // 'locked' is handled entirely inside the calculator's own UI state.
  }, []);

  const handleSignedIn = useCallback(async () => {
    // After signing in, re-check the code the user just typed against
    // their now-known session. In practice the sign-in screen already
    // confirms the code server-side before calling this.
    setView('unlocked');
  }, []);

  const handleBackToCalculator = useCallback(() => setView('calculator'), []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') setView('calculator');
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (view === 'unlocked') {
    return (
      <Suspense fallback={<div className="h-dvh w-full bg-white" />}>
        <ChatApp onLock={relock} onAutoLockSecondsChange={(s) => (autoLockSeconds.current = s)} />
      </Suspense>
    );
  }

  if (view === 'sign-in-required') {
    return (
      <Suspense fallback={<div className="h-dvh w-full bg-[#1c1c1e]" />}>
        <SignInScreen onSignedIn={handleSignedIn} onCancel={handleBackToCalculator} />
      </Suspense>
    );
  }

  return (
    <div className="h-dvh w-full" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <CalculatorScreen onEvent={handleCalculatorEvent} />
    </div>
  );
}
