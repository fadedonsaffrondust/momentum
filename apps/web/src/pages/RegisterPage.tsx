import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useRegister } from '../api/hooks';
import { useAuthStore } from '../store/auth';
import { PasswordInput } from '../components/PasswordInput';

/**
 * Registration page. Name collection moved to the first-run wizard
 * (Task 14 / spec §9.11) so signup only needs email + password.
 * @omnirev.ai domain is enforced server-side — the inline message
 * under the email field surfaces the 400 when a non-allowlisted
 * address is submitted.
 */
export function RegisterPage() {
  const token = useAuthStore((s) => s.token);
  const register = useRegister();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (token) return <Navigate to="/" replace />;

  const errorMessage =
    register.error instanceof Error ? register.error.message : null;
  const isDomainError = errorMessage?.includes('@omnirev.ai') ?? false;

  return (
    <div className="min-h-screen flex items-center justify-center bg-m-bg text-m-fg font-mono">
      <form
        className="w-full max-w-sm space-y-5 p-6 border border-m-border rounded-xl bg-m-surface-50 shadow-xl"
        onSubmit={(e) => {
          e.preventDefault();
          register.mutate({ email, password });
        }}
      >
        <div>
          <h1 className="text-2xl font-semibold text-accent">Momentum</h1>
          <p className="text-sm text-m-fg-tertiary mt-1">
            Build your daily execution engine.
          </p>
        </div>

        <label className="block text-sm">
          <span className="text-m-fg-tertiary">Email</span>
          <input
            type="email"
            autoFocus
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full px-3 py-2 bg-m-bg border border-m-border rounded-md focus:outline-none focus:border-accent"
          />
          {isDomainError && errorMessage && (
            <span className="mt-1 block text-xs text-red-400">{errorMessage}</span>
          )}
          <span className="mt-1 block text-xs text-m-fg-muted">
            Signup is restricted to Omnirev team members.
          </span>
        </label>

        <label className="block text-sm">
          <span className="text-m-fg-tertiary">Password</span>
          <PasswordInput
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <span className="text-xs text-m-fg-muted block mt-1">
            Minimum 8 characters.
          </span>
        </label>

        {register.isError && !isDomainError && errorMessage && (
          <p className="text-sm text-red-400">{errorMessage}</p>
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
