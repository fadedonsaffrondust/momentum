import { useState } from 'react';
import {
  useCreateRole,
  useDeleteRole,
  useRoles,
  useSettings,
  useUpdateSettings,
} from '../api/hooks';
import { ROLE_COLOR_PALETTE } from '@momentum/shared';

export function FirstRunWizard() {
  const settingsQ = useSettings();
  const rolesQ = useRoles();
  const updateSettings = useUpdateSettings();
  const createRole = useCreateRole();
  const deleteRole = useDeleteRole();

  const [step, setStep] = useState(0);
  const [userName, setUserName] = useState(settingsQ.data?.userName ?? '');
  const [capacity, setCapacity] = useState(
    Math.round((settingsQ.data?.dailyCapacityMinutes ?? 480) / 60),
  );
  const [roleDraft, setRoleDraft] = useState('');

  if (settingsQ.isLoading) return <WizardShell>Loading…</WizardShell>;

  const roles = rolesQ.data ?? [];

  const saveNameAndNext = async () => {
    await updateSettings.mutateAsync({ userName });
    setStep(1);
  };

  const addRole = async () => {
    const name = roleDraft.trim();
    if (!name) return;
    await createRole.mutateAsync({ name });
    setRoleDraft('');
  };

  const saveCapacity = async () => {
    await updateSettings.mutateAsync({
      dailyCapacityMinutes: capacity * 60,
      onboarded: true,
    });
  };

  return (
    <WizardShell>
      <div className="w-full max-w-md space-y-6">
        <header>
          <h1 className="text-2xl font-semibold text-accent">Welcome to Momentum</h1>
          <p className="text-sm text-zinc-400 mt-1">Step {step + 1} of 3</p>
        </header>

        {step === 0 && (
          <section className="space-y-4">
            <label className="block text-sm">
              <span className="text-zinc-400">What should I call you?</span>
              <input
                type="text"
                autoFocus
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="mt-1 w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-md focus:outline-none focus:border-accent"
              />
            </label>
            <button
              onClick={saveNameAndNext}
              disabled={!userName.trim() || updateSettings.isPending}
              className="w-full py-2 rounded-md bg-accent hover:bg-accent-hover transition disabled:opacity-50"
            >
              Continue
            </button>
          </section>
        )}

        {step === 1 && (
          <section className="space-y-4">
            <div>
              <p className="text-sm text-zinc-400">
                What hats do you wear? Add 2–5 roles. You can edit these later.
              </p>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void addRole();
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={roleDraft}
                placeholder="e.g. Product"
                onChange={(e) => setRoleDraft(e.target.value)}
                className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-md focus:outline-none focus:border-accent"
              />
              <button
                type="submit"
                disabled={!roleDraft.trim() || createRole.isPending}
                className="px-3 py-2 rounded-md bg-zinc-800 hover:bg-zinc-700 transition disabled:opacity-50"
              >
                Add
              </button>
            </form>

            <ul className="flex flex-wrap gap-2">
              {roles.map((r) => (
                <li
                  key={r.id}
                  className="group flex items-center gap-1 pl-3 pr-1 py-1 rounded-full text-sm"
                  style={{ backgroundColor: r.color + '33', color: r.color }}
                >
                  <span>{r.name}</span>
                  <button
                    type="button"
                    onClick={() => deleteRole.mutate(r.id)}
                    aria-label={`Remove ${r.name}`}
                    className="ml-1 w-5 h-5 inline-flex items-center justify-center rounded-full text-xs opacity-60 hover:opacity-100 hover:bg-black/30"
                  >
                    ✕
                  </button>
                </li>
              ))}
              {roles.length === 0 && (
                <li className="text-xs text-zinc-500">No roles yet.</li>
              )}
            </ul>

            <div className="flex gap-2">
              <button
                onClick={() => setStep(0)}
                className="flex-1 py-2 rounded-md border border-zinc-800 hover:bg-zinc-900 transition"
              >
                Back
              </button>
              <button
                onClick={() => setStep(2)}
                disabled={roles.length < 2}
                className="flex-1 py-2 rounded-md bg-accent hover:bg-accent-hover transition disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="space-y-4">
            <div>
              <label className="block text-sm">
                <span className="text-zinc-400">How many focused hours per day?</span>
                <input
                  type="range"
                  min={1}
                  max={12}
                  step={1}
                  value={capacity}
                  onChange={(e) => setCapacity(Number(e.target.value))}
                  className="mt-3 w-full accent-[#4F8EF7]"
                />
                <div className="text-center text-3xl font-semibold text-accent mt-2">
                  {capacity}h
                </div>
              </label>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setStep(1)}
                className="flex-1 py-2 rounded-md border border-zinc-800 hover:bg-zinc-900 transition"
              >
                Back
              </button>
              <button
                onClick={saveCapacity}
                disabled={updateSettings.isPending}
                className="flex-1 py-2 rounded-md bg-accent hover:bg-accent-hover transition disabled:opacity-50"
              >
                Start
              </button>
            </div>
          </section>
        )}

        <div className="flex gap-1 pt-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-accent' : 'bg-zinc-800'}`}
            />
          ))}
        </div>
      </div>
    </WizardShell>
  );
}

function WizardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100 font-mono p-6">
      {children}
    </div>
  );
}
