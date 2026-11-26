import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { STALE_THRESHOLD_MS } from '@/domain/integrity/freshness';
import type { FetchResult, HttpFetcherPort } from '@/domain/integrity/ports';
import type { PriceTick } from '@/domain/math/outlierGuard';
import { InMemorySnapshotCache } from '@/infrastructure/cache/inMemoryCache';
import { fetchWithIntegrity } from './fetchWithIntegrity';

const quoteSchema = z.object({ price: z.number() });
type Quote = z.infer<typeof quoteSchema>;

const makeFetcher = (outcome: FetchResult<Quote>): HttpFetcherPort => ({
  fetchJson: <T>() => Promise.resolve(outcome as FetchResult<T>),
});

const baseline: readonly PriceTick[] = [
  { value: 99, timestampMs: 1_000 },
  { value: 101, timestampMs: 2_000 },
  { value: 99, timestampMs: 3_000 },
  { value: 101, timestampMs: 4_000 },
  { value: 99, timestampMs: 5_000 },
  { value: 101, timestampMs: 6_000 },
];

describe('fetchWithIntegrity', () => {
  it('persists snapshot, returns FRESH, and unlocks arbitrage on valid accepted response', async () => {
    const cache = new InMemorySnapshotCache();

    const outcome = await fetchWithIntegrity({
      sourceId: 'dolar-mep',
      url: 'https://dolarapi.com/v1/dolares/bolsa',
      schema: quoteSchema,
      extractPrice: (q) => q.price,
      baseline,
      fetcher: makeFetcher({ ok: true, data: { price: 102 } }),
      cache,
      now: () => 6_400,
    });

    expect(outcome.state.status).toBe('FRESH');
    expect(outcome.state.canRecommendArbitrage).toBe(true);
    expect(outcome.state.snapshot).toEqual({
      sourceId: 'dolar-mep',
      data: { price: 102 },
      capturedAtMs: 6_400,
    });
    expect(outcome.acceptedTick).toEqual({ value: 102, timestampMs: 6_400 });
    expect(await cache.get<Quote>('dolar-mep')).toEqual(outcome.state.snapshot);
  });

  it('blocks arbitrage, preserves prior cache, and returns ANOMALY_BLOCKED on >4 sigma flash outlier', async () => {
    const cache = new InMemorySnapshotCache();
    await cache.set({ sourceId: 'dolar-mep', data: { price: 101 }, capturedAtMs: 6_000 });

    const outcome = await fetchWithIntegrity({
      sourceId: 'dolar-mep',
      url: 'https://dolarapi.com/v1/dolares/bolsa',
      schema: quoteSchema,
      extractPrice: (q) => q.price,
      baseline,
      fetcher: makeFetcher({ ok: true, data: { price: 150 } }),
      cache,
      now: () => 6_300,
    });

    expect(outcome.state.status).toBe('ANOMALY_BLOCKED');
    expect(outcome.state.canRecommendArbitrage).toBe(false);
    expect(outcome.state.warningReason).toContain('4σ');
    expect(outcome.state.snapshot).toEqual({
      sourceId: 'dolar-mep',
      data: { price: 101 },
      capturedAtMs: 6_000,
    });
    expect(outcome.acceptedTick).toBeNull();
    expect(await cache.get<Quote>('dolar-mep')).toEqual({
      sourceId: 'dolar-mep',
      data: { price: 101 },
      capturedAtMs: 6_000,
    });
  });

  it('falls back to cached snapshot as OFFLINE_FALLBACK (<=10m) and blocks arbitrage when network fails', async () => {
    const cache = new InMemorySnapshotCache();
    await cache.set({ sourceId: 'binance-btc', data: { price: 100 }, capturedAtMs: 10_000 });

    const outcome = await fetchWithIntegrity({
      sourceId: 'binance-btc',
      url: 'https://api.binance.com/api/v3/ticker/price',
      schema: quoteSchema,
      extractPrice: (q) => q.price,
      baseline,
      fetcher: makeFetcher({ ok: false, code: 'TIMEOUT', message: 'Request timed out' }),
      cache,
      now: () => 10_000 + STALE_THRESHOLD_MS,
    });

    expect(outcome.state.status).toBe('OFFLINE_FALLBACK');
    expect(outcome.state.canRecommendArbitrage).toBe(false);
    expect(outcome.state.snapshot?.data).toEqual({ price: 100 });
    expect(outcome.acceptedTick).toBeNull();
  });

  it('marks cached fallback as STALE (>10m) and blocks arbitrage when network fails', async () => {
    const cache = new InMemorySnapshotCache();
    await cache.set({ sourceId: 'binance-btc', data: { price: 100 }, capturedAtMs: 10_000 });

    const outcome = await fetchWithIntegrity({
      sourceId: 'binance-btc',
      url: 'https://api.binance.com/api/v3/ticker/price',
      schema: quoteSchema,
      extractPrice: (q) => q.price,
      baseline,
      fetcher: makeFetcher({ ok: false, code: 'NETWORK_ERROR', message: 'Offline' }),
      cache,
      now: () => 10_000 + STALE_THRESHOLD_MS + 1,
    });

    expect(outcome.state.status).toBe('STALE');
    expect(outcome.state.canRecommendArbitrage).toBe(false);
    expect(outcome.state.snapshot?.data).toEqual({ price: 100 });
  });

  it('returns OFFLINE_EMPTY without throwing when network fails and no cache exists', async () => {
    const cache = new InMemorySnapshotCache();

    const outcome = await fetchWithIntegrity({
      sourceId: 'ambito-blue',
      url: 'https://mercados.ambito.com/dolar/informal/variacion',
      schema: quoteSchema,
      extractPrice: (q) => q.price,
      baseline: [],
      fetcher: makeFetcher({ ok: false, code: 'NETWORK_ERROR', message: 'DNS failure' }),
      cache,
      now: () => 50_000,
    });

    expect(outcome.state.status).toBe('OFFLINE_EMPTY');
    expect(outcome.state.canRecommendArbitrage).toBe(false);
    expect(outcome.state.snapshot).toBeNull();
    expect(outcome.acceptedTick).toBeNull();
  });
});
