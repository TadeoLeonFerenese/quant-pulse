import { beforeEach, describe, expect, it } from 'vitest';
import type { CryptoMarketSnapshot } from '@/domain/crypto/types';
import { selectCryptoEvaluation, useCryptoStore } from './useCryptoStore';

const adaSnapshot: CryptoMarketSnapshot = {
  symbol: 'ADA',
  pair: 'ADAUSDT',
  markPrice: 0.6,
  fundingRate: 0.0001,
  openInterest: 200_000_000,
  openInterestChangePct: 0.02,
  dailyCloses: [
    0.58, 0.585, 0.582, 0.586, 0.584, 0.588, 0.585, 0.589, 0.587, 0.59, 0.588, 0.591, 0.589, 0.593,
    0.59, 0.594, 0.592, 0.595, 0.593, 0.596, 0.595, 0.6,
  ],
  capturedAtMs: 1_700_000_000_000,
};

describe('useCryptoStore', () => {
  beforeEach(() => {
    useCryptoStore.getState().reset();
  });

  it('initializes with ADA and major cryptos in default watchlist and supports adding/removing symbols', () => {
    const initial = useCryptoStore.getState().watchlist;
    expect(initial).toContain('BTC');
    expect(initial).toContain('ETH');
    expect(initial).toContain('SOL');
    expect(initial).toContain('ADA');

    useCryptoStore.getState().addSymbol(' avax ');
    useCryptoStore.getState().addSymbol('ADA'); // duplicate ignored
    expect(useCryptoStore.getState().watchlist).toContain('AVAX');
    expect(useCryptoStore.getState().watchlist.filter((s) => s === 'ADA')).toHaveLength(1);

    useCryptoStore.getState().removeSymbol('AVAX');
    expect(useCryptoStore.getState().watchlist).not.toContain('AVAX');
  });

  it('evaluates stored ADA snapshot and respects Core 3 fail-closed gate', () => {
    expect(selectCryptoEvaluation(useCryptoStore.getState(), 'ADA', 0.78, true)).toBeNull();

    useCryptoStore.getState().setSnapshot(adaSnapshot);

    const unlocked = selectCryptoEvaluation(useCryptoStore.getState(), 'ada', 0.78, true);
    expect(unlocked?.signal).toBe('VIABLE_ENTRY');

    const blocked = selectCryptoEvaluation(useCryptoStore.getState(), 'ADA', 0.78, false);
    expect(blocked?.signal).toBe('BLOCKED');
    expect(blocked?.canRecommendArbitrage).toBe(false);
  });
});
