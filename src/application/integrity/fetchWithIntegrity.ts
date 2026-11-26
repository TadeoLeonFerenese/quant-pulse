import { classifyFreshness, STALE_THRESHOLD_MS } from '@/domain/integrity/freshness';
import type { HttpFetcherPort, SafeParseSchema, SnapshotCachePort } from '@/domain/integrity/ports';
import {
  canRecommendArbitrage,
  type IntegrityStatus,
  type SourceIntegrityState,
  type TrustedSnapshot,
} from '@/domain/integrity/types';
import {
  evaluateOutlier,
  type OutlierGuardOptions,
  type PriceTick,
} from '@/domain/math/outlierGuard';

export interface FetchWithIntegrityParams<T> {
  readonly sourceId: string;
  readonly url: string;
  readonly schema: SafeParseSchema<T>;
  readonly extractPrice: (data: T) => number;
  readonly baseline: readonly PriceTick[];
  readonly fetcher: HttpFetcherPort;
  readonly cache: SnapshotCachePort;
  readonly now?: () => number;
  readonly timeoutMs?: number;
  readonly staleThresholdMs?: number;
  readonly outlierOptions?: OutlierGuardOptions;
}

export interface FetchWithIntegrityOutcome<T> {
  readonly state: SourceIntegrityState<T>;
  readonly acceptedTick: PriceTick | null;
}

export async function fetchWithIntegrity<T>(
  params: FetchWithIntegrityParams<T>,
): Promise<FetchWithIntegrityOutcome<T>> {
  const nowMs = (params.now ?? Date.now)();
  const staleThresholdMs = params.staleThresholdMs ?? STALE_THRESHOLD_MS;
  const fetchResult = await params.fetcher.fetchJson(params.url, params.schema, params.timeoutMs);

  if (fetchResult.ok) {
    const candidateTick: PriceTick = {
      value: params.extractPrice(fetchResult.data),
      timestampMs: nowMs,
    };
    const guardResult = evaluateOutlier(params.baseline, candidateTick, params.outlierOptions);

    if (guardResult.status === 'REJECTED') {
      const cached = await params.cache.get<T>(params.sourceId);
      const status: IntegrityStatus = 'ANOMALY_BLOCKED';
      const warningReason =
        guardResult.reason === 'OUTLIER_4SIGMA_FLASH'
          ? 'Anomalía estadística (>4σ en <1s): recomendaciones bloqueadas'
          : 'Valor corrupto o no positivo: recomendaciones bloqueadas';

      return {
        state: {
          sourceId: params.sourceId,
          status,
          canRecommendArbitrage: canRecommendArbitrage(status),
          snapshot: cached,
          warningReason,
          lastAttemptAtMs: nowMs,
        },
        acceptedTick: null,
      };
    }

    const snapshot: TrustedSnapshot<T> = {
      sourceId: params.sourceId,
      data: fetchResult.data,
      capturedAtMs: nowMs,
    };
    await params.cache.set(snapshot);
    const status: IntegrityStatus = 'FRESH';

    return {
      state: {
        sourceId: params.sourceId,
        status,
        canRecommendArbitrage: canRecommendArbitrage(status),
        snapshot,
        warningReason: null,
        lastAttemptAtMs: nowMs,
      },
      acceptedTick: candidateTick,
    };
  }

  const cached = await params.cache.get<T>(params.sourceId);
  if (cached !== null) {
    const freshness = classifyFreshness(cached.capturedAtMs, nowMs, staleThresholdMs);
    const status: IntegrityStatus = freshness === 'STALE' ? 'STALE' : 'OFFLINE_FALLBACK';
    const warningReason =
      status === 'STALE'
        ? `Sin conexión (${fetchResult.code}) · datos con más de 10 min`
        : `Sin conexión (${fetchResult.code}) · usando última foto confiable`;

    return {
      state: {
        sourceId: params.sourceId,
        status,
        canRecommendArbitrage: canRecommendArbitrage(status),
        snapshot: cached,
        warningReason,
        lastAttemptAtMs: nowMs,
      },
      acceptedTick: null,
    };
  }

  const status: IntegrityStatus = 'OFFLINE_EMPTY';
  return {
    state: {
      sourceId: params.sourceId,
      status,
      canRecommendArbitrage: canRecommendArbitrage(status),
      snapshot: null,
      warningReason: `Sin conexión (${fetchResult.code}): ${fetchResult.message}`,
      lastAttemptAtMs: nowMs,
    },
    acceptedTick: null,
  };
}
