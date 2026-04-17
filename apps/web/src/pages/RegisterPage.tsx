import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useRegister } from '../api/hooks';
import { useAuthStore } from '../store/auth';
import { PasswordInput } from '../components/PasswordInput';

export function RegisterPage() {
  const token = useAuthStore((s) => s.token);
  const register = useRegister();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userName, setUserName] = useState('');

  if (token) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-m-bg text-m-fg font-mono">
      <form
        className="w-full max-w-sm space-y-5 p-6 border border-m-border rounded-xl bg-m-surface-50 shadow-xl"
        onSubmit={(e) => {
          e.preventDefault();
          register.mutate({ email, password, userName });
        }}
      >
        <div>
          <h1 className="text-2xl font-semibold text-accent">Momentum</h1>
          <p className="text-sm text-m-fg-tertiary mt-1">Build your daily execution engine.</p>
        </div>

        <label className="block text-sm">
          <span className="text-m-fg-tertiary">What should I call you?</span>
          <input
            type="text"
            autoFocus
            required
            minLength={1}
            maxLength={64}
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            className="mt-1 w-full px-3 py-2 bg-m-bg border border-m-border rounded-md focus:outline-none focus:border-accent"
          />
        </label>

        <label className="block text-sm">
          <span className="text-m-fg-tertiary">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full px-3 py-2 bg-m-bg border border-m-border rounded-md focus:outline-none focus:border-accent"
          />
        </label>

        <label className="block text-sm">
          <span className="text-m-fg-tertiary">Password</span>
          <PasswordInput
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <span className="text-xs text-m-fg-muted block mt-1">Minimum 8 characters.</span>
        </label>

        {register.isError && (
          <p className="text-sm text-red-400">
            {register.error instanceof Error ? register.error.message : 'Registration failed'}
          </p>
        )}

        <button
          type="submit"
          disabled={register.isPending}
          className="w-full py-2 rounded-md bg-accent hover:bg-accent-hover transition disabled:opacity-50"
        >
          {register.isPending ? 'Creating…' : 'Create account'}
        </button>

        <p className="text-center text-sm text-m-fg-muted">
          Already have one?{' '}
          <Link to="/login" className="text-accent hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
