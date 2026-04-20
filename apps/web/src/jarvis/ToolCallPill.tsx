import { useState } from 'react';
import { ChevronRight, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ToolCallPillProps {
  toolName: string;
  status: 'pending' | 'success' | 'error';
  /** Arguments the LLM passed to the tool. Rendered on expand. */
  arguments: unknown;
  /** Successful tool result. Rendered on expand when status='success'. */
  result?: unknown;
  /** Error message when status='error'. */
  error?: string | null;
  latencyMs?: number | null;
}

/**
 * Collapsed status pill shown inline between user and assistant turns.
 * Pending rows animate dots; resolved rows show a checkmark (or × on
 * error). Expand on click to reveal the exact arguments + result —
 * this is the trust affordance ("users see exactly what data was
 * fetched" per spec §8).
 *
 * No vendor branding — we say "Looking up …" not "Calling Claude…" per
 * the guardrails.
 */
export function ToolCallPill(props: ToolCallPillProps) {
  const [expanded, setExpanded] = useState(false);
  const label = humanizeToolName(props.toolName);

  return (
    <div
      className={cn(
        'my-1 rounded border text-xs',
        props.status === 'error'
          ? 'border-destructive/40 bg-destructive/5'
          : 'border-border bg-card/60',
      )}
      data-tool-call-pill="true"
    >
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="group flex w-full items-center gap-2 px-2 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
        aria-expanded={expanded}
        aria-label={`${props.status === 'pending' ? 'Looking up' : 'Looked up'} ${label}`}
      >
        <ChevronRight
          className={cn(
            'h-3 w-3 shrink-0 text-muted-foreground transition-transform duration-150',
            expanded && 'rotate-90',
          )}
          aria-hidden
        />

        <StatusGlyph status={props.status} />

        <span className="flex-1 truncate font-mono text-2xs text-foreground">
          {props.status === 'pending' ? (
            <>
              Looking up <span className="text-muted-foreground">{label}</span>
              <AnimatedDots />
            </>
          ) : (
            <span className="text-muted-foreground">{label}</span>
          )}
        </span>

        {props.latencyMs != null && props.status !== 'pending' ? (
          <span className="font-mono text-2xs text-muted-foreground">{props.latencyMs}ms</span>
        ) : null}
      </button>

      {expanded ? (
        <div className="border-t border-border/60 bg-background/40 p-2 font-mono text-2xs">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt className="text-muted-foreground">arguments</dt>
            <dd>
              <pre className="whitespace-pre-wrap break-words text-foreground">
                {formatJson(props.arguments)}
              </pre>
            </dd>
            {props.status === 'error' ? (
              <>
                <dt className="text-destructive">error</dt>
                <dd className="text-destructive">{props.error ?? 'Unknown error'}</dd>
              </>
            ) : props.status === 'success' ? (
              <>
                <dt className="text-muted-foreground">result</dt>
                <dd>
                  <pre className="whitespace-pre-wrap break-words text-foreground">
                    {formatJson(props.result)}
                  </pre>
                </dd>
              </>
            ) : null}
          </dl>
        </div>
      ) : null}
    </div>
  );
}

function StatusGlyph({ status }: { status: ToolCallPillProps['status'] }) {
  if (status === 'success') {
    return (
      <span
        className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary"
        aria-hidden
      >
        <Check className="h-2.5 w-2.5" strokeWidth={3} />
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span
        className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive"
        aria-hidden
      >
        <X className="h-2.5 w-2.5" strokeWidth={3} />
      </span>
    );
  }
  return (
    <span
      className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-secondary"
      aria-hidden
    >
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
    </span>
  );
}

function AnimatedDots() {
  return (
    <span className="ml-0.5 inline-flex" aria-hidden>
      <span className="animate-pulse [animation-delay:0ms]">.</span>
      <span className="animate-pulse [animation-delay:150ms]">.</span>
      <span className="animate-pulse [animation-delay:300ms]">.</span>
    </span>
  );
}

/** camelCase → space-separated lowercase-ish, readable in the pill. */
export function humanizeToolName(name: string): string {
  return name
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .toLowerCase();
}

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
