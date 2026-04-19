import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TldvClient, TldvApiError } from './tldv.ts';

const API_KEY = 'test-api-key';
const BASE = 'https://pasta.tldv.io/v1alpha1';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function textResponse(body: string, status: number): Response {
  return new Response(body, { status });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('TldvClient', () => {
  const client = new TldvClient(API_KEY);

  describe('listMeetings', () => {
    const mockResponse = {
      page: 1,
      pageSize: 50,
      pages: 1,
      total: 1,
      results: [
        {
          id: 'meeting-1',
          name: 'Brand Call',
          happenedAt: 'Wed Apr 15 2026 15:00:00 GMT+0000 (Coordinated Universal Time)',
          duration: 1800,
          invitees: [{ name: 'Alice', email: 'alice@example.com' }],
          organizer: { name: 'Bob', email: 'bob@example.com' },
          url: 'https://tldv.io/app/meetings/meeting-1',
        },
      ],
    };

    it('fetches meetings with default params', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(mockResponse));

      const result = await client.listMeetings();

      expect(fetchMock).toHaveBeenCalledWith(`${BASE}/meetings`, {
        headers: { 'x-api-key': API_KEY },
      });
      expect(result.total).toBe(1);
      expect(result.results).toHaveLength(1);
      expect(result.results[0]!.name).toBe('Brand Call');
    });

    it('passes query params', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(mockResponse));

      await client.listMeetings({
        limit: 10,
        page: 2,
        from: '2026-04-01T00:00:00.000Z',
        meetingType: 'external',
      });

      const url = fetchMock.mock.calls[0]![0] as string;
      expect(url).toContain('limit=10');
      expect(url).toContain('page=2');
      expect(url).toContain('from=2026-04-01T00%3A00%3A00.000Z');
      expect(url).toContain('meetingType=external');
    });

    it('normalizes verbose happenedAt to ISO', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(mockResponse));

      const result = await client.listMeetings();

      expect(result.results[0]!.happenedAt).toBe('2026-04-15T15:00:00.000Z');
    });

    it('preserves already-ISO happenedAt', async () => {
      const isoResponse = {
        ...mockResponse,
        results: [{ ...mockResponse.results[0]!, happenedAt: '2026-04-15T15:00:00.000Z' }],
      };
      fetchMock.mockResolvedValueOnce(jsonResponse(isoResponse));

      const result = await client.listMeetings();

      expect(result.results[0]!.happenedAt).toBe('2026-04-15T15:00:00.000Z');
    });
  });

  describe('getMeeting', () => {
    it('fetches a single meeting and normalizes date', async () => {
      const meeting = {
        id: 'meeting-1',
        name: 'Call',
        happenedAt: '2026-04-15T15:00:00.000Z',
        invitees: [],
        organizer: { name: 'Bob', email: 'bob@example.com' },
        url: 'https://tldv.io/app/meetings/meeting-1',
        template: { id: 'ai-topics', label: 'Smart topics' },
      };
      fetchMock.mockResolvedValueOnce(jsonResponse(meeting));

      const result = await client.getMeeting('meeting-1');

      expect(fetchMock).toHaveBeenCalledWith(`${BASE}/meetings/meeting-1`, {
        headers: { 'x-api-key': API_KEY },
      });
      expect(result.id).toBe('meeting-1');
      expect(result.template?.label).toBe('Smart topics');
    });
  });

  describe('getTranscript', () => {
    it('fetches transcript sentences', async () => {
      const transcript = {
        id: 'transcript-1',
        meetingId: 'meeting-1',
        data: [
          { speaker: 'Alice', text: 'Hello', startTime: 0, endTime: 3 },
          { speaker: 'Bob', text: 'Hi there', startTime: 4, endTime: 7 },
        ],
      };
      fetchMock.mockResolvedValueOnce(jsonResponse(transcript));

      const result = await client.getTranscript('meeting-1');

      expect(fetchMock).toHaveBeenCalledWith(`${BASE}/meetings/meeting-1/transcript`, {
        headers: { 'x-api-key': API_KEY },
      });
      expect(result.data).toHaveLength(2);
      expect(result.data[0]!.speaker).toBe('Alice');
    });
  });

  describe('getHighlights', () => {
    it('fetches highlights', async () => {
      const highlights = {
        meetingId: 'meeting-1',
        data: [
          {
            text: 'Key decision made',
            startTime: 120,
            source: 'auto' as const,
            topic: { title: 'Decisions', summary: 'No Summary' },
          },
        ],
      };
      fetchMock.mockResolvedValueOnce(jsonResponse(highlights));

      const result = await client.getHighlights('meeting-1');

      expect(fetchMock).toHaveBeenCalledWith(`${BASE}/meetings/meeting-1/highlights`, {
        headers: { 'x-api-key': API_KEY },
      });
      expect(result.data).toHaveLength(1);
      expect(result.data[0]!.topic.title).toBe('Decisions');
    });
  });

  describe('retry logic', () => {
    it('retries on 500 and succeeds', async () => {
      fetchMock
        .mockResolvedValueOnce(textResponse('server error', 500))
        .mockResolvedValueOnce(
          jsonResponse({ page: 1, pageSize: 50, pages: 1, total: 0, results: [] }),
        );

      const result = await client.listMeetings();

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(result.total).toBe(0);
    });

    it('retries on 429 and succeeds', async () => {
      fetchMock
        .mockResolvedValueOnce(textResponse('rate limited', 429))
        .mockResolvedValueOnce(
          jsonResponse({ page: 1, pageSize: 50, pages: 1, total: 0, results: [] }),
        );

      const result = await client.listMeetings();

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(result.total).toBe(0);
    });

    it('does not retry on 401', async () => {
      fetchMock.mockResolvedValueOnce(textResponse('unauthorized', 401));

      try {
        await client.listMeetings();
        expect.unreachable('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(TldvApiError);
        expect((err as TldvApiError).status).toBe(401);
      }

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('does not retry on 404', async () => {
      fetchMock.mockResolvedValueOnce(textResponse('not found', 404));

      await expect(client.getMeeting('bad-id')).rejects.toThrow(TldvApiError);

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('throws after max retries exhausted on 500', async () => {
      fetchMock.mockResolvedValue(textResponse('server error', 500));

      await expect(client.listMeetings()).rejects.toThrow(TldvApiError);

      expect(fetchMock).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
    }, 30_000);

    it('throws after max retries exhausted on 429', async () => {
      fetchMock.mockResolvedValue(textResponse('rate limited', 429));

      await expect(client.getTranscript('meeting-1')).rejects.toThrow(TldvApiError);

      expect(fetchMock).toHaveBeenCalledTimes(4);
    }, 30_000);
  });

  describe('error handling', () => {
    it('includes status code in TldvApiError', async () => {
      fetchMock.mockResolvedValueOnce(textResponse('bad request', 400));

      try {
        await client.listMeetings();
        expect.unreachable('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(TldvApiError);
        expect((err as TldvApiError).status).toBe(400);
        expect((err as TldvApiError).message).toContain('400');
        expect((err as TldvApiError).message).toContain('bad request');
      }
    });

    it('truncates long error bodies', async () => {
      const longBody = 'x'.repeat(1000);
      fetchMock.mockResolvedValueOnce(textResponse(longBody, 400));

      try {
        await client.listMeetings();
        expect.unreachable('should have thrown');
      } catch (err) {
        expect((err as TldvApiError).message.length).toBeLessThan(600);
      }
    });
  });
});
