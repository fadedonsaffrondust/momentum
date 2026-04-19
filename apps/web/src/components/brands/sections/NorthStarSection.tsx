import { useState, useRef, useEffect } from 'react';
import type { Brand, BrandStakeholder } from '@momentum/shared';
import {
  useUpdateBrand,
  useCreateBrandStakeholder,
  useUpdateBrandStakeholder,
  useDeleteBrandStakeholder,
} from '../../../api/hooks';
import { Check, ChevronDown, ChevronRight, Plus, Trash2, Pencil } from 'lucide-react';

interface Props {
  brand: Brand;
  stakeholders: BrandStakeholder[];
}

export function NorthStarSection({ brand, stakeholders }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <section className="px-6 py-4">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center gap-2 w-full text-left group"
      >
        {collapsed ? (
          <ChevronRight size={14} className="text-muted-foreground/70" />
        ) : (
          <ChevronDown size={14} className="text-muted-foreground/70" />
        )}
        <h2 className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold group-hover:text-foreground transition">
          North Star
        </h2>
      </button>

      {!collapsed && (
        <div className="mt-4 space-y-5 animate-slideUp">
          <EditableTextField
            label="Goals"
            value={brand.goals ?? ''}
            brandId={brand.id}
            field="goals"
          />
          <StakeholdersList brandId={brand.id} stakeholders={stakeholders} />
          <EditableTextField
            label="Success Definition"
            value={brand.successDefinition ?? ''}
            brandId={brand.id}
            field="successDefinition"
          />
        </div>
      )}
    </section>
  );
}

function EditableTextField({
  label,
  value,
  brandId,
  field,
}: {
  label: string;
  value: string;
  brandId: string;
  field: 'goals' | 'successDefinition';
}) {
  const updateBrand = useUpdateBrand();
  const [text, setText] = useState(value);
  const [saved, setSaved] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    setText(value);
  }, [value]);

  const commit = () => {
    if (text !== value) {
      updateBrand.mutate(
        { id: brandId, [field]: text || null },
        {
          onSuccess: () => {
            setSaved(true);
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = window.setTimeout(() => setSaved(false), 1500);
          },
        },
      );
    }
  };

  return (
    <label className="block">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
          {label}
        </span>
        {saved && <Check size={12} className="text-emerald-500" />}
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        rows={3}
        placeholder={`Add ${label.toLowerCase()}…`}
        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary resize-none placeholder:text-muted-foreground/70"
      />
    </label>
  );
}

function StakeholdersList({
  brandId,
  stakeholders,
}: {
  brandId: string;
  stakeholders: BrandStakeholder[];
}) {
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

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
          Key Stakeholders
        </span>
        <span className="text-[10px] text-muted-foreground/70">({stakeholders.length})</span>
      </div>

      <ul className="space-y-1">
        {stakeholders.map((s) => (
          <li
            key={s.id}
            className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-card/40 transition text-sm"
          >
            {editingId === s.id ? (
              <div className="flex-1 flex gap-2 flex-wrap">
                <input
                  autoFocus
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitEdit(s.id);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  className="flex-1 min-w-[80px] bg-background border border-border rounded px-2 py-1 text-xs focus:outline-none focus:border-primary"
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
                  className="w-24 bg-background border border-border rounded px-2 py-1 text-xs focus:outline-none focus:border-primary"
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
                  className="w-40 bg-background border border-border rounded px-2 py-1 text-xs focus:outline-none focus:border-primary"
                  placeholder="Email"
                />
              </div>
            ) : (
              <>
                <span className="flex-1 text-foreground">
                  {s.name}
                  {s.email && (
                    <span className="ml-2 text-xs text-muted-foreground/70">{s.email}</span>
                  )}
                </span>
                {s.role && <span className="text-xs text-muted-foreground">{s.role}</span>}
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={() => startEdit(s)}
                    className="p-0.5 text-muted-foreground/70 hover:text-foreground"
                    title="Edit"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    onClick={() => deleteStakeholder.mutate(s.id)}
                    className="p-0.5 text-muted-foreground/70 hover:text-red-400"
                    title="Remove"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>

      {adding ? (
        <div className="flex gap-2 mt-2 flex-wrap">
          <input
            ref={addInputRef}
            type="text"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitNew();
              if (e.key === 'Escape') setAdding(false);
            }}
            className="flex-1 min-w-[80px] bg-background border border-border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-primary"
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
            className="w-24 bg-background border border-border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-primary"
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
            className="w-40 bg-background border border-border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-primary"
            placeholder="Email"
          />
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition"
        >
          <Plus size={12} /> Add stakeholder
        </button>
      )}
    </div>
  );
}
