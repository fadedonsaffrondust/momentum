import { useEffect, useRef, useState } from 'react';
import type { Brand } from '@momentum/shared';
import { Check } from 'lucide-react';
import { useUpdateBrand } from '../../../api/hooks';

/**
 * Side-by-side textareas for Goals + Success Definition. Each commits on
 * blur (no debounce — these are paragraphs, the user will pause typing
 * naturally before clicking elsewhere). A 1.5s green checkmark confirms
 * the round-trip landed.
 */
export function NorthStarFieldsEditor({ brand }: { brand: Brand }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <EditableCard label="Goals" value={brand.goals ?? ''} brandId={brand.id} field="goals" />
      <EditableCard
        label="Success Definition"
        value={brand.successDefinition ?? ''}
        brandId={brand.id}
        field="successDefinition"
      />
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
