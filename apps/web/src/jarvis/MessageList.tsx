import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { JarvisMessage } from '@momentum/shared';
import { cn } from '@/lib/utils';
import { ToolCallPill } from './ToolCallPill';
import type { LiveToolCall, TurnState } from './messageReducer';

/**
 * Renders a conversation. Two inputs:
 *   1. `historical` — persisted messages from the DB.
 *   2. `liveTurn`   — the turn being streamed right now (may include an
 *      optimistic user message, a partial assistantText, and zero or more
 *      in-flight tool_call pills).
 *
 * The historical and live views are stitched together so the user sees a
 * single flowing transcript. Tool-use blocks are resolved to their
 * matching tool_result (by `tool_use_id`) so each pill can show its
 * arguments AND the fetched payload on expand.
 */

export interface MessageListProps {
  historical: JarvisMessage[];
  liveTurn: TurnState;
}

export function MessageList({ historical, liveTurn }: MessageListProps) {
  const items = buildDisplayItems(historical);

  return (
    <div
      className="flex flex-1 flex-col gap-3 overflow-y-auto px-6 py-4"
      data-jarvis-message-list="true"
    >
      {items.map((item, i) => (
        <DisplayRow key={`${item.kind}-${i}-${itemKey(item)}`} item={item} />
      ))}

      {liveTurn.optimisticUserMessage != null ? (
        <UserBubble text={liveTurn.optimisticUserMessage} />
      ) : null}

      {liveTurn.status !== 'idle' ? <LiveAssistantTurn liveTurn={liveTurn} /> : null}
    </div>
  );
}

/* ─────────────── historical stitching ─────────────── */

type DisplayItem =
  | { kind: 'user'; text: string; messageId: string }
  | { kind: 'assistant_text'; text: string; messageId: string }
  | {
      kind: 'tool_call';
      toolUseId: string;
      toolName: string;
      arguments: unknown;
      result: unknown;
      error: string | null;
    };

interface AnyBlock {
  type: string;
  [key: string]: unknown;
}

function itemKey(item: DisplayItem): string {
  if (item.kind === 'tool_call') return item.toolUseId;
  return item.messageId;
}

/**
 * Walk the historical messages, emit display rows, and match tool_use
 * blocks against the tool_result blocks on the next `role='tool'`
 * message. The server enforces the ordering (assistant with tool_use →
 * tool message carrying the results), so we trust the sequence.
 */
function buildDisplayItems(messages: JarvisMessage[]): DisplayItem[] {
  const items: DisplayItem[] = [];

  // Pre-index tool_result blocks by tool_use_id so we can attach them to
  // the corresponding tool_use regardless of which role='tool' message
  // they arrived on.
  const toolResults = new Map<string, { content: unknown; isError: boolean }>();
  for (const m of messages) {
    if (m.role !== 'tool') continue;
    const blocks = asBlocks(m.content);
    for (const block of blocks) {
      if (block.type === 'tool_result' && typeof block.tool_use_id === 'string') {
        toolResults.set(block.tool_use_id, {
          content: parseToolResultContent(block.content),
          isError: block.is_error === true,
        });
      }
    }
  }

  for (const m of messages) {
    if (m.role === 'user') {
      const text = extractText(m.content);
      if (text) items.push({ kind: 'user', text, messageId: m.id });
      continue;
    }
    if (m.role === 'assistant') {
      for (const block of asBlocks(m.content)) {
        if (block.type === 'text' && typeof block.text === 'string') {
          if (block.text.trim()) {
            items.push({ kind: 'assistant_text', text: block.text, messageId: m.id });
          }
          continue;
        }
        if (block.type === 'tool_use' && typeof block.id === 'string') {
          const match = toolResults.get(block.id);
          items.push({
            kind: 'tool_call',
            toolUseId: block.id,
            toolName: typeof block.name === 'string' ? block.name : 'unknown',
            arguments: block.input,
            result: match?.isError ? null : match?.content,
            error: match?.isError ? asErrorString(match.content) : null,
          });
        }
      }
      continue;
    }
    // role === 'tool' → already absorbed into toolResults above.
  }

  return items;
}

