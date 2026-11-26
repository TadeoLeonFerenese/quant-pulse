export const STALE_THRESHOLD_MS = 10 * 60 * 1_000;

export function classifyFreshness(
  capturedAtMs: number,
  nowMs: number,
  staleThresholdMs = STALE_THRESHOLD_MS,
): 'FRESH' | 'STALE' {
  return nowMs - capturedAtMs > staleThresholdMs ? 'STALE' : 'FRESH';
}
