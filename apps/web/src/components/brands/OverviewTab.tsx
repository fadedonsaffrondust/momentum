import { useState, useRef, useEffect, useMemo } from 'react';
import type {
  Brand,
  BrandMeeting,
  BrandActionItem,
  BrandStakeholder,
  BrandFeatureRequest,
} from '@momentum/shared';
import { Check, ChevronDown, ChevronRight, Plus, Pencil, Trash2 } from 'lucide-react';
import { StakeholderBadge } from './StakeholderBadge';
import { RecentActivitySection } from './RecentActivitySection';
import { formatDateShort } from '../../lib/format';
import { todayIso } from '../../lib/date';
import {
  useUpdateBrand,
  useCreateBrandStakeholder,
  useUpdateBrandStakeholder,
  useDeleteBrandStakeholder,
} from '../../api/hooks';

interface Props {
  brand: Brand;
  meetings: BrandMeeting[];
  actionItems: BrandActionItem[];
  stakeholders: BrandStakeholder[];
  featureRequests: BrandFeatureRequest[];
  onSendToToday: (id: string) => void;
  onMarkDone: (id: string) => void;
  onSwitchToFeatureRequests: () => void;
  onSwitchToWork?: () => void;
  onOpenMeeting?: (meetingId: string) => void;
}

