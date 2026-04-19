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

  const errorMessage = register.error instanceof Error ? register.error.message : null;
  const isDomainError = errorMessage?.includes('@omnirev.ai') ?? false;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground font-mono">
      <form
        className="w-full max-w-sm space-y-5 p-6 border border-border rounded-xl bg-card/50 shadow-xl"
        onSubmit={(e) => {
          e.preventDefault();
          register.mutate({ email, password });
        }}
      >
        <div>
          <h1 className="text-2xl font-semibold text-primary">Momentum</h1>
          <p className="text-sm text-muted-foreground mt-1">Build your daily execution engine.</p>
        </div>

        <label className="block text-sm">
          <span className="text-muted-foreground">Email</span>
          <input
            type="email"
            autoFocus
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:border-primary"
          />
          {isDomainError && errorMessage && (
            <span className="mt-1 block text-xs text-red-400">{errorMessage}</span>
          )}
          <span className="mt-1 block text-xs text-muted-foreground">
            Signup is restricted to Omnirev team members.
          </span>
        </label>

        <label className="block text-sm">
          <span className="text-muted-foreground">Password</span>
          <PasswordInput
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <span className="text-xs text-muted-foreground block mt-1">Minimum 8 characters.</span>
        </label>

        {register.isError && !isDomainError && errorMessage && (
          <p className="text-sm text-red-400">{errorMessage}</p>
        )}

        <button
          type="submit"
          disabled={register.isPending}
          className="w-full py-2 rounded-md bg-primary hover:bg-primary/90 transition disabled:opacity-50"
        >
          {register.isPending ? 'Creating…' : 'Create account'}
        </button>

        <p className="text-center text-sm text-muted-foreground">
          Already have one?{' '}
          <Link to="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
