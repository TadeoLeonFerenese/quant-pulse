import { describe, expect, it } from 'vitest';
import {
  calculateLogReturns,
  calculateVaRAndAsymmetry,
  DEFAULT_MIN_REWARD_TO_RISK,
  detectMarketRegime,
  evaluateFundingCascadeRisk,
} from './cryptoRisk';

describe('calculateLogReturns', () => {
  it('computes natural log returns for valid positive price series', () => {
    const returns = calculateLogReturns([100, 110, 110]);
    expect(returns).not.toBeNull();
    if (!returns) return;
    expect(returns).toHaveLength(2);
    expect(returns[0]).toBeCloseTo(Math.log(1.1), 8);
    expect(returns[1]).toBe(0);
  });

  it('returns null for short (<2), zero, negative, or non-finite prices', () => {
    expect(calculateLogReturns([100])).toBeNull();
    expect(calculateLogReturns([100, 0, 110])).toBeNull();
    expect(calculateLogReturns([100, -5])).toBeNull();
    expect(calculateLogReturns([100, Number.NaN])).toBeNull();
  });
});

describe('detectMarketRegime', () => {
  it('classifies steady directional rise and decline as STRONG_TREND with correct trendDirection', () => {
    const uptrend = [1.0, 1.01, 1.02, 1.03, 1.04, 1.05, 1.06, 1.07, 1.08, 1.1];
    const upRes = detectMarketRegime(uptrend);
    expect(upRes.status).toBe('READY');
    if (upRes.status === 'READY') {
      expect(upRes.regime).toBe('STRONG_TREND');
      expect(upRes.trendDirection).toBe('UP');
      expect(upRes.efficiencyRatio).toBeCloseTo(1, 6);
    }

    const downtrend = [1.1, 1.08, 1.07, 1.06, 1.05, 1.04, 1.03, 1.02, 1.01, 1.0];
    const downRes = detectMarketRegime(downtrend);
    expect(downRes.status).toBe('READY');
    if (downRes.status === 'READY') {
      expect(downRes.regime).toBe('STRONG_TREND');
      expect(downRes.trendDirection).toBe('DOWN');
    }
  });

  it('classifies tight oscillating or completely flat series as RANGE_LOW_VOL', () => {
    const rangePrices = [0.6, 0.605, 0.598, 0.604, 0.599, 0.603, 0.6, 0.602, 0.599, 0.601];
    const rangeRes = detectMarketRegime(rangePrices);
    expect(rangeRes.status).toBe('READY');
    if (rangeRes.status === 'READY') {
      expect(rangeRes.regime).toBe('RANGE_LOW_VOL');
    }

    const flatPrices = Array.from({ length: 10 }, () => 0.5);
    const flatRes = detectMarketRegime(flatPrices);
    expect(flatRes.status).toBe('READY');
    if (flatRes.status === 'READY') {
      expect(flatRes.regime).toBe('RANGE_LOW_VOL');
      expect(flatRes.trendDirection).toBe('FLAT');
      expect(flatRes.efficiencyRatio).toBe(0);
      expect(flatRes.volatility).toBe(0);
    }
  });

  it('classifies sharp single-period crash or extreme volatility as PANIC_LIQUIDATION', () => {
    const crashPrices = [1.0, 1.01, 1.0, 1.01, 1.0, 1.01, 1.0, 1.01, 1.0, 0.88];
    const crashRes = detectMarketRegime(crashPrices);
    expect(crashRes.status).toBe('READY');
    if (crashRes.status === 'READY') {
      expect(crashRes.regime).toBe('PANIC_LIQUIDATION');
    }

    const chaoticVol = [1.0, 1.1, 0.96, 1.08, 0.94, 1.07, 0.95, 1.06, 0.96, 1.05];
    const volRes = detectMarketRegime(chaoticVol);
    expect(volRes.status).toBe('READY');
    if (volRes.status === 'READY') {
      expect(volRes.regime).toBe('PANIC_LIQUIDATION');
    }
  });

  it('returns INSUFFICIENT_HISTORY or INVALID_INPUT safely', () => {
    expect(detectMarketRegime([1, 2, 3])).toEqual({
      status: 'INSUFFICIENT_HISTORY',
      requiredSamples: 10,
      availableSamples: 3,
    });
    expect(detectMarketRegime([1, 2, 0, 4, 5, 6, 7, 8, 9, 10])).toEqual({
      status: 'INVALID_INPUT',
    });
  });
});

