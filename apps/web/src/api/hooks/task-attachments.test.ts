import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createElement } from 'react';
import { useUploadTaskAttachment, MAX_ATTACHMENT_BYTES } from './task-attachments';

const mockFetch = vi.fn();
const realFetch = global.fetch;

beforeEach(() => {
  mockFetch.mockReset();
  global.fetch = mockFetch as unknown as typeof fetch;
});

afterAll(() => {
  global.fetch = realFetch;
});

function withProvider() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

const TASK_ID = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';

describe('useUploadTaskAttachment', () => {
  it('rejects files larger than the 10 MB cap before hitting the network', async () => {
    const wrapper = withProvider();
    const { result } = renderHook(() => useUploadTaskAttachment(TASK_ID), { wrapper });

    const oversize = new File(['x'.repeat(MAX_ATTACHMENT_BYTES + 1)], 'big.bin', {
      type: 'application/octet-stream',
    });

    await act(async () => {
      await expect(result.current.mutateAsync(oversize)).rejects.toThrow(/too large/i);
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('POSTs FormData (no JSON content-type) and returns the attachment row', async () => {
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'att-id',
          taskId: TASK_ID,
          uploaderId: 'u',
          kind: 'image',
          originalName: 'pic.png',
          mimeType: 'image/png',
          sizeBytes: 12,
          url: '/attachments/att-id/download',
          createdAt: new Date().toISOString(),
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const wrapper = withProvider();
    const { result } = renderHook(() => useUploadTaskAttachment(TASK_ID), { wrapper });

    const file = new File(['hello'], 'pic.png', { type: 'image/png' });

    let returned: unknown;
    await act(async () => {
      returned = await result.current.mutateAsync(file);
    });

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    const [url, init] = mockFetch.mock.calls[0]!;
    expect(String(url)).toContain(`/tasks/${TASK_ID}/attachments`);
    expect((init as RequestInit).method).toBe('POST');
    expect((init as RequestInit).body).toBeInstanceOf(FormData);
    // Critical: we must NOT set content-type for FormData — the browser
    // sets it with the multipart boundary.
    const headers = ((init as RequestInit).headers ?? {}) as Record<string, string>;
    expect(headers['content-type']).toBeUndefined();
    expect((returned as { id: string }).id).toBe('att-id');
  });
});
