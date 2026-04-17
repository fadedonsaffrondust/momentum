/* ─────────────── tldv API types ─────────────── */

export interface TldvPerson {
  name: string;
  email: string;
}

export interface TldvMeeting {
  id: string;
  name: string;
  happenedAt: string;
  duration?: number;
  invitees: TldvPerson[];
  organizer: TldvPerson;
  url: string;
  template?: { id: string; label: string };
}

export interface TldvMeetingListResponse {
  page: number;
  pageSize: number;
  pages: number;
  total: number;
  results: TldvMeeting[];
}

export interface TldvSentence {
  speaker: string;
  text: string;
  startTime: number;
  endTime: number;
}

export interface TldvTranscript {
  id: string;
  meetingId: string;
  data: TldvSentence[];
}

export interface TldvHighlight {
  text: string;
  startTime: number;
  source: 'manual' | 'auto';
  topic: { title: string; summary: string };
}

export interface TldvHighlightsResponse {
  meetingId: string;
  data: TldvHighlight[];
}

export interface TldvListParams {
  query?: string;
  page?: number;
  limit?: number;
  from?: string;
  to?: string;
  meetingType?: 'internal' | 'external';
}

/* ─────────────── client ─────────────── */

const BASE_URL = 'https://pasta.tldv.io/v1alpha1';
const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 1000;

export class TldvApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'TldvApiError';
  }
}

/**
 * Normalize the inconsistent happenedAt format from tldv.
 * List endpoint returns verbose strings like "Wed Apr 15 2026 15:00:00 GMT+0000 (...)",
 * detail endpoint returns ISO "2026-04-15T15:00:00.000Z".
 */
function normalizeDate(raw: string): string {
  if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) return raw;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toISOString();
}

function normalizeMeeting(m: TldvMeeting): TldvMeeting {
  return { ...m, happenedAt: normalizeDate(m.happenedAt) };
}

export class TldvClient {
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async listMeetings(params: TldvListParams = {}): Promise<TldvMeetingListResponse> {
    const qs = new URLSearchParams();
    if (params.query) qs.set('query', params.query);
    if (params.page != null) qs.set('page', String(params.page));
    if (params.limit != null) qs.set('limit', String(params.limit));
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    if (params.meetingType) qs.set('meetingType', params.meetingType);

    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    const res = await this.fetchWithRetry<TldvMeetingListResponse>(`/meetings${suffix}`);
    return { ...res, results: res.results.map(normalizeMeeting) };
  }

  async getMeeting(id: string): Promise<TldvMeeting> {
    const res = await this.fetchWithRetry<TldvMeeting>(`/meetings/${id}`);
    return normalizeMeeting(res);
  }

  async getTranscript(id: string): Promise<TldvTranscript> {
    return this.fetchWithRetry<TldvTranscript>(`/meetings/${id}/transcript`);
  }

  async getHighlights(id: string): Promise<TldvHighlightsResponse> {
    return this.fetchWithRetry<TldvHighlightsResponse>(`/meetings/${id}/highlights`);
  }

  private async fetchWithRetry<T>(path: string, retries = MAX_RETRIES): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      if (attempt > 0) {
        const delay = INITIAL_DELAY_MS * 2 ** (attempt - 1);
        await new Promise((r) => setTimeout(r, delay));
      }

      const res = await fetch(`${BASE_URL}${path}`, {
        headers: { 'x-api-key': this.apiKey },
      });

      if (res.ok) {
        return (await res.json()) as T;
      }

      const body = await res.text().catch(() => '');

      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        throw new TldvApiError(res.status, `tldv API error (${res.status}): ${body.slice(0, 500)}`);
      }

      lastError = new TldvApiError(
        res.status,
        `tldv API error (${res.status}): ${body.slice(0, 500)}`,
      );
    }

    throw lastError!;
  }
}
