export type IntegrityStatus =
  'FRESH' | 'STALE' | 'ANOMALY_BLOCKED' | 'OFFLINE_FALLBACK' | 'OFFLINE_EMPTY';

export interface TrustedSnapshot<T = unknown> {
  readonly sourceId: string;
  readonly data: T;
  readonly capturedAtMs: number;
}

export interface SourceIntegrityState<T = unknown> {
  readonly sourceId: string;
  readonly status: IntegrityStatus;
  readonly canRecommendArbitrage: boolean;
  readonly snapshot: TrustedSnapshot<T> | null;
  readonly warningReason: string | null;
  readonly lastAttemptAtMs: number;
}

export function canRecommendArbitrage(status: IntegrityStatus): boolean {
  return status === 'FRESH';
}
