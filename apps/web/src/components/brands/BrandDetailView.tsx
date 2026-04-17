import { useState, useMemo, useEffect } from 'react';
import type { Brand } from '@momentum/shared';
import {
  useBrand,
  useBrandMeetings,
  useBrandActionItems,
  useBrandStakeholders,
  useSendActionItemToToday,
  useCompleteBrandActionItem,
} from '../../api/hooks';
import { BrandDetailHeader } from './BrandDetailHeader';
import { BrandTabBar } from './BrandTabBar';
import type { BrandTab } from './BrandTabBar';
import { OverviewTab } from './OverviewTab';
import { WorkTab } from './WorkTab';
import { MeetingNoteModal } from './MeetingNoteModal';
import { SyncSettingsPanel } from './SyncSettingsPanel';
import { SyncReviewModal } from './SyncReviewModal';
import { useUiStore } from '../../store/ui';

interface Props {
  brandId: string;
}

export function BrandDetailView({ brandId }: Props) {
  const brandQ = useBrand(brandId);
  const meetingsQ = useBrandMeetings(brandId);
  const actionItemsQ = useBrandActionItems(brandId);
  const stakeholdersQ = useBrandStakeholders(brandId);
  const sendToToday = useSendActionItemToToday(brandId);
  const completeItem = useCompleteBrandActionItem(brandId);
  const pushToast = useUiStore((s) => s.pushToast);

  const [activeTab, setActiveTab] = useState<BrandTab>('overview');
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [showSyncSettings, setShowSyncSettings] = useState(false);
  const [showSyncReview, setShowSyncReview] = useState(false);
  const activeModal = useUiStore((s) => s.activeModal);

  useEffect(() => {
    setActiveTab('overview');
  }, [brandId]);

  const brand = brandQ.data;
  const meetings = meetingsQ.data ?? [];
  const actionItems = actionItemsQ.data ?? [];
  const stakeholders = stakeholdersQ.data ?? [];
  const pastTitles = useMemo(() => meetings.map((m) => m.title), [meetings]);
  const openItemCount = useMemo(
    () => actionItems.filter((a) => a.status === 'open').length,
    [actionItems],
  );

  const anyModalOpen = showMeetingModal || showSyncSettings || showSyncReview || !!activeModal;

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
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [brand, anyModalOpen]);

  if (!brand) {
    return (
      <div className="h-full flex items-center justify-center text-m-fg-muted text-sm">
        Loading…
      </div>
    );
  }

  const handleSendToToday = (itemId: string) => {
    sendToToday.mutate(itemId, {
      onSuccess: (res) => {
        pushToast({
          kind: 'success',
          message: `Sent to Today: "${res.task.title}"`,
          durationMs: 3000,
        });
      },
      onError: () => {
        pushToast({ kind: 'error', message: 'Failed to send to Today', durationMs: 4000 });
      },
    });
  };

  const handleMarkDone = (itemId: string) => {
    completeItem.mutate(itemId);
  };

  const handleNewMeeting = () => {
    setShowMeetingModal(true);
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
      />

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'overview' ? (
          <OverviewTab
            brand={brand}
            meetings={meetings}
            actionItems={actionItems}
            stakeholders={stakeholders}
            onSendToToday={handleSendToToday}
            onMarkDone={handleMarkDone}
          />
        ) : (
          <WorkTab
            brandId={brand.id}
            actionItems={actionItems}
            meetings={meetings}
            stakeholders={stakeholders}
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
    </div>
  );
}
