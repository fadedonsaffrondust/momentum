import { useState } from 'react';
import { useMe, useSettings, useUpdateMe, useUpdateSettings } from '../api/hooks';

/**
 * First-run wizard for team space. Two steps only — display name, then
 * daily capacity. The role-picking step from the legacy single-user
 * wizard was dropped: roles are now team-defined (spec §9.11), so a
 * brand-new user inherits whatever roles the team has already set up.
 *
 * Detection: the wizard runs whenever `user_settings.onboarded=false`.
 * For new users that also means `users.display_name===''`; for legacy
 * users (Nader) the migration backfilled `display_name` so they skip
 * this flow entirely.
 */
export function FirstRunWizard() {
  const meQ = useMe();
  const settingsQ = useSettings();
  const updateMe = useUpdateMe();
  const updateSettings = useUpdateSettings();

  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState(meQ.data?.displayName ?? '');
  const [capacity, setCapacity] = useState(
    Math.round((settingsQ.data?.dailyCapacityMinutes ?? 480) / 60),
  );

  if (settingsQ.isLoading || meQ.isLoading) return <WizardShell>Loading…</WizardShell>;

  const saveNameAndNext = async () => {
    const trimmed = displayName.trim();
    if (!trimmed) return;
    await updateMe.mutateAsync({ displayName: trimmed });
    setStep(1);
  };

  const finish = async () => {
    await updateSettings.mutateAsync({
      dailyCapacityMinutes: capacity * 60,
      onboarded: true,
    });
  };

  return (
    <WizardShell>
      <div className="w-full max-w-md space-y-6">
        <header>
          <h1 className="text-2xl font-semibold text-primary">Welcome to Momentum</h1>
          <p className="text-sm text-muted-foreground mt-1">Step {step + 1} of 2</p>
        </header>

        {step === 0 && (
          <section className="space-y-4">
            <label className="block text-sm">
              <span className="text-muted-foreground">What should I call you?</span>
              <input
                type="text"
                autoFocus
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={64}
                className="mt-1 w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:border-primary"
              />
              <span className="mt-1 block text-xs text-muted-foreground">
                Your teammates will see this name on tasks, parkings, and inbox events.
              </span>
            </label>
            {updateMe.isError && (
              <p className="text-sm text-red-400">
                {updateMe.error instanceof Error
                  ? updateMe.error.message
                  : 'Failed to save name'}
              </p>
            )}
            <button
              onClick={saveNameAndNext}
              disabled={!displayName.trim() || updateMe.isPending}
              className="w-full py-2 rounded-md bg-primary hover:bg-primary/90 transition disabled:opacity-50"
            >
              Continue
            </button>
          </section>
        )}

        {step === 1 && (
          <section className="space-y-4">
            <div>
              <label className="block text-sm">
                <span className="text-muted-foreground">
                  How many focused hours per day?
                </span>
                <input
                  type="range"
                  min={1}
                  max={12}
                  step={1}
                  value={capacity}
                  onChange={(e) => setCapacity(Number(e.target.value))}
                  className="mt-3 w-full accent-primary"
                />
                <div className="text-center text-3xl font-semibold text-primary mt-2">
                  {capacity}h
                </div>
                <span className="mt-2 block text-xs text-muted-foreground text-center">
                  You can change this any time in Settings.
                </span>
              </label>
            </div>
            {updateSettings.isError && (
              <p className="text-sm text-red-400">
                {updateSettings.error instanceof Error
                  ? updateSettings.error.message
                  : 'Failed to save capacity'}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setStep(0)}
                className="flex-1 py-2 rounded-md border border-border hover:bg-secondary transition"
              >
                Back
              </button>
              <button
                onClick={finish}
                disabled={updateSettings.isPending}
                className="flex-1 py-2 rounded-md bg-primary hover:bg-primary/90 transition disabled:opacity-50"
              >
                Start
              </button>
            </div>
          </section>
        )}

        <div className="flex gap-1 pt-2">
          {[0, 1].map((i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-primary' : 'bg-border'}`}
            />
          ))}
        </div>
      </div>
    </WizardShell>
  );
}

function WizardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground font-mono p-6">
      {children}
    </div>
  );
}
