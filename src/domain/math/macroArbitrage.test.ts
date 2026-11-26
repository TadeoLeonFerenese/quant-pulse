import { describe, expect, it } from 'vitest';
import {
  calculateImplicitDollar,
  calculateNetCarryTrade,
  calculateRollingGapZScore,
  calculateSpreadPct,
  DEFAULT_CONVERGENCE_Z_THRESHOLD,
} from './macroArbitrage';

describe('calculateImplicitDollar', () => {
  it('computes ARS/USD bond ratio for AL30/GD30 MEP and CCL', () => {
    expect(calculateImplicitDollar(60_000, 50)).toBe(1_200);
    expect(calculateImplicitDollar(62_500, 50)).toBe(1_250);
  });

  it('returns null for zero, negative, or non-finite inputs', () => {
    expect(calculateImplicitDollar(0, 50)).toBeNull();
    expect(calculateImplicitDollar(60_000, 0)).toBeNull();
    expect(calculateImplicitDollar(-10, 50)).toBeNull();
    expect(calculateImplicitDollar(Number.NaN, 50)).toBeNull();
    expect(calculateImplicitDollar(60_000, Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe('calculateSpreadPct', () => {
  it('computes positive, negative, and zero percentage spreads', () => {
    expect(calculateSpreadPct(1_260, 1_200)).toBeCloseTo(0.05, 8);
    expect(calculateSpreadPct(1_140, 1_200)).toBeCloseTo(-0.05, 8);
    expect(calculateSpreadPct(1_200, 1_200)).toBe(0);
  });

  it('returns null for invalid rates', () => {
    expect(calculateSpreadPct(1_260, 0)).toBeNull();
    expect(calculateSpreadPct(-100, 1_200)).toBeNull();
    expect(calculateSpreadPct(Number.NaN, 1_200)).toBeNull();
  });
});

describe('calculateNetCarryTrade', () => {
  it('computes net TNA carry trade deducting broker fees + slippage and exact breakEvenExitUsdRate', () => {
    const result = calculateNetCarryTrade({
      capitalArs: 1_200_000,
      rate: { kind: 'TNA', annualRate: 0.48 },
      horizonDays: 30,
      entryUsdRate: 1_200,
      projectedExitUsdRate: 1_210,
      brokerFeeRate: 0.01,
      slippageRate: 0.002,
    });

    expect(result).not.toBeNull();
    if (!result) return;

    const expectedPeriodYield = 0.48 * (30 / 365);
    const expectedNetArs = 1_200_000 * (1 + expectedPeriodYield) * (1 - 0.012);
    const expectedFinalUsd = expectedNetArs / 1_210;
    const expectedBreakEven = 1_200 * (1 + expectedPeriodYield) * (1 - 0.012);

    expect(result.initialUsd).toBe(1_000);
    expect(result.periodYieldPct).toBeCloseTo(expectedPeriodYield, 8);
    expect(result.netArsAtMaturity).toBeCloseTo(expectedNetArs, 6);
    expect(result.finalUsd).toBeCloseTo(expectedFinalUsd, 6);
    expect(result.netProfitUsd).toBeCloseTo(expectedFinalUsd - 1_000, 6);
    expect(result.netReturnUsdPct).toBeGreaterThan(0.01);
    expect(result.breakEvenExitUsdRate).toBeCloseTo(expectedBreakEven, 6);
    expect(result.verdict).toBe('FAVORS_CARRY');

    // Algebraic identity: exiting at breakEvenExitUsdRate yields ~0 net USD return
    const atBreakEven = calculateNetCarryTrade({
      capitalArs: 1_200_000,
      rate: { kind: 'TNA', annualRate: 0.48 },
      horizonDays: 30,
      entryUsdRate: 1_200,
      projectedExitUsdRate: result.breakEvenExitUsdRate,
      brokerFeeRate: 0.01,
      slippageRate: 0.002,
    });
    expect(atBreakEven?.netProfitUsd).toBeCloseTo(0, 8);
    expect(atBreakEven?.verdict).toBe('NEUTRAL');
  });

  it('computes TEA carry trade and flags FAVORS_DOLLAR when FX rise + friction exceed yield', () => {
    const result = calculateNetCarryTrade({
      capitalArs: 1_000_000,
      rate: { kind: 'TEA', annualRate: 0.4 },
      horizonDays: 30,
      entryUsdRate: 1_000,
      projectedExitUsdRate: 1_050,
      brokerFeeRate: 0.015,
      slippageRate: 0.005,
    });

    expect(result).not.toBeNull();
    if (!result) return;

    const expectedTeaPeriod = Math.pow(1.4, 30 / 365) - 1;
    expect(result.periodYieldPct).toBeCloseTo(expectedTeaPeriod, 8);
    expect(result.netReturnUsdPct).toBeLessThan(-0.02);
    expect(result.verdict).toBe('FAVORS_DOLLAR');
  });

  it('returns null for invalid capital, horizon, rates, or friction >= 100%', () => {
    const base = {
      capitalArs: 100_000,
      rate: { kind: 'TNA' as const, annualRate: 0.4 },
      horizonDays: 30,
      entryUsdRate: 1_200,
      projectedExitUsdRate: 1_210,
      brokerFeeRate: 0.01,
      slippageRate: 0.002,
    };

    expect(calculateNetCarryTrade({ ...base, capitalArs: 0 })).toBeNull();
    expect(calculateNetCarryTrade({ ...base, horizonDays: -5 })).toBeNull();
    expect(calculateNetCarryTrade({ ...base, entryUsdRate: 0 })).toBeNull();
    expect(calculateNetCarryTrade({ ...base, projectedExitUsdRate: Number.NaN })).toBeNull();
    expect(calculateNetCarryTrade({ ...base, rate: { kind: 'TEA', annualRate: -1 } })).toBeNull();
    expect(calculateNetCarryTrade({ ...base, brokerFeeRate: -0.01 })).toBeNull();
    expect(calculateNetCarryTrade({ ...base, slippageRate: -0.01 })).toBeNull();
    expect(calculateNetCarryTrade({ ...base, brokerFeeRate: 0.6, slippageRate: 0.4 })).toBeNull();
  });
});

describe('calculateRollingGapZScore', () => {
  const alternatingGaps = (count: number): number[] =>
    Array.from({ length: count }, (_, idx) => (idx % 2 === 0 ? 0.04 : 0.06));
  // mean = 0.05, stdDev = 0.01

  it('uses 2.0 as default convergence Z threshold', () => {
    expect(DEFAULT_CONVERGENCE_Z_THRESHOLD).toBe(2.0);
  });

  it('emits PREMIUM_ANOMALY when Z > 2.0 on 30d window with accurate normal CDF reversion probability', () => {
    const history = alternatingGaps(35); // slices last 30
    const result = calculateRollingGapZScore(history, 0.075, 30);

    expect(result.status).toBe('READY');
    if (result.status !== 'READY') return;

    expect(result.windowDays).toBe(30);
    expect(result.mean).toBeCloseTo(0.05, 8);
    expect(result.stdDev).toBeCloseTo(0.01, 8);
    expect(result.zScore).toBeCloseTo(2.5, 6);
    expect(result.signal).toBe('PREMIUM_ANOMALY');
    // Two-tailed normal probability for |Z| = 2.5 is ~0.98758
    expect(result.reversionProbability).toBeCloseTo(0.98758, 4);
  });

  it('emits DISCOUNT_ANOMALY when Z < -2.0 on 90d window and NORMAL within [-2.0, 2.0]', () => {
    const history90 = alternatingGaps(90);

    const discount = calculateRollingGapZScore(history90, 0.025, 90);
    expect(discount.status).toBe('READY');
    if (discount.status === 'READY') {
      expect(discount.zScore).toBeCloseTo(-2.5, 6);
      expect(discount.signal).toBe('DISCOUNT_ANOMALY');
      expect(discount.reversionProbability).toBeGreaterThan(0.954);
    }

    const exactBoundary = calculateRollingGapZScore(history90, 0.07, 90);
    expect(exactBoundary.status).toBe('READY');
    if (exactBoundary.status === 'READY') {
      expect(exactBoundary.zScore).toBeCloseTo(2.0, 6);
      expect(exactBoundary.signal).toBe('NORMAL');
    }
  });

  it('returns INSUFFICIENT_HISTORY when fewer than windowDays samples exist', () => {
    const shortHistory = alternatingGaps(29);

    expect(calculateRollingGapZScore(shortHistory, 0.08, 30)).toEqual({
      status: 'INSUFFICIENT_HISTORY',
      requiredSamples: 30,
      availableSamples: 29,
    });
  });

  it('handles zero-variance flat history safely for equal, higher, and lower currentGap', () => {
    const flat30 = Array.from({ length: 30 }, () => 0.05);

    const equalRes = calculateRollingGapZScore(flat30, 0.05, 30);
    expect(equalRes).toEqual({
      status: 'READY',
      windowDays: 30,
      mean: 0.05,
      stdDev: 0,
      zScore: 0,
      signal: 'NORMAL',
      reversionProbability: 0,
    });

    const highRes = calculateRollingGapZScore(flat30, 0.06, 30);
    expect(highRes.status).toBe('READY');
    if (highRes.status === 'READY') {
      expect(highRes.zScore).toBe(Number.POSITIVE_INFINITY);
      expect(highRes.signal).toBe('PREMIUM_ANOMALY');
      expect(highRes.reversionProbability).toBe(1);
    }

    const lowRes = calculateRollingGapZScore(flat30, 0.04, 30);
    expect(lowRes.status).toBe('READY');
    if (lowRes.status === 'READY') {
      expect(lowRes.zScore).toBe(Number.NEGATIVE_INFINITY);
      expect(lowRes.signal).toBe('DISCOUNT_ANOMALY');
      expect(lowRes.reversionProbability).toBe(1);
    }
  });

  it('returns INVALID_INPUT for non-finite currentGap, threshold, or historical sample', () => {
    const valid30 = alternatingGaps(30);
    expect(calculateRollingGapZScore(valid30, Number.NaN, 30)).toEqual({ status: 'INVALID_INPUT' });
    expect(calculateRollingGapZScore(valid30, 0.05, 30, 0)).toEqual({ status: 'INVALID_INPUT' });

    const poisoned = [...alternatingGaps(29), Number.NaN];
    expect(calculateRollingGapZScore(poisoned, 0.05, 30)).toEqual({ status: 'INVALID_INPUT' });
  });
});
