import { useMemo, useRef, useState, useEffect } from 'react';
import clsx from 'clsx';
import type { BrandActionItem } from '@momentum/shared';
import { Plus } from 'lucide-react';
import { ActionItemRow } from './ActionItemRow';
import {
  useCreateBrandActionItem,
  useUpdateBrandActionItem,
  useDeleteBrandActionItem,
  useCompleteBrandActionItem,
} from '../../api/hooks';
import { useUiStore } from '../../store/ui';

interface Props {
  brandId: string;
  actionItems: BrandActionItem[];
}

export function ActionItemsSection({ brandId, actionItems }: Props) {
  const openItems = useMemo(
    () => actionItems.filter((a) => a.status === 'open').sort((a, b) => (b.meetingDate ?? b.createdAt).localeCompare(a.meetingDate ?? a.createdAt)),
    [actionItems],
  );
  const doneItems = useMemo(
    () => actionItems.filter((a) => a.status === 'done').sort((a, b) => (b.completedAt ?? b.createdAt).localeCompare(a.completedAt ?? a.createdAt)),
    [actionItems],
  );

  const [activeTab, setActiveTab] = useState<'open' | 'done'>('open');
  const [adding, setAdding] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [draftOwner, setDraftOwner] = useState('');
  const [draftDue, setDraftDue] = useState('');
  const addInputRef = useRef<HTMLInputElement>(null);

  const createItem = useCreateBrandActionItem(brandId);
  const updateItem = useUpdateBrandActionItem(brandId);
  const deleteItem = useDeleteBrandActionItem(brandId);
  const completeItem = useCompleteBrandActionItem(brandId);
  const openAssigneePicker = useUiStore((s) => s.openAssigneePicker);

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
    <section>
      <h2 className="text-sm font-semibold text-m-fg-strong mb-3">
        Action Items
        <span className="ml-2 text-xs text-m-fg-muted font-normal">
          {openItems.length} open, {doneItems.length} done
        </span>
      </h2>

      {/* Tabs */}
      <div className="flex items-center gap-4 mb-4 border-b border-m-border-subtle">
        {(['open', 'done'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={clsx(
              'relative pb-2 text-sm transition',
              activeTab === tab ? 'text-m-fg font-medium' : 'text-m-fg-muted hover:text-m-fg-secondary',
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
            <div className="flex gap-2 mb-4">
              <input
                ref={addInputRef}
                type="text"
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitNew();
                  if (e.key === 'Escape') setAdding(false);
                }}
                className="flex-1 bg-m-bg border border-m-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent"
                placeholder="Action item text"
              />
              <input
                type="text"
                value={draftOwner}
                onChange={(e) => setDraftOwner(e.target.value)}
                className="w-28 bg-m-bg border border-m-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent"
                placeholder="Owner"
              />
              <input
                type="date"
                value={draftDue}
                onChange={(e) => setDraftDue(e.target.value)}
                onBlur={submitNew}
                className="w-36 bg-m-bg border border-m-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent"
              />
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-1.5 text-sm text-m-fg-muted hover:text-accent transition mb-4"
            >
              <Plus size={14} /> Add action item
            </button>
          )}
        </>
      )}

      {/* List */}
      {items.length === 0 && (
        <p className="text-sm text-m-fg-muted py-4 text-center">
          {activeTab === 'open' ? 'No open items.' : 'No completed items.'}
        </p>
      )}
      <div className="space-y-1">
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
              openAssigneePicker({
                kind: 'send-to-today',
                brandId,
                itemId: item.id,
                itemText: item.text,
              });
            }}
            onEdit={(text) => updateItem.mutate({ id: item.id, text })}
            onDelete={() => deleteItem.mutate(item.id)}
          />
        ))}
      </div>
    </section>
  );
}
