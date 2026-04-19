import type { BrandActionItem, BrandMeeting, BrandStakeholder } from '@momentum/shared';
import { ActionItemsSection } from '../sections/ActionItemsSection';
import { MeetingsSection } from '../sections/MeetingsSection';

interface Props {
  brandId: string;
  actionItems: BrandActionItem[];
  meetings: BrandMeeting[];
  stakeholders: BrandStakeholder[];
}

export function WorkTab({ brandId, actionItems, meetings, stakeholders }: Props) {
  return (
    <div className="py-6 px-6 space-y-6 animate-slideUp">
      <ActionItemsSection brandId={brandId} actionItems={actionItems} />
      <hr className="border-border/60" />
      <MeetingsSection brandId={brandId} meetings={meetings} stakeholders={stakeholders} />
    </div>
  );
}
