import { describe, expect, it, vi } from 'vitest';
import { createSafeFetcher } from '@/infrastructure/http/safeFetch';
import { fetchBinanceCryptoSnapshot } from './binanceClient';

const makeKline = (close: string, idx: number) => [
  1_700_000_000_000 + idx * 86_400_000,
  close,
  close,
  close,
  close,
  '1000',
  1_700_000_000_000 + (idx + 1) * 86_400_000,
  '1000',
  10,
  '500',
  '500',
  '0',
];

describe('fetchBinanceCryptoSnapshot', () => {
  it('fetches and parses ADAUSDT public premiumIndex, openInterest, and daily klines without API keys', async () => {
    const fetchSpy = vi.fn<typeof fetch>((input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

      if (url.includes('/fapi/v1/premiumIndex?symbol=ADAUSDT')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              symbol: 'ADAUSDT',
              markPrice: '0.6250',
              lastFundingRate: '0.00015',
              nextFundingTime: 1_700_028_800_000,
              time: 1_700_000_000_000,
            }),
            { status: 200 },
          ),
        );
      }
      if (url.includes('/fapi/v1/openInterest?symbol=ADAUSDT')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              symbol: 'ADAUSDT',
              openInterest: '245000000.5',
              time: 1_700_000_000_000,
            }),
            { status: 200 },
          ),
        );
      }
      if (url.includes('/api/v3/klines?symbol=ADAUSDT')) {
        const klines = Array.from({ length: 25 }, (_, i) =>
          makeKline((0.58 + i * 0.002).toFixed(4), i),
        );
        return Promise.resolve(new Response(JSON.stringify(klines), { status: 200 }));
      }
      return Promise.resolve(new Response('Not found', { status: 404 }));
    });

    const result = await fetchBinanceCryptoSnapshot('ada', createSafeFetcher(fetchSpy));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.symbol).toBe('ADA');
    expect(result.data.pair).toBe('ADAUSDT');
    expect(result.data.markPrice).toBe(0.625);
    expect(result.data.fundingRate).toBe(0.00015);
    expect(result.data.openInterest).toBe(245_000_000.5);
    expect(result.data.dailyCloses).toHaveLength(25);
    expect(result.data.dailyCloses[0]).toBe(0.58);
  });

  it('rejects malformed string numbers as INVALID_PAYLOAD and propagates upstream errors cleanly', async () => {
    const badNumberFetch = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            symbol: 'ADAUSDT',
            markPrice: 'NaN',
            lastFundingRate: '0.0001',
            nextFundingTime: 1_700_028_800_000,
            time: 1_700_000_000_000,
          }),
          { status: 200 },
        ),
      ),
    );

    const badRes = await fetchBinanceCryptoSnapshot('ADA', createSafeFetcher(badNumberFetch));
    expect(badRes.ok).toBe(false);
    if (!badRes.ok) {
      expect(badRes.code).toBe('INVALID_PAYLOAD');
    }

    const downFetch = vi.fn<typeof fetch>(() => Promise.reject(new TypeError('Offline')));
    const downRes = await fetchBinanceCryptoSnapshot('BTC', createSafeFetcher(downFetch));
    expect(downRes.ok).toBe(false);
    if (!downRes.ok) {
      expect(downRes.code).toBe('NETWORK_ERROR');
    }
  });
});
