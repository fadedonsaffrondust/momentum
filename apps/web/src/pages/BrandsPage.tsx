import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { BrandMeeting, BrandActionItem } from '@momentum/shared';
import {
  useBrands,
  useAllBrandMeetings,
  useAllBrandActionItems,
  useCreateBrand,
} from '../api/hooks';
import { BrandListRail } from '../components/brands/BrandListRail';
import { BrandDetailView } from '../components/brands/BrandDetailView';
import { ImportBrandModal } from '../components/brands/ImportBrandModal';
import { useUiStore } from '../store/ui';

export function BrandsPage() {
  const navigate = useNavigate();
  const { id: selectedBrandId } = useParams<{ id: string }>();
  const brandsQ = useBrands();
  const createBrand = useCreateBrand();
  const pushToast = useUiStore((s) => s.pushToast);

  const [showImportModal, setShowImportModal] = useState(false);
  const [importingBrandIds, setImportingBrandIds] = useState<Set<string>>(new Set());

  const brandIds = useMemo(() => (brandsQ.data ?? []).map((b) => b.id), [brandsQ.data]);
  const allMeetingsQueries = useAllBrandMeetings(brandIds);
  const allActionItemsQueries = useAllBrandActionItems(brandIds);

  // Poll importing brands: refetch the brands list periodically while any are importing.
  useEffect(() => {
    if (importingBrandIds.size === 0) return;
    const interval = setInterval(() => { brandsQ.refetch(); }, 3000);
    return () => clearInterval(interval);
  }, [importingBrandIds.size, brandsQ]);

  // Detect when importing brands complete or fail.
  useEffect(() => {
    if (importingBrandIds.size === 0 || !brandsQ.data) return;
    const completed = new Set<string>();
    for (const brand of brandsQ.data) {
      if (!importingBrandIds.has(brand.id)) continue;
      if (brand.status === 'active') {
        pushToast({
          kind: 'success',
          message: `Imported "${brand.name}" successfully.`,
          durationMs: 5000,
        });
        completed.add(brand.id);
      } else if (brand.status === 'import_failed') {
        pushToast({
          kind: 'error',
          message: `Import failed: ${brand.importError ?? 'Unknown error'}`,
          durationMs: 8000,
        });
        completed.add(brand.id);
      }
    }
    if (completed.size > 0) {
      setImportingBrandIds((prev) => {
        const next = new Set(prev);
        for (const id of completed) next.delete(id);
        return next;
      });
    }
  }, [brandsQ.data, importingBrandIds, pushToast]);

  const brands = brandsQ.data ?? [];

  const meetingsByBrand = useMemo(() => {
    const map = new Map<string, BrandMeeting[]>();
    brandIds.forEach((id, i) => {
      const data = allMeetingsQueries[i]?.data;
      if (data) map.set(id, data);
    });
    return map;
  }, [brandIds, allMeetingsQueries]);

  const actionItemsByBrand = useMemo(() => {
    const map = new Map<string, BrandActionItem[]>();
    brandIds.forEach((id, i) => {
      const data = allActionItemsQueries[i]?.data;
      if (data) map.set(id, data);
    });
    return map;
  }, [brandIds, allActionItemsQueries]);

  const handleSelectBrand = useCallback(
    (id: string) => navigate(`/brands/${id}`),
    [navigate],
  );

  const handleNewBrand = useCallback(async () => {
    try {
      const brand = await createBrand.mutateAsync({ name: 'New Brand' });
      navigate(`/brands/${brand.id}`);
    } catch {
      pushToast({ kind: 'error', message: 'Failed to create brand', durationMs: 4000 });
    }
  }, [createBrand, navigate, pushToast]);

  const handleImportStarted = useCallback(
    (brandId: string) => {
      setImportingBrandIds((prev) => new Set(prev).add(brandId));
      brandsQ.refetch();
    },
    [brandsQ],
  );

  return (
    <div className="h-full flex overflow-hidden">
      <BrandListRail
        brands={brands}
        meetingsByBrand={meetingsByBrand}
        actionItemsByBrand={actionItemsByBrand}
        selectedBrandId={selectedBrandId ?? null}
        onSelectBrand={handleSelectBrand}
        onNewBrand={handleNewBrand}
        onImport={() => setShowImportModal(true)}
      />

      <div className="flex-1 min-w-0 overflow-y-auto">
        {!selectedBrandId && (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="relative mb-6">
              <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-zinc-800 flex items-center justify-center">
                <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/30" />
              </div>
            </div>
            <p className="text-sm text-zinc-500">
              Select a brand or create a new one.
            </p>
          </div>
        )}

        {selectedBrandId && <BrandDetailView brandId={selectedBrandId} />}
      </div>

      {showImportModal && (
        <ImportBrandModal
          onClose={() => setShowImportModal(false)}
          onImportStarted={handleImportStarted}
        />
      )}
    </div>
  );
}
