import { beforeEach, describe, expect, it } from 'vitest';
import type { FxQuoteMap } from '@/domain/macro/types';
import { selectMacroEvaluation, useMacroStore } from './useMacroStore';

const quotes: FxQuoteMap = {
  MEP: { kind: 'MEP', bid: 1190, ask: 1200, updatedAtMs: 1_000 },
  CCL: { kind: 'CCL', bid: 1210, ask: 1220, updatedAtMs: 1_000 },
  BLUE: { kind: 'BLUE', bid: 1280, ask: 1290, updatedAtMs: 1_000 },
  CRIPTO: { kind: 'CRIPTO', bid: 1245, ask: 1260, updatedAtMs: 1_000 },
};

describe('useMacroStore', () => {
  beforeEach(() => {
    useMacroStore.getState().reset();
  });

  it('returns null from selectMacroEvaluation when no quotes are loaded', () => {
    expect(selectMacroEvaluation(useMacroStore.getState(), true)).toBeNull();
  });

  it('stores quotes, caps gap history at 90 samples, switches windowDays, and respects Core 3 fail-closed gate', () => {
    const store = useMacroStore.getState();
    store.setQuotes(quotes);

    for (let i = 0; i < 95; i += 1) {
      store.appendGapSample(i % 2 === 0 ? 0.04 : 0.06, 0.05);
    }

    expect(useMacroStore.getState().blueGapHistory).toHaveLength(90);
    expect(useMacroStore.getState().criptoGapHistory).toHaveLength(90);

    store.setWindowDays(90);
    const unlocked = selectMacroEvaluation(useMacroStore.getState(), true);
    expect(unlocked?.trafficLight).toBe('OPPORTUNITY');

    const blocked = selectMacroEvaluation(useMacroStore.getState(), false);
    expect(blocked?.trafficLight).toBe('BLOCKED');
    expect(blocked?.canRecommendArbitrage).toBe(false);
  });
});
