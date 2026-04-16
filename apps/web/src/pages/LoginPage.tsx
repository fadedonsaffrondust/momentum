import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useLogin } from '../api/hooks';
import { useAuthStore } from '../store/auth';
import { PasswordInput } from '../components/PasswordInput';

export function LoginPage() {
  const token = useAuthStore((s) => s.token);
  const login = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (token) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100 font-mono">
      <form
        className="w-full max-w-sm space-y-5 p-6 border border-zinc-800 rounded-xl bg-zinc-900/50 shadow-xl"
        onSubmit={(e) => {
          e.preventDefault();
          login.mutate({ email, password });
        }}
      >
        <div>
          <h1 className="text-2xl font-semibold text-accent">Momentum</h1>
          <p className="text-sm text-zinc-400 mt-1">Sign in to keep moving.</p>
        </div>

        <label className="block text-sm">
          <span className="text-zinc-400">Email</span>
          <input
            type="email"
            autoFocus
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-md focus:outline-none focus:border-accent"
          />
        </label>

        <label className="block text-sm">
          <span className="text-zinc-400">Password</span>
          <PasswordInput
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {login.isError && (
          <p className="text-sm text-red-400">
            {login.error instanceof Error ? login.error.message : 'Login failed'}
          </p>
        )}

        <button
          type="submit"
          disabled={login.isPending}
          className="w-full py-2 rounded-md bg-accent hover:bg-accent-hover transition disabled:opacity-50"
        >
          {login.isPending ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="text-center text-sm text-zinc-500">
          No account?{' '}
          <Link to="/register" className="text-accent hover:underline">
            Create one
          </Link>
        </p>
      </form>
    </div>
  );
}
