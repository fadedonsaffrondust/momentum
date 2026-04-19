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
} from './enums.ts';

/**
 * Snapshot test for the canonical enum tuples. If you intentionally
 * add/remove/reorder a value, also write the matching Drizzle migration
 * (these tuples are the type of a Postgres column) and update this test.
 *
 * The runtime parity check between this module and the Drizzle pgEnum
 * definitions lives in apps/api/src/test/enum-parity.test.ts.
 */
describe('canonical enum tuples', () => {
  it('PRIORITY', () => {
    expect(PRIORITY).toEqual(['high', 'medium', 'low']);
  });

  it('TASK_STATUS', () => {
    expect(TASK_STATUS).toEqual(['todo', 'in_progress', 'done']);
  });

  it('TASK_COLUMN', () => {
    expect(TASK_COLUMN).toEqual(['up_next', 'in_progress', 'done']);
  });

  it('THEME', () => {
    expect(THEME).toEqual(['dark', 'light']);
  });

  it('PARKING_STATUS', () => {
    expect(PARKING_STATUS).toEqual(['open', 'discussed', 'archived']);
  });

  it('PARKING_VISIBILITY', () => {
    expect(PARKING_VISIBILITY).toEqual(['team', 'private']);
  });

  it('BRAND_STATUS', () => {
    expect(BRAND_STATUS).toEqual(['active', 'importing', 'import_failed']);
  });

  it('BRAND_ACTION_STATUS', () => {
    expect(BRAND_ACTION_STATUS).toEqual(['open', 'done']);
  });

  it('MEETING_SOURCE', () => {
    expect(MEETING_SOURCE).toEqual(['manual', 'recording_sync']);
  });

  it('FEATURE_REQUEST_SYNC_STATUS', () => {
    expect(FEATURE_REQUEST_SYNC_STATUS).toEqual(['synced', 'pending', 'error']);
  });

  it('TASK_ATTACHMENT_KIND', () => {
    expect(TASK_ATTACHMENT_KIND).toEqual(['image', 'file']);
  });
});
