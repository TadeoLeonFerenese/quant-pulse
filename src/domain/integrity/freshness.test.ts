import { describe, expect, it } from 'vitest';
import { classifyFreshness, STALE_THRESHOLD_MS } from './freshness';
import { canRecommendArbitrage, type IntegrityStatus } from './types';

describe('classifyFreshness', () => {
  it('defines the stale threshold as exactly 10 minutes (600,000 ms)', () => {
    expect(STALE_THRESHOLD_MS).toBe(600_000);
  });

  it('returns FRESH at 0ms, at exact 10-minute boundary, and when clock is slightly behind', () => {
    expect(classifyFreshness(1_000_000, 1_000_000)).toBe('FRESH');
    expect(classifyFreshness(1_000_000, 1_600_000)).toBe('FRESH');
    expect(classifyFreshness(1_000_000, 999_500)).toBe('FRESH');
  });

  it('returns STALE strictly past the 10-minute boundary', () => {
    expect(classifyFreshness(1_000_000, 1_600_001)).toBe('STALE');
  });

  it('supports a custom staleThresholdMs', () => {
    expect(classifyFreshness(1000, 6000, 5000)).toBe('FRESH');
    expect(classifyFreshness(1000, 6001, 5000)).toBe('STALE');
  });
});

describe('canRecommendArbitrage (strict fail-closed)', () => {
  it('returns true ONLY for FRESH status', () => {
    expect(canRecommendArbitrage('FRESH')).toBe(true);
  });

  it('returns false for every non-FRESH status', () => {
    const blockedStatuses: readonly IntegrityStatus[] = [
      'STALE',
      'ANOMALY_BLOCKED',
      'OFFLINE_FALLBACK',
      'OFFLINE_EMPTY',
    ];

    for (const status of blockedStatuses) {
      expect(canRecommendArbitrage(status)).toBe(false);
    }
  });
});