function DisplayRow({ item }: { item: DisplayItem }) {
  if (item.kind === 'user') return <UserBubble text={item.text} />;
  if (item.kind === 'assistant_text') return <AssistantText text={item.text} />;
  return (
    <ToolCallPill
      toolName={item.toolName}
      status={item.error ? 'error' : 'success'}
      arguments={item.arguments}
      result={item.result}
      error={item.error}
    />
  );
}

/* ─────────────── live turn ─────────────── */

function LiveAssistantTurn({ liveTurn }: { liveTurn: TurnState }) {
  return (
    <div className="flex flex-col gap-2">
      {liveTurn.toolCalls.map((tc) => (
        <LiveToolPill key={tc.toolCallId} tc={tc} />
      ))}

      {liveTurn.assistantText ? (
        <AssistantText
          text={liveTurn.assistantText}
          blinkCursor={liveTurn.status === 'streaming'}
        />
      ) : liveTurn.status === 'streaming' && liveTurn.toolCalls.length === 0 ? (
        <ThinkingIndicator />
      ) : null}

      {liveTurn.error ? <ErrorRow message={liveTurn.error.message} /> : null}
    </div>
  );
}

function LiveToolPill({ tc }: { tc: LiveToolCall }) {
  return (
    <ToolCallPill
      toolName={tc.toolName}
      status={tc.status}
      arguments={tc.arguments}
      error={tc.error}
      latencyMs={tc.latencyMs}
    />
  );
}

/* ─────────────── presentational pieces ─────────────── */

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground">
        {text}
      </div>
    </div>
  );
}

function AssistantText({ text, blinkCursor }: { text: string; blinkCursor?: boolean }) {
  return (
    <div className="flex">
      <div
        className={cn(
          'max-w-[80%] text-sm text-foreground',
          'prose prose-invert prose-sm max-w-[80ch]',
          // Our markdown renderer doesn't ship its own styles; Tailwind's
          // typography plugin isn't installed, so we lean on a few
          // targeted selectors to keep body text compact.
        )}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            p: ({ children }) => <p className="my-1 leading-relaxed">{children}</p>,
            ul: ({ children }) => <ul className="my-1 list-disc pl-5">{children}</ul>,
            ol: ({ children }) => <ol className="my-1 list-decimal pl-5">{children}</ol>,
            code: ({ children }) => (
              <code className="rounded bg-secondary px-1 py-0.5 font-mono text-2xs">
                {children}
              </code>
            ),
            strong: ({ children }) => (
              <strong className="font-medium text-foreground">{children}</strong>
            ),
          }}
        >
          {text}
        </ReactMarkdown>
        {blinkCursor ? (
          <span
            className="ml-0.5 inline-block h-[1em] w-[1px] animate-pulse bg-primary align-[-0.1em]"
            aria-hidden
          />
        ) : null}
      </div>
    </div>
  );
}

function ThinkingIndicator() {
  return (
    <div className="flex">
      <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground" />
        Thinking…
      </div>
    </div>
  );
}

function ErrorRow({ message }: { message: string }) {
  return (
    <div className="flex">
      <div className="max-w-[80%] rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
        {message}
      </div>
    </div>
  );
}

/* ─────────────── jsonb content helpers ─────────────── */

function asBlocks(content: unknown): AnyBlock[] {
  if (!Array.isArray(content)) return [];
  return content.filter(
    (b): b is AnyBlock =>
      typeof b === 'object' && b !== null && typeof (b as AnyBlock).type === 'string',
  );
}

function extractText(content: unknown): string {
  // A user message might be stored as a raw string (legacy) or as an
  // array of text blocks (our convention). Handle both gracefully.
  if (typeof content === 'string') return content;
  return asBlocks(content)
    .filter((b) => b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text as string)
    .join('\n')
    .trim();
}

/**
 * Tool results come back as `content: string` (we JSON.stringify server-side).
 * Parse to a JS value for the pill's expand view; fall back to the raw
 * string if that fails.
 */
function parseToolResultContent(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function asErrorString(content: unknown): string {
  if (typeof content === 'string') return content;
  try {
    return JSON.stringify(content);
  } catch {
    return String(content);
  }
}
