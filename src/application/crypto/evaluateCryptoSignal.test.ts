import { describe, expect, it } from 'vitest';
import type { CryptoMarketSnapshot } from '@/domain/crypto/types';
import { evaluateCryptoSignal } from './evaluateCryptoSignal';

const calmCloses = [
  0.58, 0.585, 0.582, 0.586, 0.584, 0.588, 0.585, 0.589, 0.587, 0.59, 0.588, 0.591, 0.589, 0.593,
  0.59, 0.594, 0.592, 0.595, 0.593, 0.596, 0.595, 0.6,
];

const baseAdaSnapshot: CryptoMarketSnapshot = {
  symbol: 'ADA',
  pair: 'ADAUSDT',
  markPrice: 0.6,
  fundingRate: 0.0001,
  openInterest: 200_000_000,
  openInterestChangePct: 0.02,
  dailyCloses: calmCloses,
  capturedAtMs: 1_700_000_000_000,
};

describe('evaluateCryptoSignal', () => {
  it('forces BLOCKED whenever Core 3 canRecommendArbitrage is false, even on a viable ADA setup', () => {
    const result = evaluateCryptoSignal({
      snapshot: baseAdaSnapshot,
      targetUpsidePrice: 0.78,
      canRecommendArbitrage: false,
    });

    expect(result.signal).toBe('BLOCKED');
    expect(result.canRecommendArbitrage).toBe(false);
  });

  it('returns VIABLE_ENTRY when Core 3 is FRESH, regime is non-panic, funding is calm, and R:R > 2.5', () => {
    const result = evaluateCryptoSignal({
      snapshot: baseAdaSnapshot,
      targetUpsidePrice: 0.78,
      canRecommendArbitrage: true,
    });

    expect(result.signal).toBe('VIABLE_ENTRY');
    expect(result.canRecommendArbitrage).toBe(true);
    expect(result.varAsymmetry.status).toBe('READY');
    if (result.varAsymmetry.status === 'READY') {
      expect(result.varAsymmetry.isAsymmetricallyViable).toBe(true);
    }
  });

  it('returns EXIT_PANIC on PANIC_LIQUIDATION regime and CASCADE_WARNING on funding+OI squeeze', () => {
    const panicSnapshot: CryptoMarketSnapshot = {
      ...baseAdaSnapshot,
      dailyCloses: [...calmCloses.slice(0, -1), 0.5],
      markPrice: 0.5,
    };
    expect(
      evaluateCryptoSignal({
        snapshot: panicSnapshot,
        targetUpsidePrice: 0.7,
        canRecommendArbitrage: true,
      }).signal,
    ).toBe('EXIT_PANIC');

    const squeezeSnapshot: CryptoMarketSnapshot = {
      ...baseAdaSnapshot,
      fundingRate: 0.0012,
      openInterestChangePct: 0.16,
    };
    expect(
      evaluateCryptoSignal({
        snapshot: squeezeSnapshot,
        targetUpsidePrice: 0.78,
        canRecommendArbitrage: true,
      }).signal,
    ).toBe('CASCADE_WARNING');
  });

  it('returns WAIT when R:R does not clear 2.5:1 under normal conditions', () => {
    const result = evaluateCryptoSignal({
      snapshot: baseAdaSnapshot,
      targetUpsidePrice: 0.605,
      canRecommendArbitrage: true,
    });

    expect(result.signal).toBe('WAIT');
  });
});