describe('evaluateFundingCascadeRisk', () => {
  it('flags CASCADE_LONG_SQUEEZE and CASCADE_SHORT_SQUEEZE when extreme funding aligns with OI spike', () => {
    expect(evaluateFundingCascadeRisk({ fundingRate: 0.001, openInterestChangePct: 0.14 })).toEqual(
      {
        level: 'CASCADE_LONG_SQUEEZE',
        fundingRate: 0.001,
        openInterestChangePct: 0.14,
      },
    );

    expect(
      evaluateFundingCascadeRisk({ fundingRate: -0.0012, openInterestChangePct: 0.12 }),
    ).toEqual({
      level: 'CASCADE_SHORT_SQUEEZE',
      fundingRate: -0.0012,
      openInterestChangePct: 0.12,
    });
  });

  it('flags ELEVATED on single-factor pressure, NORMAL when calm, and null on non-finite input', () => {
    expect(
      evaluateFundingCascadeRisk({ fundingRate: 0.001, openInterestChangePct: 0.02 })?.level,
    ).toBe('ELEVATED');
    expect(
      evaluateFundingCascadeRisk({ fundingRate: -0.001, openInterestChangePct: 0.01 })?.level,
    ).toBe('ELEVATED');
    expect(
      evaluateFundingCascadeRisk({ fundingRate: 0.0001, openInterestChangePct: 0.15 })?.level,
    ).toBe('ELEVATED');
    expect(
      evaluateFundingCascadeRisk({ fundingRate: 0.0001, openInterestChangePct: 0.02 })?.level,
    ).toBe('NORMAL');
    expect(
      evaluateFundingCascadeRisk({ fundingRate: Number.NaN, openInterestChangePct: 0.05 }),
    ).toBeNull();
  });
});

describe('calculateVaRAndAsymmetry', () => {
  // 20 daily log returns with mean ≈ 0, moderate downside tail (-0.04 worst, -0.035 second)
  const sampleReturns = [
    -0.04, -0.035, -0.02, -0.015, -0.01, -0.008, -0.005, -0.003, -0.002, 0.0, 0.001, 0.003, 0.005,
    0.008, 0.01, 0.012, 0.015, 0.02, 0.025, 0.03,
  ];

  it('uses 2.5 as default minimum R:R ratio', () => {
    expect(DEFAULT_MIN_REWARD_TO_RISK).toBe(2.5);
  });

  it('computes parametric & historical VaR 95/99 and marks R:R > 2.5:1 as viable', () => {
    const result = calculateVaRAndAsymmetry({
      logReturns: sampleReturns,
      currentPrice: 0.6,
      targetUpsidePrice: 0.72, // +20% upside vs ~4% VaR95 -> R:R ≈ 5.0 > 2.5
    });

    expect(result.status).toBe('READY');
    if (result.status !== 'READY') return;

    expect(result.parametricVaR99).toBeGreaterThanOrEqual(result.parametricVaR95);
    expect(result.historicalVaR99).toBeGreaterThanOrEqual(result.historicalVaR95);
    expect(result.conservativeDownsideRiskPct).toBe(
      Math.max(result.parametricVaR95, result.historicalVaR95),
    );
    expect(result.upsideRewardPct).toBeCloseTo(0.2, 6);
    expect(result.rewardToRiskRatio).not.toBeNull();
    expect(result.rewardToRiskRatio ?? 0).toBeGreaterThan(2.5);
    expect(result.isAsymmetricallyViable).toBe(true);
  });

  it('rejects viability when upside R:R <= 2.5 or when conservative downside risk is 0', () => {
    const weakUpside = calculateVaRAndAsymmetry({
      logReturns: sampleReturns,
      currentPrice: 0.6,
      targetUpsidePrice: 0.63, // +5% upside vs ~4% risk -> R:R ≈ 1.25
    });
    expect(weakUpside.status).toBe('READY');
    if (weakUpside.status === 'READY') {
      expect(weakUpside.isAsymmetricallyViable).toBe(false);
    }

    const allPositive = Array.from({ length: 20 }, () => 0.01);
    const zeroRisk = calculateVaRAndAsymmetry({
      logReturns: allPositive,
      currentPrice: 1,
      targetUpsidePrice: 1.2,
    });
    expect(zeroRisk.status).toBe('READY');
    if (zeroRisk.status === 'READY') {
      expect(zeroRisk.conservativeDownsideRiskPct).toBe(0);
      expect(zeroRisk.rewardToRiskRatio).toBeNull();
      expect(zeroRisk.isAsymmetricallyViable).toBe(false);
    }
  });

  it('returns INSUFFICIENT_HISTORY or INVALID_INPUT safely', () => {
    expect(
      calculateVaRAndAsymmetry({
        logReturns: [0.01, -0.01],
        currentPrice: 1,
        targetUpsidePrice: 1.2,
      }),
    ).toEqual({
      status: 'INSUFFICIENT_HISTORY',
      requiredSamples: 20,
      availableSamples: 2,
    });

    expect(
      calculateVaRAndAsymmetry({
        logReturns: sampleReturns,
        currentPrice: 0,
        targetUpsidePrice: 1.2,
      }),
    ).toEqual({ status: 'INVALID_INPUT' });

    expect(
      calculateVaRAndAsymmetry({
        logReturns: [...sampleReturns.slice(0, 19), Number.NaN],
        currentPrice: 1,
        targetUpsidePrice: 1.2,
      }),
    ).toEqual({ status: 'INVALID_INPUT' });
  });
});
