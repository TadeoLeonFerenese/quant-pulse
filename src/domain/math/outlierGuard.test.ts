import { describe, expect, it } from 'vitest';
import { appendTrustedTick, evaluateOutlier, type PriceTick } from './outlierGuard';

const buildBaseline = (values: readonly number[], startMs = 10_000, stepMs = 1_000): PriceTick[] =>
  values.map((value, index) => ({
    value,
    timestampMs: startMs + index * stepMs,
  }));

describe('evaluateOutlier', () => {
  it('accepts a normal tick within 4 sigma arriving in under 1 second', () => {
    // Mean = 100, variance = (0 + 4 + 4 + 1 + 1) / 5 = 2, stdDev = sqrt(2) ≈ 1.4142
    const baseline = buildBaseline([100, 102, 98, 101, 99]);
    const lastTs = 14_000;

    const result = evaluateOutlier(baseline, { value: 102, timestampMs: lastTs + 250 });

    expect(result.status).toBe('ACCEPTED');
    expect(result.reason).toBe('WITHIN_BOUNDS');
    expect(result.zScore).toBeCloseTo(2 / Math.SQRT2, 6);
  });

  it('rejects a flash outlier exceeding 4 sigma in under 1 second without mutating baseline', () => {
    const baseline = buildBaseline([100, 102, 98, 101, 99]);
    const snapshotBefore = [...baseline];

    // |107 - 100| / sqrt(2) ≈ 4.9497 > 4
    const result = evaluateOutlier(baseline, { value: 107, timestampMs: 14_500 });

    expect(result.status).toBe('REJECTED');
    expect(result.reason).toBe('OUTLIER_4SIGMA_FLASH');
    expect(result.zScore).toBeCloseTo(7 / Math.SQRT2, 6);
    expect(baseline).toEqual(snapshotBefore);
  });

  it('accepts a tick at the exact 4 sigma boundary in under 1 second', () => {
    // Values [98, 98, 102, 102, 100] -> mean = 100, variance = 16/5 = 3.2 -> use exact stdDev = 1:
    // [99, 99, 101, 101, 100, 100] -> variance = 4/6; simpler: [99, 101, 99, 101, 99, 101] -> mean=100, stdDev=1
    const baseline = buildBaseline([99, 101, 99, 101, 99, 101]);

    const result = evaluateOutlier(baseline, { value: 104, timestampMs: 15_999 });

    expect(result.status).toBe('ACCEPTED');
    expect(result.reason).toBe('WITHIN_BOUNDS');
    expect(result.zScore).toBe(4);
  });

  it('accepts a >4 sigma move when at least 1000ms elapsed (slow move, not flash glitch)', () => {
    const baseline = buildBaseline([99, 101, 99, 101, 99, 101]);

    const result = evaluateOutlier(baseline, { value: 110, timestampMs: 16_000 });

    expect(result.status).toBe('ACCEPTED');
    expect(result.reason).toBe('SLOW_MOVE');
    expect(result.zScore).toBe(10);
  });

  it('handles zero-variance baseline: accepts identical value, rejects flash jump, accepts slow jump', () => {
    const flatBaseline = buildBaseline([1200, 1200, 1200, 1200, 1200]);

    const sameFlash = evaluateOutlier(flatBaseline, { value: 1200, timestampMs: 14_100 });
    expect(sameFlash).toEqual({ status: 'ACCEPTED', reason: 'WITHIN_BOUNDS', zScore: 0 });

    const jumpFlash = evaluateOutlier(flatBaseline, { value: 1201, timestampMs: 14_100 });
    expect(jumpFlash).toEqual({
      status: 'REJECTED',
      reason: 'OUTLIER_4SIGMA_FLASH',
      zScore: Number.POSITIVE_INFINITY,
    });

    const jumpSlow = evaluateOutlier(flatBaseline, { value: 1250, timestampMs: 15_500 });
    expect(jumpSlow).toEqual({
      status: 'ACCEPTED',
      reason: 'SLOW_MOVE',
      zScore: Number.POSITIVE_INFINITY,
    });
  });

  it('rejects non-finite or non-positive candidate values and invalid timestamps', () => {
    const baseline = buildBaseline([100, 101, 99, 100, 102]);

    for (const bad of [
      { value: Number.NaN, timestampMs: 14_500 },
      { value: Number.POSITIVE_INFINITY, timestampMs: 14_500 },
      { value: 0, timestampMs: 14_500 },
      { value: -50, timestampMs: 14_500 },
      { value: 100, timestampMs: Number.NaN },
    ]) {
      expect(evaluateOutlier(baseline, bad)).toEqual({
        status: 'REJECTED',
        reason: 'NON_FINITE_OR_NON_POSITIVE',
        zScore: null,
      });
    }
  });

  it('accepts finite positive ticks during cold-start warm-up (< minBaselineSamples)', () => {
    expect(evaluateOutlier([], { value: 500, timestampMs: 1_000 })).toEqual({
      status: 'ACCEPTED',
      reason: 'WARMUP',
      zScore: null,
    });

    const shortBaseline = buildBaseline([100, 101, 99, 100]);

    const result = evaluateOutlier(shortBaseline, { value: 500, timestampMs: 13_100 });

    expect(result).toEqual({ status: 'ACCEPTED', reason: 'WARMUP', zScore: null });
  });

  it('respects custom sigmaThreshold, flashWindowMs, and minBaselineSamples options', () => {
    const baseline = buildBaseline([99, 101, 99, 101]);

    const rejected = evaluateOutlier(
      baseline,
      { value: 103, timestampMs: 13_400 },
      { minBaselineSamples: 4, sigmaThreshold: 2, flashWindowMs: 500 },
    );

    expect(rejected).toEqual({
      status: 'REJECTED',
      reason: 'OUTLIER_4SIGMA_FLASH',
      zScore: 3,
    });
  });
});

describe('appendTrustedTick', () => {
  it('appends immutably and drops oldest ticks beyond maxWindowSize', () => {
    const initial = buildBaseline([10, 20, 30]);
    const next = appendTrustedTick(initial, { value: 40, timestampMs: 13_000 }, 3);

    expect(initial).toHaveLength(3);
    expect(next.map((t) => t.value)).toEqual([20, 30, 40]);
  });

  it('keeps all ticks when within default maxWindowSize', () => {
    const initial = buildBaseline([10, 20]);
    const next = appendTrustedTick(initial, { value: 30, timestampMs: 12_000 });

    expect(next.map((t) => t.value)).toEqual([10, 20, 30]);
  });
});
