export type RateSpec =
  | { readonly kind: 'TNA'; readonly annualRate: number }
  | { readonly kind: 'TEA'; readonly annualRate: number };

export interface CarryTradeInput {
  readonly capitalArs: number;
  readonly rate: RateSpec;
  readonly horizonDays: number;
  readonly entryUsdRate: number;
  readonly projectedExitUsdRate: number;
  readonly brokerFeeRate: number;
  readonly slippageRate: number;
}

export type CarryTradeVerdict = 'FAVORS_CARRY' | 'FAVORS_DOLLAR' | 'NEUTRAL';

export interface CarryTradeResult {
  readonly initialUsd: number;
  readonly periodYieldPct: number;
  readonly grossArsAtMaturity: number;
  readonly netArsAtMaturity: number;
  readonly finalUsd: number;
  readonly netProfitArs: number;
  readonly netProfitUsd: number;
  readonly netReturnUsdPct: number;
  readonly breakEvenExitUsdRate: number;
  readonly verdict: CarryTradeVerdict;
}

export type RollingWindowDays = 30 | 90;

export type GapConvergenceSignal = 'NORMAL' | 'PREMIUM_ANOMALY' | 'DISCOUNT_ANOMALY';

export type RollingGapZScoreResult =
  | { readonly status: 'INVALID_INPUT' }
  | {
      readonly status: 'INSUFFICIENT_HISTORY';
      readonly requiredSamples: RollingWindowDays;
      readonly availableSamples: number;
    }
  | {
      readonly status: 'READY';
      readonly windowDays: RollingWindowDays;
      readonly mean: number;
      readonly stdDev: number;
      readonly zScore: number;
      readonly signal: GapConvergenceSignal;
      readonly reversionProbability: number;
    };

export const DAYS_PER_YEAR = 365;
export const CARRY_NEUTRAL_BAND = 0.001;
export const DEFAULT_CONVERGENCE_Z_THRESHOLD = 2.0;
const FLOAT_EPSILON = 1e-12;

interface SampleStats {
  readonly mean: number;
  readonly stdDev: number;
}

/**
 * Welford's numerically stable one-pass population mean and standard deviation.
 * Prevents IEEE-754 accumulation drift on constant/low-variance series.
 */
function computeStableStats(samples: readonly number[]): SampleStats {
  let mean = 0;
  let m2 = 0;
  let count = 0;

  for (const sample of samples) {
    count += 1;
    const delta = sample - mean;
    mean += delta / count;
    const delta2 = sample - mean;
    m2 += delta * delta2;
  }

  const rawStdDev = Math.sqrt(m2 / count);
  return {
    mean,
    stdDev: rawStdDev <= FLOAT_EPSILON ? 0 : rawStdDev,
  };
}

function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

/**
 * Pure Abramowitz & Stegun (7.1.26) error function approximation for x >= 0.
 * Maximum absolute error < 1.5e-7.
 */
function erfNonNegative(x: number): number {
  if (x === 0) {
    return 0;
  }
  if (!Number.isFinite(x)) {
    return 1;
  }
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const t = 1 / (1 + p * x);
  const poly = ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t;
  return 1 - poly * Math.exp(-x * x);
}

export function calculateImplicitDollar(arsBondPrice: number, usdBondPrice: number): number | null {
  if (!isPositiveFinite(arsBondPrice) || !isPositiveFinite(usdBondPrice)) {
    return null;
  }
  return arsBondPrice / usdBondPrice;
}

export function calculateSpreadPct(targetRate: number, baseRate: number): number | null {
  if (!isPositiveFinite(targetRate) || !isPositiveFinite(baseRate)) {
    return null;
  }
  return (targetRate - baseRate) / baseRate;
}

