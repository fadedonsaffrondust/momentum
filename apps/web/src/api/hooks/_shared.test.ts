import { describe, it, expect } from 'vitest';
import {
  brandKeys,
  dailyLogKeys,
  inboxKeys,
  meKeys,
  parkingKeys,
  roleKeys,
  settingsKeys,
  statsKeys,
  taskKeys,
  userKeys,
} from './_shared';

/**
 * The factories all return readonly tuples that the rest of the hook layer
 * uses both as queryKeys and as prefix-match arguments to invalidateQueries.
 * The tuple SHAPE matters more than the values: TanStack Query's prefix
 * matching only fires if `taskKeys.list({...})` actually starts with
 * `taskKeys.all`. These tests pin that contract so a future "tighten the
 * invalidation cardinality" change can't silently break it.
 */
describe('query-key factories', () => {
  describe('taskKeys', () => {
    it('list() is prefixed by all', () => {
      const params = { date: '2026-04-19' };
      expect(taskKeys.list(params)[0]).toBe(taskKeys.all[0]);
      expect(taskKeys.list(params)).toEqual(['tasks', params]);
    });

    it('team() is prefixed by all', () => {
      expect(taskKeys.team({})[0]).toBe(taskKeys.all[0]);
      expect(taskKeys.team({})).toEqual(['tasks', 'team', {}]);
    });
  });

  describe('parkingKeys', () => {
    it('list() is prefixed by all', () => {
      expect(parkingKeys.list({})[0]).toBe(parkingKeys.all[0]);
      expect(parkingKeys.list({})).toEqual(['parkings', {}]);
    });
  });

  describe('brandKeys', () => {
    it('detail() is prefixed by all', () => {
      expect(brandKeys.detail('b1')[0]).toBe(brandKeys.all[0]);
      expect(brandKeys.detail('b1')).toEqual(['brands', 'b1']);
    });

    it('every per-brand resource is prefixed by detail(brandId)', () => {
      const id = 'b1';
      const detailPrefix = brandKeys.detail(id);
      const resources = [
        brandKeys.stakeholders(id),
        brandKeys.meetings(id),
        brandKeys.actionItems(id, {}),
        brandKeys.actionItemsAll(id),
        brandKeys.featureRequests(id, {}),
        brandKeys.events(id, {}),
      ];
      for (const r of resources) {
        expect(r[0]).toBe(detailPrefix[0]);
        expect(r[1]).toBe(detailPrefix[1]);
      }
    });

    it('actionItems() params are part of the key (refetch on filter change)', () => {
      const a = brandKeys.actionItems('b1', { status: 'open' });
      const b = brandKeys.actionItems('b1', { status: 'done' });
      expect(a).not.toEqual(b);
    });
  });

  describe('inboxKeys', () => {
    it('list() and unreadCount are both prefixed by all', () => {
      expect(inboxKeys.list({})[0]).toBe(inboxKeys.all[0]);
      expect(inboxKeys.unreadCount[0]).toBe(inboxKeys.all[0]);
    });
  });

  describe('userKeys', () => {
    it('detail() is prefixed by all', () => {
      expect(userKeys.detail('u1')[0]).toBe(userKeys.all[0]);
    });
  });

  describe('singleton keys', () => {
    it('expose stable tuples', () => {
      expect(roleKeys.all).toEqual(['roles']);
      expect(settingsKeys.all).toEqual(['settings']);
      expect(meKeys.detail('tok')).toEqual(['me', 'tok']);
      expect(meKeys.detail(null)).toEqual(['me', null]);
      expect(dailyLogKeys.all).toEqual(['daily-logs']);
      expect(dailyLogKeys.list(30)).toEqual(['daily-logs', 30]);
      expect(statsKeys.weekly).toEqual(['weekly-stats']);
      expect(statsKeys.teamWeekly).toEqual(['weekly-stats', 'team']);
      expect(statsKeys.teamToday).toEqual(['stats', 'team-today']);
    });
  });
});
