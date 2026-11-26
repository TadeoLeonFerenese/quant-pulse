import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createSafeFetcher, DEFAULT_FETCH_TIMEOUT_MS } from './safeFetch';

const quoteSchema = z.object({
  price: z.number().positive(),
  symbol: z.string().min(1),
});

describe('createSafeFetcher', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses 3000ms as default timeout', () => {
    expect(DEFAULT_FETCH_TIMEOUT_MS).toBe(3_000);
  });

  it('rejects non-HTTPS and malformed URLs immediately without invoking fetch', async () => {
    const fetchSpy = vi.fn<typeof fetch>();
    const fetcher = createSafeFetcher(fetchSpy);

    const httpResult = await fetcher.fetchJson('http://api.example.com/quote', quoteSchema);
    const badUrlResult = await fetcher.fetchJson('not-a-url', quoteSchema);

    expect(httpResult.ok).toBe(false);
    if (!httpResult.ok) {
      expect(httpResult.code).toBe('INSECURE_URL');
    }
    expect(badUrlResult.ok).toBe(false);
    if (!badUrlResult.ok) {
      expect(badUrlResult.code).toBe('INSECURE_URL');
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns parsed data on a valid HTTPS JSON response matching Zod schema', async () => {
    const fetchSpy = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ price: 1185.5, symbol: 'MEP' }), { status: 200 }),
      );
    const fetcher = createSafeFetcher(fetchSpy);

    const result = await fetcher.fetchJson('https://dolarapi.com/v1/dolares/bolsa', quoteSchema);

    expect(result).toEqual({ ok: true, data: { price: 1185.5, symbol: 'MEP' } });
  });

  it('returns INVALID_PAYLOAD when response JSON violates schema or is malformed JSON', async () => {
    const fetchBadSchema = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ price: -5, symbol: '' }), { status: 200 }));
    const schemaRes = await createSafeFetcher(fetchBadSchema).fetchJson(
      'https://api.example.com/quote',
      quoteSchema,
    );
    expect(schemaRes.ok).toBe(false);
    if (!schemaRes.ok) {
      expect(schemaRes.code).toBe('INVALID_PAYLOAD');
    }

    const fetchMalformed = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('<html>oops</html>', { status: 200 }));
    const malformedRes = await createSafeFetcher(fetchMalformed).fetchJson(
      'https://api.example.com/quote',
      quoteSchema,
    );
    expect(malformedRes.ok).toBe(false);
    if (!malformedRes.ok) {
      expect(malformedRes.code).toBe('INVALID_PAYLOAD');
    }
  });

  it('parses error.message from HTTP error body even when statusText is empty (Capacitor WebView)', async () => {
    const fetchWithBodyMsg = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'Rate limit exceeded' } }), {
        status: 429,
        statusText: '',
      }),
    );
    const res1 = await createSafeFetcher(fetchWithBodyMsg).fetchJson(
      'https://api.example.com/quote',
      quoteSchema,
    );
    expect(res1).toEqual({
      ok: false,
      code: 'HTTP_ERROR',
      message: 'Rate limit exceeded',
    });

    const fetchPlainError = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('Bad Gateway', { status: 502, statusText: '' }));
    const res2 = await createSafeFetcher(fetchPlainError).fetchJson(
      'https://api.example.com/quote',
      quoteSchema,
    );
    expect(res2).toEqual({
      ok: false,
      code: 'HTTP_ERROR',
      message: 'HTTP 502',
    });
  });

  it('aborts and returns TIMEOUT when request exceeds 3000ms', async () => {
    vi.useFakeTimers();

    const hangingFetch = vi.fn<typeof fetch>((_input, init) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        });
      });
    });

    const promise = createSafeFetcher(hangingFetch).fetchJson(
      'https://api.example.com/slow',
      quoteSchema,
    );

    await vi.advanceTimersByTimeAsync(3_000);
    const result = await promise;

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('TIMEOUT');
    }
  });

  it('returns NETWORK_ERROR without throwing when fetch rejects', async () => {
    const failingFetch = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch'));

    const result = await createSafeFetcher(failingFetch).fetchJson(
      'https://api.example.com/down',
      quoteSchema,
    );

    expect(result).toEqual({
      ok: false,
      code: 'NETWORK_ERROR',
      message: 'Failed to fetch',
    });
  });
});
