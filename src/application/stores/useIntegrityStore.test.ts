import { beforeEach, describe, expect, it } from 'vitest';
import { STALE_THRESHOLD_MS } from '@/domain/integrity/freshness';
import { selectCanRecommendArbitrage, useIntegrityStore } from './useIntegrityStore';

describe('useIntegrityStore', () => {
  beforeEach(() => {
    useIntegrityStore.getState().reset();
  });

  it('blocks arbitrage recommendations when no sources have been verified yet', () => {
    expect(selectCanRecommendArbitrage(useIntegrityStore.getState())).toBe(false);
  });

  it('unlocks arbitrage only when ALL tracked sources are FRESH and records trusted ticks only', () => {
    const store = useIntegrityStore.getState();

    store.recordOutcome(
      {
        sourceId: 'dolar-mep',
        status: 'FRESH',
        canRecommendArbitrage: true,
        snapshot: { sourceId: 'dolar-mep', data: { price: 1180 }, capturedAtMs: 1_000 },
        warningReason: null,
        lastAttemptAtMs: 1_000,
      },
      { value: 1180, timestampMs: 1_000 },
    );
    expect(selectCanRecommendArbitrage(useIntegrityStore.getState())).toBe(true);
    expect(useIntegrityStore.getState().baselines['dolar-mep']).toEqual([
      { value: 1180, timestampMs: 1_000 },
    ]);

    store.recordOutcome(
      {
        sourceId: 'binance-btc',
        status: 'ANOMALY_BLOCKED',
        canRecommendArbitrage: false,
        snapshot: null,
        warningReason: 'Outlier >4σ',
        lastAttemptAtMs: 1_200,
      },
      null,
    );

    expect(selectCanRecommendArbitrage(useIntegrityStore.getState())).toBe(false);
    expect(useIntegrityStore.getState().baselines['binance-btc']).toBeUndefined();
  });

  it('transitions FRESH sources to STALE and locks arbitrage when refreshFreshness passes 10 minutes', () => {
    useIntegrityStore.getState().recordOutcome(
      {
        sourceId: 'dolar-mep',
        status: 'FRESH',
        canRecommendArbitrage: true,
        snapshot: { sourceId: 'dolar-mep', data: { price: 1180 }, capturedAtMs: 10_000 },
        warningReason: null,
        lastAttemptAtMs: 10_000,
      },
      { value: 1180, timestampMs: 10_000 },
    );

    useIntegrityStore.getState().refreshFreshness(10_000 + STALE_THRESHOLD_MS + 1);

    const updated = useIntegrityStore.getState().sources['dolar-mep'];
    expect(updated?.status).toBe('STALE');
    expect(updated?.canRecommendArbitrage).toBe(false);
    expect(selectCanRecommendArbitrage(useIntegrityStore.getState())).toBe(false);
  });
});
