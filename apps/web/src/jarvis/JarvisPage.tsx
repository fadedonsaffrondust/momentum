import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ConversationList } from './ConversationList';
import { EmptyState } from './EmptyState';
import {
  useCreateJarvisConversation,
  useJarvisConversation,
  useJarvisConversations,
} from './api/conversations';

/**
 * Full-page Jarvis surface at /jarvis (and /jarvis/:conversationId).
 * The URL owns selection — clicking a row or creating a new conversation
 * navigates; the page reads `useParams` to render the active thread.
 *
 * Task 7 ships the scaffold (left rail + empty state + new-conversation
 * wiring). Task 8 replaces the main-area placeholder with the real
 * composer + message list + tool-call pills, and also wires the
 * initial-message auto-send flow for the EmptyState prompt cards.
 */
export function JarvisPage() {
  const params = useParams<{ conversationId?: string }>();
  const activeId = params.conversationId ?? null;
  const navigate = useNavigate();
  const [searchValue, setSearchValue] = useState('');

  const listQ = useJarvisConversations();
  const detailQ = useJarvisConversation(activeId ?? undefined);
  const createConversation = useCreateJarvisConversation();

  const conversations = useMemo(() => listQ.data ?? [], [listQ.data]);

  const handleNewConversation = () => {
    createConversation.mutate(
      {},
      {
        onSuccess: (res) => {
          navigate(`/jarvis/${res.conversationId}`);
        },
      },
    );
  };

  const handlePromptClick = (prompt: string) => {
    // Task 8 extends the onSuccess handler to auto-post this prompt as
    // the first message so the assistant streams a reply immediately.
    createConversation.mutate(
      { initialMessage: prompt },
      {
        onSuccess: (res) => {
          navigate(`/jarvis/${res.conversationId}`);
        },
      },
    );
  };

  const handleSelect = (_id: string) => {
    // Navigation is handled by ConversationList itself; this hook lets
    // future work (e.g. collapsing the pane on mobile, marking-seen
    // behaviour, or telemetry) live at the page level without
    // rewriting the list.
  };

  return (
    <div className="flex h-full">
      <ConversationList
        conversations={conversations}
        activeConversationId={activeId}
        isLoading={listQ.isLoading}
        onNewConversation={handleNewConversation}
        onSelect={handleSelect}
        searchValue={searchValue}
        onSearchChange={setSearchValue}
      />

      <main className="flex flex-1 flex-col overflow-hidden">
        {activeId ? (
          <ActiveConversationPlaceholder
            conversationTitle={detailQ.data?.conversation.title ?? null}
            isLoading={detailQ.isLoading}
          />
        ) : (
          <EmptyState onPromptClick={handlePromptClick} isCreating={createConversation.isPending} />
        )}
      </main>
    </div>
  );
}

/**
 * Minimal stand-in for the real conversation view — composer + message
 * list land in Task 8. Kept intentionally empty except for the title so
 * the /jarvis/:id route resolves end-to-end in V1 scaffolding.
 */
function ActiveConversationPlaceholder({
  conversationTitle,
  isLoading,
}: {
  conversationTitle: string | null;
  isLoading: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {conversationTitle ? `Conversation: ${conversationTitle}` : 'Conversation'}
          </p>
          <p className="max-w-md text-xs text-muted-foreground">
            The composer and streaming message view arrive in the next task. For now, the URL is
            owned and the conversation exists.
          </p>
        </>
      )}
    </div>
  );
}
