import { useEffect, useRef, useState } from 'react';
import type { BrandStakeholder } from '@momentum/shared';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { StakeholderBadge } from '../widgets/StakeholderBadge';
import {
  useCreateBrandStakeholder,
  useDeleteBrandStakeholder,
  useUpdateBrandStakeholder,
} from '../../../api/hooks';

interface Props {
  brandId: string;
  stakeholders: BrandStakeholder[];
  /** Map keyed by lowercased stakeholder.name → ISO date of the most
   * recent meeting where this name appeared in the attendees list. */
  lastMentionByStakeholder: Map<string, string>;
}

/**
 * Inline stakeholder grid with add / edit / delete. Each card flips into
 * a 3-input form (name / role / email) on the pencil icon and commits on
 * Enter, blur of the email field, or another click. Empty-name commit
 * cancels.
 */
export function StakeholderEditor({ brandId, stakeholders, lastMentionByStakeholder }: Props) {
  const createStakeholder = useCreateBrandStakeholder(brandId);
  const updateStakeholder = useUpdateBrandStakeholder(brandId);
  const deleteStakeholder = useDeleteBrandStakeholder(brandId);

  const [adding, setAdding] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftRole, setDraftRole] = useState('');
  const [draftEmail, setDraftEmail] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const addInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding) addInputRef.current?.focus();
  }, [adding]);

  const submitNew = () => {
    const name = draftName.trim();
    if (!name) {
      setAdding(false);
      return;
    }
    createStakeholder.mutate(
      { name, role: draftRole.trim() || null, email: draftEmail.trim() || null },
      {
        onSuccess: () => {
          setDraftName('');
          setDraftRole('');
          setDraftEmail('');
          setAdding(false);
        },
      },
    );
  };

  const startEdit = (s: BrandStakeholder) => {
    setEditingId(s.id);
    setEditName(s.name);
    setEditRole(s.role ?? '');
    setEditEmail(s.email ?? '');
  };

  const commitEdit = (id: string) => {
    const name = editName.trim();
    if (!name) {
      setEditingId(null);
      return;
    }
    updateStakeholder.mutate(
      { id, name, role: editRole.trim() || null, email: editEmail.trim() || null },
      { onSuccess: () => setEditingId(null) },
    );
  };

  if (stakeholders.length === 0 && !adding) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <button
          onClick={() => setAdding(true)}
          className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground hover:text-primary hover:border-primary transition"
        >
          <Plus size={16} />
          Add stakeholder
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {stakeholders.map((s, i) => (
        <div
          key={s.id}
          className="group bg-card rounded-lg p-4 border border-border/60 flex items-start gap-3 relative"
        >
          {editingId === s.id ? (
            <div className="flex-1 flex flex-col gap-2">
              <input
                autoFocus
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitEdit(s.id);
                  if (e.key === 'Escape') setEditingId(null);
                }}
                className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm focus:outline-none focus:border-primary"
                placeholder="Name"
              />
              <input
                type="text"
                value={editRole}
                onChange={(e) => setEditRole(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitEdit(s.id);
                  if (e.key === 'Escape') setEditingId(null);
                }}
                className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm focus:outline-none focus:border-primary"
                placeholder="Role"
              />
              <input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitEdit(s.id);
                  if (e.key === 'Escape') setEditingId(null);
                }}
                onBlur={() => commitEdit(s.id)}
                className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm focus:outline-none focus:border-primary"
                placeholder="Email"
              />
            </div>
          ) : (
            <>
              <StakeholderBadge
                stakeholder={s}
                index={i}
                lastMentionDate={lastMentionByStakeholder.get(s.name.toLowerCase()) ?? null}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-foreground font-medium truncate">{s.name}</div>
                {s.role && <div className="text-xs text-muted-foreground truncate">{s.role}</div>}
                {s.email && <div className="text-xs text-muted-foreground truncate">{s.email}</div>}
              </div>
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                <button
                  onClick={() => startEdit(s)}
                  className="p-1 text-muted-foreground/70 hover:text-foreground rounded"
                  title="Edit"
                >
                  <Pencil size={12} />
                </button>
                <button
                  onClick={() => deleteStakeholder.mutate(s.id)}
                  className="p-1 text-muted-foreground/70 hover:text-red-400 rounded"
                  title="Remove"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </>
          )}
        </div>
      ))}

      {adding ? (
        <div className="bg-card rounded-lg p-4 border border-primary/30 flex flex-col gap-2">
          <input
            ref={addInputRef}
            type="text"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitNew();
              if (e.key === 'Escape') setAdding(false);
            }}
            className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm focus:outline-none focus:border-primary"
            placeholder="Name"
          />
          <input
            type="text"
            value={draftRole}
            onChange={(e) => setDraftRole(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitNew();
              if (e.key === 'Escape') setAdding(false);
            }}
            className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm focus:outline-none focus:border-primary"
            placeholder="Role"
          />
          <input
            type="email"
            value={draftEmail}
            onChange={(e) => setDraftEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitNew();
              if (e.key === 'Escape') setAdding(false);
            }}
            onBlur={submitNew}
            className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm focus:outline-none focus:border-primary"
            placeholder="Email"
          />
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground hover:text-primary hover:border-primary transition"
        >
          <Plus size={16} />
          Add stakeholder
        </button>
      )}
    </div>
  );
}
