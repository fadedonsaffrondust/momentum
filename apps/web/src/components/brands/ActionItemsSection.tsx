import { useMemo, useRef, useState, useEffect } from 'react';
import clsx from 'clsx';
import type { BrandActionItem } from '@momentum/shared';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { ActionItemRow } from './ActionItemRow';
import {
  useCreateBrandActionItem,
  useUpdateBrandActionItem,
  useDeleteBrandActionItem,
  useSendActionItemToToday,
  useCompleteBrandActionItem,
} from '../../api/hooks';
import { useUiStore } from '../../store/ui';

interface Props {
  brandId: string;
  actionItems: BrandActionItem[];
}

export function ActionItemsSection({ brandId, actionItems }: Props) {
  const openItems = useMemo(
    () => actionItems.filter((a) => a.status === 'open').sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [actionItems],
  );
  const doneItems = useMemo(
    () => actionItems.filter((a) => a.status === 'done').sort((a, b) => (b.completedAt ?? b.createdAt).localeCompare(a.completedAt ?? a.createdAt)),
    [actionItems],
  );

  const [collapsed, setCollapsed] = useState(true);
  const [activeTab, setActiveTab] = useState<'open' | 'done'>('open');
  const [adding, setAdding] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [draftOwner, setDraftOwner] = useState('');
  const [draftDue, setDraftDue] = useState('');
  const addInputRef = useRef<HTMLInputElement>(null);

  const createItem = useCreateBrandActionItem(brandId);
  const updateItem = useUpdateBrandActionItem(brandId);
  const deleteItem = useDeleteBrandActionItem(brandId);
  const sendToToday = useSendActionItemToToday(brandId);
  const completeItem = useCompleteBrandActionItem(brandId);
  const pushToast = useUiStore((s) => s.pushToast);

  useEffect(() => {
    if (adding) addInputRef.current?.focus();
  }, [adding]);

  const submitNew = () => {
    const text = draftText.trim();
    if (!text) {
      setAdding(false);
      return;
    }
    createItem.mutate(
      {
        text,
        owner: draftOwner.trim() || null,
        dueDate: draftDue || null,
      },
      {
        onSuccess: () => {
          setDraftText('');
          setDraftOwner('');
          setDraftDue('');
          setAdding(false);
        },
      },
    );
  };

  const items = activeTab === 'open' ? openItems : doneItems;

  return (
    <section className="px-6 py-4">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center gap-2 w-full text-left group"
      >
        {collapsed ? (
          <ChevronRight size={14} className="text-zinc-600" />
        ) : (
          <ChevronDown size={14} className="text-zinc-600" />
        )}
        <h2 className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold group-hover:text-zinc-300 transition">
          Action Items
          <span className="ml-1 text-zinc-600">
            ({openItems.length} open, {doneItems.length} done)
          </span>
        </h2>
      </button>

      {!collapsed && (
        <div className="mt-3 animate-slideUp">
          {/* Tabs */}
          <div className="flex items-center gap-4 mb-3 border-b border-zinc-900">
            {(['open', 'done'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={clsx(
                  'relative pb-2 text-xs transition',
                  activeTab === tab ? 'text-zinc-100' : 'text-zinc-500 hover:text-zinc-300',
                )}
              >
                {tab === 'open' ? `Open (${openItems.length})` : `Done (${doneItems.length})`}
                {activeTab === tab && (
                  <span className="absolute left-0 right-0 -bottom-px h-[2px] rounded-full bg-accent" />
                )}
              </button>
            ))}
          </div>

          {/* Inline create */}
          {activeTab === 'open' && (
            <>
              {adding ? (
                <div className="flex gap-2 mb-3">
                  <input
                    ref={addInputRef}
                    type="text"
                    value={draftText}
                    onChange={(e) => setDraftText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') submitNew();
                      if (e.key === 'Escape') setAdding(false);
                    }}
                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-accent"
                    placeholder="Action item text"
                  />
                  <input
                    type="text"
                    value={draftOwner}
                    onChange={(e) => setDraftOwner(e.target.value)}
                    className="w-24 bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-accent"
                    placeholder="Owner"
                  />
                  <input
                    type="date"
                    value={draftDue}
                    onChange={(e) => setDraftDue(e.target.value)}
                    onBlur={submitNew}
                    className="w-32 bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-accent"
                  />
                </div>
              ) : (
                <button
                  onClick={() => setAdding(true)}
                  className="flex items-center gap-1 text-xs text-zinc-500 hover:text-accent transition mb-3"
                >
                  <Plus size={12} /> Add action item
                </button>
              )}
            </>
          )}

          {/* List */}
          {items.length === 0 && (
            <p className="text-xs text-zinc-600 py-4 text-center">
              {activeTab === 'open' ? 'No open items.' : 'No completed items.'}
            </p>
          )}
          <div className="space-y-0.5">
            {items.map((item) => (
              <ActionItemRow
                key={item.id}
                item={item}
                onToggleDone={() => {
                  if (item.status === 'open') {
                    completeItem.mutate(item.id);
                  } else {
                    updateItem.mutate({ id: item.id, status: 'open' });
                  }
                }}
                onSendToToday={() => {
                  sendToToday.mutate(item.id, {
                    onSuccess: (res) => {
                      pushToast({
                        kind: 'success',
                        message: `Sent to Today: "${res.task.title}"`,
                        durationMs: 3000,
                      });
                    },
                  });
                }}
                onEdit={(text) => updateItem.mutate({ id: item.id, text })}
                onDelete={() => deleteItem.mutate(item.id)}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
