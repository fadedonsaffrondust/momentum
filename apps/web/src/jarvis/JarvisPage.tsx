import { useCallback, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ConversationList } from './ConversationList';
import { ConversationView } from './ConversationView';
import { EmptyState } from './EmptyState';
import { useJarvisKeyboardController } from './hooks/useJarvisKeyboardController';
import { useCreateJarvisConversation, useJarvisConversations } from './api/conversations';

/**
 * Full-page Jarvis surface at /jarvis (and /jarvis/:conversationId).
 * URL owns selection — ConversationList navigates on click, the page
 * reads `useParams` to render the active thread.
 *
 * When the empty-state prompt cards create a new conversation, the seed
 * prompt is forwarded via `location.state.initialMessage` so
 * ConversationView can auto-post it. This keeps the prompt alive across
 * the `navigate()` hop without stashing it in a global store.
 */
export function JarvisPage() {
  const params = useParams<{ conversationId?: string }>();
  const activeId = params.conversationId ?? null;
  const navigate = useNavigate();
  const location = useLocation();
  const [searchValue, setSearchValue] = useState('');

  const listQ = useJarvisConversations();
  const createConversation = useCreateJarvisConversation();

  const conversations = useMemo(() => listQ.data ?? [], [listQ.data]);

  const handleNewConversation = useCallback(() => {
    createConversation.mutate(
      {},
      {
        onSuccess: (res) => {
          navigate(`/jarvis/${res.conversationId}`);
        },
      },
    );
  }, [createConversation, navigate]);

  useJarvisKeyboardController({ onNewConversation: handleNewConversation });

  const handlePromptClick = (prompt: string) => {
    createConversation.mutate(
      { initialMessage: prompt },
      {
        onSuccess: (res) => {
          navigate(`/jarvis/${res.conversationId}`, {
            state: { initialMessage: prompt },
          });
        },
      },
    );
  };

  const initialMessage = readInitialMessage(location.state);

  return (
    <div className="flex h-full">
      <ConversationList
        conversations={conversations}
        activeConversationId={activeId}
        isLoading={listQ.isLoading}
        onNewConversation={handleNewConversation}
        onSelect={() => {}}
        searchValue={searchValue}
        onSearchChange={setSearchValue}
      />

      <main className="flex flex-1 flex-col overflow-hidden">
        {activeId ? (
          <ConversationView
            // keyed on conversationId so switching threads resets all
            // local state (reducer, abort controller, composer value).
            key={activeId}
            conversationId={activeId}
            initialMessage={initialMessage}
          />
        ) : (
          <EmptyState onPromptClick={handlePromptClick} isCreating={createConversation.isPending} />
        )}
      </main>
    </div>
  );
}

function readInitialMessage(state: unknown): string | null {
  if (typeof state !== 'object' || state === null) return null;
  const value = (state as { initialMessage?: unknown }).initialMessage;
  return typeof value === 'string' ? value : null;
}
