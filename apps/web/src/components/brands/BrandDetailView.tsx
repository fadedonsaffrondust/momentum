import { useState, useMemo, useEffect } from 'react';
import type { Brand } from '@momentum/shared';
import {
  useBrand,
  useBrandMeetings,
  useBrandActionItems,
  useBrandStakeholders,
  useBrandFeatureRequests,
  usePullFeatureRequests,
  usePushFeatureRequests,
  useCompleteBrandActionItem,
} from '../../api/hooks';
import { BrandDetailHeader } from './BrandDetailHeader';
import { BrandTabBar } from './BrandTabBar';
import type { BrandTab } from './BrandTabBar';
import { OverviewTab } from './OverviewTab';
import { WorkTab } from './WorkTab';
import { FeatureRequestsTab } from './FeatureRequestsTab';
import { MeetingNoteModal } from './MeetingNoteModal';
import { SyncSettingsPanel } from './SyncSettingsPanel';
import { SyncReviewModal } from './SyncReviewModal';
import { ConnectSheetModal } from './ConnectSheetModal';
import { useUiStore } from '../../store/ui';

interface Props {
  brandId: string;
}

export function BrandDetailView({ brandId }: Props) {
  const brandQ = useBrand(brandId);
  const meetingsQ = useBrandMeetings(brandId);
  const actionItemsQ = useBrandActionItems(brandId);
  const stakeholdersQ = useBrandStakeholders(brandId);
  const featureRequestsQ = useBrandFeatureRequests(brandId);
  const pullFeatureRequests = usePullFeatureRequests(brandId);
  const pushFeatureRequests = usePushFeatureRequests(brandId);
  const completeItem = useCompleteBrandActionItem(brandId);
  const openAssigneePicker = useUiStore((s) => s.openAssigneePicker);
  const pushToast = useUiStore((s) => s.pushToast);

  const [activeTab, setActiveTab] = useState<BrandTab>('overview');
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [showSyncSettings, setShowSyncSettings] = useState(false);
  const [showSyncReview, setShowSyncReview] = useState(false);
  const [showConnectSheet, setShowConnectSheet] = useState(false);
  const activeModal = useUiStore((s) => s.activeModal);

  useEffect(() => {
    setActiveTab('overview');
  }, [brandId]);

  const brand = brandQ.data;
  const meetings = meetingsQ.data ?? [];
  const actionItems = actionItemsQ.data ?? [];
  const stakeholders = stakeholdersQ.data ?? [];
  const featureRequests = featureRequestsQ.data ?? [];
  const pastTitles = useMemo(() => meetings.map((m) => m.title), [meetings]);
  const openItemCount = useMemo(
    () => actionItems.filter((a) => a.status === 'open').length,
    [actionItems],
  );
  const openFeatureRequestCount = useMemo(
    () => featureRequests.filter((r) => !r.resolved).length,
    [featureRequests],
  );

  const isSyncing = pullFeatureRequests.isPending || pushFeatureRequests.isPending;

  const featureRequestsStale = useMemo(() => {
    const lastSync = brand?.featureRequestsConfig?.lastSyncedAt;
    if (!lastSync) return false;
    return Date.now() - new Date(lastSync).getTime() > 5 * 60_000;
  }, [brand?.featureRequestsConfig?.lastSyncedAt]);

  const anyModalOpen = showMeetingModal || showSyncSettings || showSyncReview || showConnectSheet || !!activeModal;

  useEffect(() => {
    if (!brand || anyModalOpen) return;

    const handler = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || (el as HTMLElement).isContentEditable)) return;

      if (e.key === 's' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setShowSyncReview(true);
      }
      if (e.key === '1' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setActiveTab('overview');
      }
      if (e.key === '2' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setActiveTab('work');
      }
      if ((e.key === '3' || e.key === 'f') && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setActiveTab('feature-requests');
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [brand, anyModalOpen]);

  if (!brand) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  const handleSendToToday = (itemId: string) => {
    // Open the assignee picker via the global host (Task 19); the host
    // calls `useSendActionItemToToday` on confirm + shows the toast.
    const item = actionItems.find((a) => a.id === itemId);
    openAssigneePicker({
      kind: 'send-to-today',
      brandId,
      itemId,
      itemText: item?.text ?? '',
    });
  };

  const handleMarkDone = (itemId: string) => {
    completeItem.mutate(itemId);
  };

  const handleNewMeeting = () => {
    setShowMeetingModal(true);
  };

  const handleSync = () => {
    pullFeatureRequests.mutate(undefined, {
      onSuccess: (pullRes) => {
        pushFeatureRequests.mutate(undefined, {
          onSuccess: (pushRes) => {
            const parts: string[] = [];
            if (pullRes.created) parts.push(`${pullRes.created} new`);
            if (pullRes.updated) parts.push(`${pullRes.updated} updated`);
            if (pushRes.pushed) parts.push(`${pushRes.pushed} pushed`);
            pushToast({
              kind: 'success',
              message: parts.length ? `Synced: ${parts.join(', ')}` : 'Everything up to date',
              durationMs: 3000,
            });
          },
          onError: () => {
            pushToast({ kind: 'error', message: 'Failed to push feature-request changes to the external sheet', durationMs: 4000 });
          },
        });
      },
      onError: () => {
        pushToast({ kind: 'error', message: 'Failed to pull updates from the external sheet', durationMs: 4000 });
      },
    });
  };

  return (
    <div className="h-full flex flex-col">
      <BrandDetailHeader
        brand={brand}
        meetings={meetings}
        actionItems={actionItems}
        onNewMeeting={handleNewMeeting}
        onSyncRecordings={() => setShowSyncReview(true)}
        onSyncSettings={() => setShowSyncSettings(true)}
      />

      <BrandTabBar
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        openItemCount={openItemCount}
        openFeatureRequestCount={openFeatureRequestCount}
        featureRequestsStale={featureRequestsStale}
      />

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'overview' ? (
          <OverviewTab
            brand={brand}
            meetings={meetings}
            actionItems={actionItems}
            stakeholders={stakeholders}
            featureRequests={featureRequests}
            onSendToToday={handleSendToToday}
            onMarkDone={handleMarkDone}
            onSwitchToFeatureRequests={() => setActiveTab('feature-requests')}
            onSwitchToWork={() => setActiveTab('work')}
          />
        ) : activeTab === 'work' ? (
          <WorkTab
            brandId={brand.id}
            actionItems={actionItems}
            meetings={meetings}
            stakeholders={stakeholders}
          />
        ) : (
          <FeatureRequestsTab
            brandId={brand.id}
            featureRequests={featureRequests}
            config={brand.featureRequestsConfig}
            isSyncing={isSyncing}
            onSync={handleSync}
            onConnect={() => setShowConnectSheet(true)}
          />
        )}
      </div>

      {showMeetingModal && (
        <MeetingNoteModal
          brandId={brand.id}
          stakeholders={stakeholders}
          pastTitles={pastTitles}
          onClose={() => setShowMeetingModal(false)}
        />
      )}

      {showSyncReview && (
        <SyncReviewModal
          brandId={brand.id}
          brandName={brand.name}
          onClose={() => setShowSyncReview(false)}
        />
      )}

      {showSyncSettings && (
        <SyncSettingsPanel
          brand={brand}
          stakeholders={stakeholders}
          onClose={() => setShowSyncSettings(false)}
        />
      )}

      {showConnectSheet && (
        <ConnectSheetModal
          brandId={brand.id}
          brandName={brand.name}
          onClose={() => setShowConnectSheet(false)}
        />
      )}
    </div>
  );
}
