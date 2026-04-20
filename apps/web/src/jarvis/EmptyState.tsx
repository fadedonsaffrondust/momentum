import { ArrowRight, Bot } from 'lucide-react';

export interface EmptyStateProps {
  onPromptClick: (prompt: string) => void;
  isCreating?: boolean;
}

/**
 * Center-pane default when no conversation is selected. Four example
 * prompts per spec §8 — clicking one creates a new conversation with
 * that prompt as the seed. In Task 7 this lands on the new
 * conversation's URL; Task 8 wires the auto-send so the assistant
 * immediately starts streaming.
 */
const EXAMPLE_PROMPTS = [
  'What are my tasks for today?',
  'How is Boudin doing?',
  'Which brand needs the most attention?',
  'What did I do this week?',
] as const;

export function EmptyState({ onPromptClick, isCreating = false }: EmptyStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-8">
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-md border border-primary/40 bg-primary/10 text-primary">
          <Bot className="h-6 w-6" aria-hidden />
        </div>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-xl text-foreground">Ask Jarvis anything</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            Questions about your brands, tasks, action items, or the team. Jarvis answers from
            Momentum's live data.
          </p>
        </div>
      </div>

      <ul
        role="list"
        className="grid w-full max-w-2xl grid-cols-1 gap-2 sm:grid-cols-2"
        aria-label="Example prompts"
      >
        {EXAMPLE_PROMPTS.map((prompt) => (
          <li key={prompt}>
            <button
              type="button"
              onClick={() => onPromptClick(prompt)}
              disabled={isCreating}
              className="group flex w-full items-center justify-between gap-3 rounded border border-border bg-card px-3 py-3 text-left text-sm text-foreground transition-colors duration-150 hover:border-primary/40 hover:bg-secondary disabled:cursor-progress disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <span>{prompt}</span>
              <ArrowRight
                className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-foreground"
                aria-hidden
              />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
