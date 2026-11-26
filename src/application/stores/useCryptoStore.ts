import { create } from 'zustand';
import { evaluateCryptoSignal } from '@/application/crypto/evaluateCryptoSignal';
import {
  DEFAULT_CRYPTO_WATCHLIST,
  normalizeCryptoSymbol,
  type CryptoMarketSnapshot,
  type CryptoRiskEvaluation,
} from '@/domain/crypto/types';

export interface CryptoStoreState {
  readonly watchlist: readonly string[];
  readonly snapshots: Readonly<Record<string, CryptoMarketSnapshot>>;
  addSymbol: (symbol: string) => void;
  removeSymbol: (symbol: string) => void;
  setSnapshot: (snapshot: CryptoMarketSnapshot) => void;
  reset: () => void;
}

export const useCryptoStore = create<CryptoStoreState>((set) => ({
  watchlist: [...DEFAULT_CRYPTO_WATCHLIST],
  snapshots: {},

  addSymbol: (rawSymbol) => {
    const normalized = normalizeCryptoSymbol(rawSymbol);
    if (normalized.length === 0) {
      return;
    }
    set((prev) =>
      prev.watchlist.includes(normalized) ? prev : { watchlist: [...prev.watchlist, normalized] },
    );
  },

  removeSymbol: (rawSymbol) => {
    const normalized = normalizeCryptoSymbol(rawSymbol);
    set((prev) => ({
      watchlist: prev.watchlist.filter((item) => item !== normalized),
    }));
  },

  setSnapshot: (snapshot) => {
    const normalized = normalizeCryptoSymbol(snapshot.symbol);
    set((prev) => ({
      snapshots: {
        ...prev.snapshots,
        [normalized]: { ...snapshot, symbol: normalized },
      },
    }));
  },

  reset: () => {
    set({
      watchlist: [...DEFAULT_CRYPTO_WATCHLIST],
      snapshots: {},
    });
  },
}));

export function selectCryptoEvaluation(
  state: CryptoStoreState,
  rawSymbol: string,
  targetUpsidePrice: number,
  canRecommendArbitrage: boolean,
): CryptoRiskEvaluation | null {
  const normalized = normalizeCryptoSymbol(rawSymbol);
  const snapshot = state.snapshots[normalized];
  if (snapshot === undefined) {
    return null;
  }

  return evaluateCryptoSignal({
    snapshot,
    targetUpsidePrice,
    canRecommendArbitrage,
  });
}
