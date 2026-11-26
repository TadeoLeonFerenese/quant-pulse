import { create } from 'zustand';
import { classifyFreshness, STALE_THRESHOLD_MS } from '@/domain/integrity/freshness';
import {
  canRecommendArbitrage,
  type IntegrityStatus,
  type SourceIntegrityState,
} from '@/domain/integrity/types';
import { appendTrustedTick, type PriceTick } from '@/domain/math/outlierGuard';

export interface IntegrityStoreState {
  readonly sources: Readonly<Record<string, SourceIntegrityState>>;
  readonly baselines: Readonly<Record<string, readonly PriceTick[]>>;
  recordOutcome: (state: SourceIntegrityState, acceptedTick: PriceTick | null) => void;
  refreshFreshness: (nowMs: number, staleThresholdMs?: number) => void;
  reset: () => void;
}

export const useIntegrityStore = create<IntegrityStoreState>((set) => ({
  sources: {},
  baselines: {},

  recordOutcome: (sourceState, acceptedTick) => {
    set((prev) => {
      const nextBaselines =
        acceptedTick !== null
          ? {
              ...prev.baselines,
              [sourceState.sourceId]: appendTrustedTick(
                prev.baselines[sourceState.sourceId] ?? [],
                acceptedTick,
              ),
            }
          : prev.baselines;

      return {
        sources: {
          ...prev.sources,
          [sourceState.sourceId]: sourceState,
        },
        baselines: nextBaselines,
      };
    });
  },

  refreshFreshness: (nowMs, staleThresholdMs = STALE_THRESHOLD_MS) => {
    set((prev) => {
      const nextSources: Record<string, SourceIntegrityState> = {};
      for (const [id, entry] of Object.entries(prev.sources)) {
        if (
          entry.status === 'FRESH' &&
          entry.snapshot !== null &&
          classifyFreshness(entry.snapshot.capturedAtMs, nowMs, staleThresholdMs) === 'STALE'
        ) {
          const nextStatus: IntegrityStatus = 'STALE';
          nextSources[id] = {
            ...entry,
            status: nextStatus,
            canRecommendArbitrage: canRecommendArbitrage(nextStatus),
            warningReason: 'Datos con más de 10 min: recomendaciones bloqueadas',
          };
        } else {
          nextSources[id] = entry;
        }
      }
      return { sources: nextSources };
    });
  },

  reset: () => {
    set({ sources: {}, baselines: {} });
  },
}));

export function selectCanRecommendArbitrage(state: IntegrityStoreState): boolean {
  const entries = Object.values(state.sources);
  if (entries.length === 0) {
    return false;
  }
  return entries.every((entry) => entry.canRecommendArbitrage);
}