export function OverviewTab({
  brand,
  meetings,
  actionItems,
  stakeholders,
  featureRequests,
  onSendToToday,
  onMarkDone,
  onSwitchToFeatureRequests,
  onSwitchToWork,
  onOpenMeeting,
}: Props) {
  const today = todayIso();

  const { lastMeeting, cadence, totalMeetings } = useMemo(() => {
    const sorted = [...meetings].sort((a, b) => b.date.localeCompare(a.date));
    const last = sorted[0];
    let cadence: number | null = null;

    if (sorted.length >= 2) {
      let totalGap = 0;
      for (let i = 0; i < sorted.length - 1; i++) {
        const a = new Date(sorted[i]!.date + 'T00:00:00');
        const b = new Date(sorted[i + 1]!.date + 'T00:00:00');
        totalGap += Math.abs(a.getTime() - b.getTime()) / 86_400_000;
      }
      cadence = Math.round((totalGap / (sorted.length - 1)) * 10) / 10;
    }

    return { lastMeeting: last, cadence, totalMeetings: sorted.length };
  }, [meetings]);

  const topOpenItems = useMemo(
    () =>
      actionItems
        .filter((a) => a.status === 'open')
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 3),
    [actionItems],
  );

  const openCount = actionItems.filter((a) => a.status === 'open').length;

  const lastMentionByStakeholder = useMemo(() => {
    const map = new Map<string, string>();
    const sorted = [...meetings].sort((a, b) => b.date.localeCompare(a.date));
    for (const m of sorted) {
      for (const attendee of m.attendees) {
        const key = attendee.toLowerCase();
        if (!map.has(key)) map.set(key, m.date);
      }
    }
    return map;
  }, [meetings]);

  const daysSince = (dateStr: string) => {
    const diff = Math.floor(
      (new Date(today + 'T00:00:00').getTime() - new Date(dateStr + 'T00:00:00').getTime()) /
        86_400_000,
    );
    if (diff === 0) return 'Today';
    if (diff === 1) return '1d ago';
    return `${diff}d ago`;
  };

  const itemAge = (createdAt: string) => {
    const diff = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000);
    if (diff === 0) return 'today';
    if (diff === 1) return '1d old';
    return `${diff}d old`;
  };

  return (
    <div className="py-6 px-6 space-y-6 animate-slideUp">
      {/* Health Card */}
      <div className="bg-card rounded-xl p-6 border border-border/60">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Activity Stats */}
          <div className="space-y-3">
            <h3 className="text-xs uppercase tracking-wide text-foreground font-semibold">
              Activity
            </h3>
            <div className="space-y-1.5">
              <div className="text-sm text-foreground">
                {lastMeeting ? (
                  <>
                    <span className="text-muted-foreground">Last meeting:</span>{' '}
                    <span className="text-foreground">{daysSince(lastMeeting.date)}</span>
                    {' — '}
                    {lastMeeting.title}
                  </>
                ) : (
                  <span className="text-muted-foreground">No meetings logged</span>
                )}
              </div>
              {cadence !== null && (
                <div className="text-sm text-muted-foreground">
                  Avg {cadence} days between meetings
                </div>
              )}
              <div className="text-sm text-muted-foreground">
                {totalMeetings} meeting{totalMeetings !== 1 ? 's' : ''} logged
              </div>
            </div>
          </div>

          {/* Top Open Items */}
          <div className="space-y-3">
            <h3 className="text-xs uppercase tracking-wide text-foreground font-semibold">
              Open items
              {openCount > 0 && <span className="ml-1 text-muted-foreground">({openCount})</span>}
            </h3>
            {topOpenItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">No open action items.</p>
            ) : (
              <ul className="space-y-2">
                {topOpenItems.map((item) => (
                  <li key={item.id} className="flex items-start gap-2 text-sm group">
                    <span className="flex-1 text-foreground leading-snug">{item.text}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {itemAge(item.createdAt)}
                    </span>
                    <div className="shrink-0 flex gap-1.5 opacity-0 group-hover:opacity-100 transition">
                      <button
                        onClick={() => onSendToToday(item.id)}
                        className="text-xs text-primary hover:underline"
                        title="Send to Today"
                      >
                        +Today
                      </button>
                      <button
                        onClick={() => onMarkDone(item.id)}
                        className="text-xs text-emerald-500 hover:underline"
                        title="Mark done"
                      >
                        Done
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {openCount > 3 && (
              <p className="text-xs text-primary">+{openCount - 3} more open items</p>
            )}
          </div>

          {/* Feature Requests */}
          <div className="space-y-3">
            <h3 className="text-xs uppercase tracking-wide text-foreground font-semibold">
              Feature Requests
            </h3>
            {featureRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground">No feature requests yet.</p>
            ) : (
              <div className="space-y-1.5">
                <div className="text-sm text-foreground">
                  <span className="text-foreground font-medium">
                    {featureRequests.filter((r) => !r.resolved).length}
                  </span>{' '}
                  <span className="text-muted-foreground">open</span>
                  {', '}
                  <span className="text-foreground font-medium">
                    {featureRequests.filter((r) => r.resolved).length}
                  </span>{' '}
                  <span className="text-muted-foreground">resolved</span>
                </div>
                {brand.featureRequestsConfig?.connected && (
                  <div className="text-xs text-muted-foreground">Sheet connected</div>
                )}
              </div>
            )}
            <button
              onClick={onSwitchToFeatureRequests}
              className="text-xs text-primary hover:underline"
            >
              View all →
            </button>
          </div>
        </div>
      </div>

      {/* Stakeholders Grid */}
      <div>
        <h3 className="text-xs uppercase tracking-wide text-foreground font-semibold mb-3">
          Key Stakeholders
          {stakeholders.length > 0 && (
            <span className="ml-1 text-muted-foreground">({stakeholders.length})</span>
          )}
        </h3>
        <StakeholdersGrid
          brandId={brand.id}
          stakeholders={stakeholders}
          lastMentionByStakeholder={lastMentionByStakeholder}
        />
      </div>

      {/* North Star */}
      <div>
        <h3 className="text-xs uppercase tracking-wide text-foreground font-semibold mb-3">
          North Star
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <EditableCard label="Goals" value={brand.goals ?? ''} brandId={brand.id} field="goals" />
          <EditableCard
            label="Success Definition"
            value={brand.successDefinition ?? ''}
            brandId={brand.id}
            field="successDefinition"
          />
        </div>
      </div>

      {/* Recent Activity */}
      <RecentActivitySection
        brandId={brand.id}
        onOpenActionItems={onSwitchToWork}
        onOpenMeeting={onOpenMeeting}
      />

      {/* Raw Context — collapsed by default */}
      {brand.rawImportContent && (
        <RawContextCollapsible
          content={brand.rawImportContent}
          source={brand.importedFrom ?? null}
        />
      )}
    </div>
  );
}

function EditableCard({
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
    <div className="bg-card rounded-lg p-5 border border-border/60">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-foreground font-medium">{label}</span>
        {saved && <Check size={14} className="text-emerald-500" />}
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        rows={3}
        placeholder={`Add ${label.toLowerCase()}…`}
        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary resize-none placeholder:text-muted-foreground/70"
      />
    </div>
  );
}

function StakeholdersGrid({
  brandId,
  stakeholders,
  lastMentionByStakeholder,
}: {
  brandId: string;
  stakeholders: BrandStakeholder[];
  lastMentionByStakeholder: Map<string, string>;
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

function RawContextCollapsible({ content, source }: { content: string; source: string | null }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground/70 hover:text-muted-foreground transition"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        Imported context
        {source && <span className="text-muted-foreground/70">({source})</span>}
      </button>
      {open && (
        <pre className="mt-2 p-3 bg-card/60 border border-border/60 rounded-lg text-xs text-muted-foreground whitespace-pre-wrap font-mono max-h-48 overflow-y-auto leading-relaxed animate-slideUp">
          {content}
        </pre>
      )}
    </div>
  );
}
