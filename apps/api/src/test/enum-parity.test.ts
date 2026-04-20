import { describe, it, expect } from 'vitest';
import {
  PRIORITY,
  TASK_STATUS,
  TASK_COLUMN,
  THEME,
  PARKING_STATUS,
  PARKING_VISIBILITY,
  BRAND_STATUS,
  BRAND_ACTION_STATUS,
  MEETING_SOURCE,
  FEATURE_REQUEST_SYNC_STATUS,
  TASK_ATTACHMENT_KIND,
  JARVIS_MESSAGE_ROLE,
} from '@momentum/shared/enums';
import {
  priorityEnum,
  taskStatusEnum,
  taskColumnEnum,
  themeEnum,
  parkingStatusEnum,
  parkingVisibilityEnum,
  brandStatusEnum,
  brandActionStatusEnum,
  meetingSourceEnum,
  featureRequestSyncStatusEnum,
  taskAttachmentKindEnum,
  jarvisMessageRoleEnum,
} from '@momentum/db';

/**
 * Runtime parity between the Drizzle pgEnum tuples and the canonical
 * tuples in @momentum/shared/enums. Both sides import from the same
 * source today, so this is a regression guard against future drift —
 * if someone redefines an enum inline on either side, this test fails.
 */
describe('Drizzle ↔ shared enum parity', () => {
  it.each([
    ['priority', priorityEnum.enumValues, PRIORITY],
    ['task_status', taskStatusEnum.enumValues, TASK_STATUS],
    ['task_column', taskColumnEnum.enumValues, TASK_COLUMN],
    ['theme', themeEnum.enumValues, THEME],
    ['parking_status', parkingStatusEnum.enumValues, PARKING_STATUS],
    ['parking_visibility', parkingVisibilityEnum.enumValues, PARKING_VISIBILITY],
    ['brand_status', brandStatusEnum.enumValues, BRAND_STATUS],
    ['brand_action_status', brandActionStatusEnum.enumValues, BRAND_ACTION_STATUS],
    ['meeting_source', meetingSourceEnum.enumValues, MEETING_SOURCE],
    [
      'feature_request_sync_status',
      featureRequestSyncStatusEnum.enumValues,
      FEATURE_REQUEST_SYNC_STATUS,
    ],
    ['task_attachment_kind', taskAttachmentKindEnum.enumValues, TASK_ATTACHMENT_KIND],
    ['jarvis_message_role', jarvisMessageRoleEnum.enumValues, JARVIS_MESSAGE_ROLE],
  ] as const)('%s tuple matches Drizzle enumValues', (_name, drizzleValues, sharedTuple) => {
    expect([...drizzleValues]).toEqual([...sharedTuple]);
  });
});
