import { useState, useMemo } from 'react';
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
import { PulseSection } from './PulseSection';
import { NorthStarSection } from './NorthStarSection';
import { ActionItemsSection } from './ActionItemsSection';
import { MeetingsSection } from './MeetingsSection';
import { MeetingNoteModal } from './MeetingNoteModal';
import { RawContextSection } from './RawContextSection';
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

  const [showMeetingModal, setShowMeetingModal] = useState(false);

  const brand = brandQ.data;
  const meetings = meetingsQ.data ?? [];
  const actionItems = actionItemsQ.data ?? [];
  const stakeholders = stakeholdersQ.data ?? [];
  const pastTitles = useMemo(() => meetings.map((m) => m.title), [meetings]);

  if (!brand) {
    return (
      <div className="h-full flex items-center justify-center text-zinc-500 text-sm">
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
      />

      <div className="flex-1 overflow-y-auto">
        <PulseSection
          meetings={meetings}
          actionItems={actionItems}
          stakeholders={stakeholders}
          onSendToToday={handleSendToToday}
          onMarkDone={handleMarkDone}
        />

        <hr className="border-zinc-900 mx-6" />

        <NorthStarSection brand={brand} stakeholders={stakeholders} />

        <hr className="border-zinc-900 mx-6" />

        <ActionItemsSection brandId={brand.id} actionItems={actionItems} />

        <hr className="border-zinc-900 mx-6" />

        <MeetingsSection
          brandId={brand.id}
          meetings={meetings}
          stakeholders={stakeholders}
        />

        <hr className="border-zinc-900 mx-6" />

        <RawContextSection brand={brand} />
      </div>

      {showMeetingModal && (
        <MeetingNoteModal
          brandId={brand.id}
          stakeholders={stakeholders}
          pastTitles={pastTitles}
          onClose={() => setShowMeetingModal(false)}
        />
      )}
    </div>
  );
}