export function calculateNetCarryTrade(input: CarryTradeInput): CarryTradeResult | null {
  const {
    capitalArs,
    rate,
    horizonDays,
    entryUsdRate,
    projectedExitUsdRate,
    brokerFeeRate,
    slippageRate,
  } = input;

  if (
    !isPositiveFinite(capitalArs) ||
    !isPositiveFinite(horizonDays) ||
    !isPositiveFinite(entryUsdRate) ||
    !isPositiveFinite(projectedExitUsdRate) ||
    !Number.isFinite(rate.annualRate) ||
    rate.annualRate <= -1 ||
    !Number.isFinite(brokerFeeRate) ||
    brokerFeeRate < 0 ||
    !Number.isFinite(slippageRate) ||
    slippageRate < 0 ||
    brokerFeeRate + slippageRate >= 1
  ) {
    return null;
  }

  const yearFraction = horizonDays / DAYS_PER_YEAR;
  const periodYieldPct =
    rate.kind === 'TNA'
      ? rate.annualRate * yearFraction
      : Math.pow(1 + rate.annualRate, yearFraction) - 1;

  const initialUsd = capitalArs / entryUsdRate;
  const grossArsAtMaturity = capitalArs * (1 + periodYieldPct);
  const frictionMultiplier = 1 - (brokerFeeRate + slippageRate);
  const netArsAtMaturity = grossArsAtMaturity * frictionMultiplier;
  const finalUsd = netArsAtMaturity / projectedExitUsdRate;
  const netProfitArs = netArsAtMaturity - capitalArs;
  const netProfitUsd = finalUsd - initialUsd;
  const netReturnUsdPct = netProfitUsd / initialUsd;
  const breakEvenExitUsdRate = entryUsdRate * (1 + periodYieldPct) * frictionMultiplier;

  const verdict: CarryTradeVerdict =
    netReturnUsdPct > CARRY_NEUTRAL_BAND
      ? 'FAVORS_CARRY'
      : netReturnUsdPct < -CARRY_NEUTRAL_BAND
        ? 'FAVORS_DOLLAR'
        : 'NEUTRAL';

  return {
    initialUsd,
    periodYieldPct,
    grossArsAtMaturity,
    netArsAtMaturity,
    finalUsd,
    netProfitArs,
    netProfitUsd,
    netReturnUsdPct,
    breakEvenExitUsdRate,
    verdict,
  };
}

export function calculateRollingGapZScore(
  historicalGaps: readonly number[],
  currentGap: number,
  windowDays: RollingWindowDays,
  zThreshold = DEFAULT_CONVERGENCE_Z_THRESHOLD,
): RollingGapZScoreResult {
  if (!Number.isFinite(currentGap) || !isPositiveFinite(zThreshold)) {
    return { status: 'INVALID_INPUT' };
  }

  if (historicalGaps.length < windowDays) {
    return {
      status: 'INSUFFICIENT_HISTORY',
      requiredSamples: windowDays,
      availableSamples: historicalGaps.length,
    };
  }

  const window = historicalGaps.slice(-windowDays);
  if (window.some((sample) => !Number.isFinite(sample))) {
    return { status: 'INVALID_INPUT' };
  }

  const { mean, stdDev } = computeStableStats(window);

  const zScore =
    stdDev === 0
      ? Math.abs(currentGap - mean) <= FLOAT_EPSILON
        ? 0
        : currentGap > mean
          ? Number.POSITIVE_INFINITY
          : Number.NEGATIVE_INFINITY
      : (currentGap - mean) / stdDev;

  const signal: GapConvergenceSignal =
    zScore > zThreshold + FLOAT_EPSILON
      ? 'PREMIUM_ANOMALY'
      : zScore < -(zThreshold + FLOAT_EPSILON)
        ? 'DISCOUNT_ANOMALY'
        : 'NORMAL';

  const reversionProbability = erfNonNegative(Math.abs(zScore) / Math.SQRT2);

  return {
    status: 'READY',
    windowDays,
    mean,
    stdDev,
    zScore,
    signal,
    reversionProbability,
  };
}
