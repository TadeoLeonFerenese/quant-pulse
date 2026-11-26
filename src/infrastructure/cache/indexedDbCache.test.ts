import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { InMemorySnapshotCache } from './inMemoryCache';
import { IndexedDbSnapshotCache } from './indexedDbCache';

describe('IndexedDbSnapshotCache', () => {
  it('persists, reads, and overwrites trusted snapshots by sourceId', async () => {
    const cache = new IndexedDbSnapshotCache(`quant-pulse-test-${String(Date.now())}`);

    expect(await cache.get<{ price: number }>('dolar-mep')).toBeNull();

    await cache.set({
      sourceId: 'dolar-mep',
      data: { price: 1180 },
      capturedAtMs: 1_700_000_000_000,
    });
    expect(await cache.get<{ price: number }>('dolar-mep')).toEqual({
      sourceId: 'dolar-mep',
      data: { price: 1180 },
      capturedAtMs: 1_700_000_000_000,
    });

    await cache.set({
      sourceId: 'dolar-mep',
      data: { price: 1195 },
      capturedAtMs: 1_700_000_005_000,
    });
    expect(await cache.get<{ price: number }>('dolar-mep')).toEqual({
      sourceId: 'dolar-mep',
      data: { price: 1195 },
      capturedAtMs: 1_700_000_005_000,
    });
  });

  it('degrades gracefully without throwing when indexedDB is unavailable', async () => {
    const cache = new IndexedDbSnapshotCache('unavailable-db', null);

    await expect(
      cache.set({ sourceId: 'btc', data: { price: 90_000 }, capturedAtMs: 100 }),
    ).resolves.toBeUndefined();
    await expect(cache.get('btc')).resolves.toBeNull();
  });
});

describe('InMemorySnapshotCache', () => {
  it('stores and retrieves snapshots in memory', async () => {
    const cache = new InMemorySnapshotCache();

    expect(await cache.get('binance-btc')).toBeNull();
    await cache.set({ sourceId: 'binance-btc', data: { price: 95_000 }, capturedAtMs: 5_000 });
    expect(await cache.get<{ price: number }>('binance-btc')).toEqual({
      sourceId: 'binance-btc',
      data: { price: 95_000 },
      capturedAtMs: 5_000,
    });
  });
});
