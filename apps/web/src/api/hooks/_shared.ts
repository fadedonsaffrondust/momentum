import type { BrandActionStatus, ParkingStatus, TaskStatus } from '@momentum/shared';
import { useAuthStore } from '../../store/auth';

export { apiFetch } from '../../lib/api';

/** Selector for the JWT token. Re-exported so per-domain hook files don't
 * each have to reach into the auth store. */
export const useToken = () => useAuthStore((s) => s.token);

/**
 * staleTime for team-shared list queries (spec §4.5). Fresh for 30s, then
 * marked stale — tab-switching and refocus naturally refetch without
 * thrashing on rapid navigation within that window.
 */
export const SHARED_STALE_TIME = 30_000;

/* ─────────────── query-key factories ───────────────
 *
 * Every useQuery / invalidateQueries call routes through these factories
 * so a future tightening (e.g. swapping prefix-matched invalidations for
 * targeted ones) only touches this file. Factories return `as const`
 * tuples so TanStack Query gets the narrow tuple type.
 *
 * Invalidation cardinality is intentionally unchanged from the pre-split
 * code: passing `taskKeys.all` to invalidateQueries matches every query
 * whose key starts with ['tasks'], same as before.
 */

export interface TasksQueryParams {
  date?: string;
  roleId?: string;
  status?: TaskStatus;
  /** 'ALL' → team-wide list; a uuid → filter to that assignee; omit → current user. */
  assigneeId?: string | 'ALL';
  creatorId?: string;
}

export interface TeamTasksQueryParams {
  date?: string;
  status?: TaskStatus;
}

export const taskKeys = {
  all: ['tasks'] as const,
  list: (params: TasksQueryParams) => ['tasks', params] as const,
  team: (params: TeamTasksQueryParams) => ['tasks', 'team', params] as const,
};

export interface ParkingsQueryParams {
  status?: ParkingStatus;
  targetDate?: string;
  roleId?: string;
}

export const parkingKeys = {
  all: ['parkings'] as const,
  list: (params: ParkingsQueryParams) => ['parkings', params] as const,
};

export interface InboxQueryParams {
  unreadOnly?: 'true' | 'false';
  limit?: number;
  cursor?: string;
}

export const inboxKeys = {
  all: ['inbox'] as const,
  list: (params: InboxQueryParams) => ['inbox', params] as const,
  unreadCount: ['inbox', 'unread-count'] as const,
};

export interface FeatureRequestsQueryParams {
  resolved?: 'true' | 'false';
  search?: string;
}

export interface BrandEventsQueryParams {
  limit?: number;
  cursor?: string;
}

export const brandKeys = {
  all: ['brands'] as const,
  detail: (id: string | undefined) => ['brands', id] as const,
  stakeholders: (brandId: string | undefined) => ['brands', brandId, 'stakeholders'] as const,
  meetings: (brandId: string | undefined) => ['brands', brandId, 'meetings'] as const,
  actionItems: (brandId: string | undefined, params: { status?: BrandActionStatus } = {}) =>
    ['brands', brandId, 'action-items', params] as const,
  /** Empty-params variant used by useAllBrandActionItems where params aren't varied. */
  actionItemsAll: (brandId: string | undefined) => ['brands', brandId, 'action-items', {}] as const,
  featureRequests: (brandId: string | undefined, params: FeatureRequestsQueryParams = {}) =>
    ['brands', brandId, 'feature-requests', params] as const,
  events: (brandId: string | undefined, params: BrandEventsQueryParams = {}) =>
    ['brands', brandId, 'events', params] as const,
};

export const userKeys = {
  all: ['users'] as const,
  detail: (id: string | undefined) => ['users', id] as const,
};

export const roleKeys = {
  all: ['roles'] as const,
};

export const settingsKeys = {
  all: ['settings'] as const,
};

export const meKeys = {
  detail: (token: string | null | undefined) => ['me', token] as const,
};

export const dailyLogKeys = {
  all: ['daily-logs'] as const,
  list: (limit: number) => ['daily-logs', limit] as const,
};

export const statsKeys = {
  weekly: ['weekly-stats'] as const,
  teamWeekly: ['weekly-stats', 'team'] as const,
  teamToday: ['stats', 'team-today'] as const,
};
