import { describe, expect, it } from 'vitest';
import type { FxQuoteMap } from '@/domain/macro/types';
import { evaluateMacroSignal } from './evaluateMacroSignal';

const quotes: FxQuoteMap = {
  MEP: { kind: 'MEP', bid: 1190, ask: 1200, updatedAtMs: 1_000 },
  CCL: { kind: 'CCL', bid: 1210, ask: 1220, updatedAtMs: 1_000 },
  BLUE: { kind: 'BLUE', bid: 1280, ask: 1290, updatedAtMs: 1_000 }, // +7.5% vs MEP ask
  CRIPTO: { kind: 'CRIPTO', bid: 1245, ask: 1260, updatedAtMs: 1_000 }, // +5.0% vs MEP ask
};

const alternatingHistory30 = Array.from({ length: 30 }, (_, idx) => (idx % 2 === 0 ? 0.04 : 0.06));

describe('evaluateMacroSignal', () => {
  it('forces BLOCKED whenever Core 3 canRecommendArbitrage is false, even with Z > 2.5 and profitable carry', () => {
    const result = evaluateMacroSignal({
      quotes,
      carryInput: {
        capitalArs: 1_200_000,
        rate: { kind: 'TNA', annualRate: 0.48 },
        horizonDays: 30,
        entryUsdRate: 1_200,
        projectedExitUsdRate: 1_210,
        brokerFeeRate: 0.01,
        slippageRate: 0.002,
      },
      blueGapHistory: alternatingHistory30,
      criptoGapHistory: alternatingHistory30,
      windowDays: 30,
      canRecommendArbitrage: false,
    });

    expect(result.trafficLight).toBe('BLOCKED');
    expect(result.canRecommendArbitrage).toBe(false);
    expect(result.blueZScore.status).toBe('READY');
    expect(result.carryTrade?.verdict).toBe('FAVORS_CARRY');
  });

  it('returns OPPORTUNITY when Core 3 is FRESH and gap Z-Score triggers convergence anomaly', () => {
    const result = evaluateMacroSignal({
      quotes,
      carryInput: null,
      blueGapHistory: alternatingHistory30,
      criptoGapHistory: alternatingHistory30,
      windowDays: 30,
      canRecommendArbitrage: true,
    });

    expect(result.trafficLight).toBe('OPPORTUNITY');
    expect(result.canRecommendArbitrage).toBe(true);
    expect(result.mepVsBlueSpreadPct).toBeCloseTo(0.075, 6);
    expect(result.blueZScore.status).toBe('READY');
    if (result.blueZScore.status === 'READY') {
      expect(result.blueZScore.signal).toBe('PREMIUM_ANOMALY');
    }
  });

  it('returns CAUTION when carry trade favors dollar and no convergence anomaly is active', () => {
    const calmQuotes: FxQuoteMap = {
      ...quotes,
      BLUE: { kind: 'BLUE', bid: 1250, ask: 1260, updatedAtMs: 1_000 }, // +5% (Z=0)
    };

    const result = evaluateMacroSignal({
      quotes: calmQuotes,
      carryInput: {
        capitalArs: 1_200_000,
        rate: { kind: 'TEA', annualRate: 0.35 },
        horizonDays: 30,
        entryUsdRate: 1_200,
        projectedExitUsdRate: 1_270,
        brokerFeeRate: 0.015,
        slippageRate: 0.005,
      },
      blueGapHistory: alternatingHistory30,
      criptoGapHistory: alternatingHistory30,
      windowDays: 30,
      canRecommendArbitrage: true,
    });

    expect(result.trafficLight).toBe('CAUTION');
    expect(result.carryTrade?.verdict).toBe('FAVORS_DOLLAR');
  });

  it('returns NEUTRAL when no anomaly exists and carry is absent or neutral', () => {
    const calmQuotes: FxQuoteMap = {
      ...quotes,
      BLUE: { kind: 'BLUE', bid: 1250, ask: 1260, updatedAtMs: 1_000 },
    };

    const result = evaluateMacroSignal({
      quotes: calmQuotes,
      carryInput: null,
      blueGapHistory: [],
      criptoGapHistory: [],
      windowDays: 30,
      canRecommendArbitrage: true,
    });

    expect(result.trafficLight).toBe('NEUTRAL');
    expect(result.blueZScore.status).toBe('INSUFFICIENT_HISTORY');
  });
});
