export interface PriceTick {
  readonly value: number;
  readonly timestampMs: number;
}

export interface OutlierGuardOptions {
  readonly sigmaThreshold?: number;
  readonly flashWindowMs?: number;
  readonly minBaselineSamples?: number;
}

export type OutlierCheckResult =
  | {
      readonly status: 'ACCEPTED';
      readonly zScore: number | null;
      readonly reason: 'WARMUP' | 'WITHIN_BOUNDS' | 'SLOW_MOVE';
    }
  | {
      readonly status: 'REJECTED';
      readonly zScore: number | null;
      readonly reason: 'NON_FINITE_OR_NON_POSITIVE' | 'OUTLIER_4SIGMA_FLASH';
    };

export const DEFAULT_SIGMA_THRESHOLD = 4;
export const DEFAULT_FLASH_WINDOW_MS = 1_000;
export const DEFAULT_MIN_BASELINE_SAMPLES = 5;
export const DEFAULT_MAX_WINDOW_SIZE = 90;

function computeZScore(baseline: readonly PriceTick[], value: number): number {
  const mean = baseline.reduce((sum, tick) => sum + tick.value, 0) / baseline.length;
  const variance =
    baseline.reduce((sum, tick) => {
      const diff = tick.value - mean;
      return sum + diff * diff;
    }, 0) / baseline.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) {
    return value === mean ? 0 : Number.POSITIVE_INFINITY;
  }

  return Math.abs(value - mean) / stdDev;
}

export function evaluateOutlier(
  baseline: readonly PriceTick[],
  candidate: PriceTick,
  options: OutlierGuardOptions = {},
): OutlierCheckResult {
  if (
    !Number.isFinite(candidate.value) ||
    candidate.value <= 0 ||
    !Number.isFinite(candidate.timestampMs)
  ) {
    return { status: 'REJECTED', zScore: null, reason: 'NON_FINITE_OR_NON_POSITIVE' };
  }

  const minBaselineSamples = options.minBaselineSamples ?? DEFAULT_MIN_BASELINE_SAMPLES;
  const lastTick = baseline.at(-1);

  if (lastTick === undefined || baseline.length < minBaselineSamples) {
    return { status: 'ACCEPTED', zScore: null, reason: 'WARMUP' };
  }

  const sigmaThreshold = options.sigmaThreshold ?? DEFAULT_SIGMA_THRESHOLD;
  const flashWindowMs = options.flashWindowMs ?? DEFAULT_FLASH_WINDOW_MS;
  const zScore = computeZScore(baseline, candidate.value);
  const deltaMs = candidate.timestampMs - lastTick.timestampMs;

  if (deltaMs >= flashWindowMs) {
    return { status: 'ACCEPTED', zScore, reason: 'SLOW_MOVE' };
  }

  if (zScore > sigmaThreshold) {
    return { status: 'REJECTED', zScore, reason: 'OUTLIER_4SIGMA_FLASH' };
  }

  return { status: 'ACCEPTED', zScore, reason: 'WITHIN_BOUNDS' };
}

export function appendTrustedTick(
  window: readonly PriceTick[],
  tick: PriceTick,
  maxWindowSize = DEFAULT_MAX_WINDOW_SIZE,
): readonly PriceTick[] {
  const next = [...window, tick];
  return next.length > maxWindowSize ? next.slice(next.length - maxWindowSize) : next;
}
