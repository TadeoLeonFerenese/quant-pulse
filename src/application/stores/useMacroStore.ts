import { create } from 'zustand';
import { evaluateMacroSignal } from '@/application/macro/evaluateMacroSignal';
import type { FxQuoteMap, MacroSignalEvaluation } from '@/domain/macro/types';
import type { CarryTradeInput, RollingWindowDays } from '@/domain/math/macroArbitrage';

const MAX_GAP_HISTORY = 90;

export interface MacroStoreState {
  readonly quotes: FxQuoteMap | null;
  readonly blueGapHistory: readonly number[];
  readonly criptoGapHistory: readonly number[];
  readonly windowDays: RollingWindowDays;
  readonly carryInput: CarryTradeInput | null;
  setQuotes: (quotes: FxQuoteMap) => void;
  appendGapSample: (blueGap: number, criptoGap: number) => void;
  setWindowDays: (windowDays: RollingWindowDays) => void;
  setCarryInput: (carryInput: CarryTradeInput | null) => void;
  reset: () => void;
}

function appendBounded(history: readonly number[], value: number): readonly number[] {
  const next = [...history, value];
  return next.length > MAX_GAP_HISTORY ? next.slice(next.length - MAX_GAP_HISTORY) : next;
}

export const useMacroStore = create<MacroStoreState>((set) => ({
  quotes: null,
  blueGapHistory: [],
  criptoGapHistory: [],
  windowDays: 30,
  carryInput: null,

  setQuotes: (quotes) => {
    set({ quotes });
  },

  appendGapSample: (blueGap, criptoGap) => {
    set((prev) => ({
      blueGapHistory: appendBounded(prev.blueGapHistory, blueGap),
      criptoGapHistory: appendBounded(prev.criptoGapHistory, criptoGap),
    }));
  },

  setWindowDays: (windowDays) => {
    set({ windowDays });
  },

  setCarryInput: (carryInput) => {
    set({ carryInput });
  },

  reset: () => {
    set({
      quotes: null,
      blueGapHistory: [],
      criptoGapHistory: [],
      windowDays: 30,
      carryInput: null,
    });
  },
}));

export function selectMacroEvaluation(
  state: MacroStoreState,
  canRecommendArbitrage: boolean,
): MacroSignalEvaluation | null {
  if (state.quotes === null) {
    return null;
  }

  return evaluateMacroSignal({
    quotes: state.quotes,
    carryInput: state.carryInput,
    blueGapHistory: state.blueGapHistory,
    criptoGapHistory: state.criptoGapHistory,
    windowDays: state.windowDays,
    canRecommendArbitrage,
  });
}
