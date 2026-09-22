import { useState, type FormEvent } from 'react';
import { signInWithPassword } from '../services/unlockService';

interface SignInScreenProps {
  onSignedIn: () => void;
  onCancel: () => void;
}

export function SignInScreen({ onSignedIn, onCancel }: SignInScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await signInWithPassword(email, password);
    setLoading(false);
    if (result.success) onSignedIn();
    else setError(result.message ?? 'Could not sign in.');
  };

  return (
    <div className="flex h-dvh w-full flex-col justify-center bg-[#1c1c1e] px-6 text-white">
      <h1 className="mb-1 text-xl font-semibold">Sign in to restore your data</h1>
      <p className="mb-6 text-sm text-white/50">Your settings and sync data will be restored on this device.</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg bg-white/10 px-4 py-3 text-base outline-none placeholder:text-white/40"
          autoComplete="username"
        />
        <input
          type="password"
          required
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg bg-white/10 px-4 py-3 text-base outline-none placeholder:text-white/40"
          autoComplete="current-password"
        />
        {error && <div className="text-sm text-red-400">{error}</div>}
        <button
          type="submit"
          disabled={loading}
          className="mt-2 rounded-lg bg-[#ff9f0a] py-3 text-base font-medium text-white disabled:opacity-50"
        >
          {loading ? 'Signing in…' : 'Continue'}
        </button>
        <button type="button" onClick={onCancel} className="py-2 text-sm text-white/50">
          Cancel
        </button>
      </form>
    </div>
  );
}
