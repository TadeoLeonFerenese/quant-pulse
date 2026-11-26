export type MarketRegime = 'RANGE_LOW_VOL' | 'STRONG_TREND' | 'PANIC_LIQUIDATION';

export type TrendDirection = 'UP' | 'DOWN' | 'FLAT';

export interface RegimeOptions {
  readonly minPrices?: number;
  readonly panicDropThreshold?: number;
  readonly panicVolatilityThreshold?: number;
  readonly trendEfficiencyThreshold?: number;
  readonly minTrendMovePct?: number;
}

export type MarketRegimeResult =
  | { readonly status: 'INVALID_INPUT' }
  | {
      readonly status: 'INSUFFICIENT_HISTORY';
      readonly requiredSamples: number;
      readonly availableSamples: number;
    }
  | {
      readonly status: 'READY';
      readonly regime: MarketRegime;
      readonly trendDirection: TrendDirection;
      readonly volatility: number;
      readonly efficiencyRatio: number;
      readonly cumulativeReturnPct: number;
      readonly latestReturn: number;
    };

export type FundingCascadeLevel =
  'NORMAL' | 'ELEVATED' | 'CASCADE_LONG_SQUEEZE' | 'CASCADE_SHORT_SQUEEZE';

export interface FundingCascadeInput {
  readonly fundingRate: number;
  readonly openInterestChangePct: number;
  readonly extremeFundingThreshold?: number;
  readonly oiSpikeThreshold?: number;
}

export interface FundingCascadeResult {
  readonly level: FundingCascadeLevel;
  readonly fundingRate: number;
  readonly openInterestChangePct: number;
}

export interface VaRAsymmetryInput {
  readonly logReturns: readonly number[];
  readonly currentPrice: number;
  readonly targetUpsidePrice: number;
  readonly minReturns?: number;
  readonly minRewardToRisk?: number;
}

export type VaRAsymmetryResult =
  | { readonly status: 'INVALID_INPUT' }
  | {
      readonly status: 'INSUFFICIENT_HISTORY';
      readonly requiredSamples: number;
      readonly availableSamples: number;
    }
  | {
      readonly status: 'READY';
      readonly parametricVaR95: number;
      readonly parametricVaR99: number;
      readonly historicalVaR95: number;
      readonly historicalVaR99: number;
      readonly conservativeDownsideRiskPct: number;
      readonly upsideRewardPct: number;
      readonly rewardToRiskRatio: number | null;
      readonly isAsymmetricallyViable: boolean;
    };

export const DEFAULT_MIN_REGIME_PRICES = 10;
export const DEFAULT_PANIC_DROP_THRESHOLD = 0.08;
export const DEFAULT_PANIC_VOLATILITY_THRESHOLD = 0.06;
export const DEFAULT_TREND_EFFICIENCY_THRESHOLD = 0.55;
export const DEFAULT_MIN_TREND_MOVE_PCT = 0.05;
export const DEFAULT_EXTREME_FUNDING_THRESHOLD = 0.0008;
export const DEFAULT_OI_SPIKE_THRESHOLD = 0.1;
export const DEFAULT_MIN_VAR_RETURNS = 20;
export const DEFAULT_MIN_REWARD_TO_RISK = 2.5;

const Z_SCORE_95 = 1.6448536;
const Z_SCORE_99 = 2.3263479;
const FLOAT_EPSILON = 1e-12;

function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

interface StableStats {
  readonly mean: number;
  readonly stdDev: number;
}

function computeStableStats(samples: readonly number[]): StableStats {
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

export function calculateLogReturns(prices: readonly number[]): readonly number[] | null {
  if (prices.length < 2) {
    return null;
  }

  const returns: number[] = [];
  let prevPrice: number | undefined;

  for (const price of prices) {
    if (!isPositiveFinite(price)) {
      return null;
    }
    if (prevPrice !== undefined) {
      returns.push(Math.log(price / prevPrice));
    }
    prevPrice = price;
  }

  return returns;
}

export function detectMarketRegime(
  prices: readonly number[],
  options: RegimeOptions = {},
): MarketRegimeResult {
  const minPrices = options.minPrices ?? DEFAULT_MIN_REGIME_PRICES;
  const panicDropThreshold = options.panicDropThreshold ?? DEFAULT_PANIC_DROP_THRESHOLD;
  const panicVolatilityThreshold =
    options.panicVolatilityThreshold ?? DEFAULT_PANIC_VOLATILITY_THRESHOLD;
  const trendEfficiencyThreshold =
    options.trendEfficiencyThreshold ?? DEFAULT_TREND_EFFICIENCY_THRESHOLD;
  const minTrendMovePct = options.minTrendMovePct ?? DEFAULT_MIN_TREND_MOVE_PCT;

  const logReturns: number[] = [];
  let totalPath = 0;
  let firstPrice = 0;
  let lastPrice = 0;
  let latestReturn = 0;
  let prevPrice: number | undefined;

  for (const price of prices) {
    if (!isPositiveFinite(price)) {
      return { status: 'INVALID_INPUT' };
    }
    if (prevPrice === undefined) {
      firstPrice = price;
    } else {
      latestReturn = Math.log(price / prevPrice);
      logReturns.push(latestReturn);
      totalPath += Math.abs(price - prevPrice);
    }
    prevPrice = price;
    lastPrice = price;
  }

  if (prices.length < minPrices) {
    return {
      status: 'INSUFFICIENT_HISTORY',
      requiredSamples: minPrices,
      availableSamples: prices.length,
    };
  }

  const { stdDev: volatility } = computeStableStats(logReturns);
  const cumulativeReturnPct = (lastPrice - firstPrice) / firstPrice;
  const efficiencyRatio =
    totalPath <= FLOAT_EPSILON ? 0 : Math.abs(lastPrice - firstPrice) / totalPath;

  const trendDirection: TrendDirection =
    cumulativeReturnPct > FLOAT_EPSILON
      ? 'UP'
      : cumulativeReturnPct < -FLOAT_EPSILON
        ? 'DOWN'
        : 'FLAT';

  const regime: MarketRegime =
    latestReturn <= -panicDropThreshold || volatility >= panicVolatilityThreshold
      ? 'PANIC_LIQUIDATION'
      : efficiencyRatio >= trendEfficiencyThreshold &&
          Math.abs(cumulativeReturnPct) >= minTrendMovePct
        ? 'STRONG_TREND'
        : 'RANGE_LOW_VOL';

  return {
    status: 'READY',
    regime,
    trendDirection,
    volatility,
    efficiencyRatio,
    cumulativeReturnPct,
    latestReturn,
  };
}

export function evaluateFundingCascadeRisk(
  input: FundingCascadeInput,
): FundingCascadeResult | null {
  const { fundingRate, openInterestChangePct } = input;
  if (!Number.isFinite(fundingRate) || !Number.isFinite(openInterestChangePct)) {
    return null;
  }

  const extremeFunding = input.extremeFundingThreshold ?? DEFAULT_EXTREME_FUNDING_THRESHOLD;
  const oiSpike = input.oiSpikeThreshold ?? DEFAULT_OI_SPIKE_THRESHOLD;

  const isExtremeLong = fundingRate >= extremeFunding;
  const isExtremeShort = fundingRate <= -extremeFunding;
  const isOiSpike = openInterestChangePct >= oiSpike;

  const level: FundingCascadeLevel =
    isExtremeLong && isOiSpike
      ? 'CASCADE_LONG_SQUEEZE'
      : isExtremeShort && isOiSpike
        ? 'CASCADE_SHORT_SQUEEZE'
        : isExtremeLong || isExtremeShort || isOiSpike
          ? 'ELEVATED'
          : 'NORMAL';

  return { level, fundingRate, openInterestChangePct };
}

export function calculateVaRAndAsymmetry(input: VaRAsymmetryInput): VaRAsymmetryResult {
  const { logReturns, currentPrice, targetUpsidePrice } = input;
  const minReturns = input.minReturns ?? DEFAULT_MIN_VAR_RETURNS;
  const minRewardToRisk = input.minRewardToRisk ?? DEFAULT_MIN_REWARD_TO_RISK;

  if (
    !isPositiveFinite(currentPrice) ||
    !isPositiveFinite(targetUpsidePrice) ||
    !isPositiveFinite(minRewardToRisk) ||
    logReturns.some((ret) => !Number.isFinite(ret))
  ) {
    return { status: 'INVALID_INPUT' };
  }

  if (logReturns.length < minReturns) {
    return {
      status: 'INSUFFICIENT_HISTORY',
      requiredSamples: minReturns,
      availableSamples: logReturns.length,
    };
  }

  const { mean, stdDev } = computeStableStats(logReturns);
  const parametricVaR95 = Math.max(0, -(mean - Z_SCORE_95 * stdDev));
  const parametricVaR99 = Math.max(0, -(mean - Z_SCORE_99 * stdDev));

  const sorted = [...logReturns].sort((a, b) => a - b);
  const idx95 = Math.floor(0.05 * (sorted.length - 1));
  const idx99 = Math.floor(0.01 * (sorted.length - 1));
  let quantile95 = 0;
  let quantile99 = 0;
  sorted.forEach((value, index) => {
    if (index === idx95) {
      quantile95 = value;
    }
    if (index === idx99) {
      quantile99 = value;
    }
  });

  const historicalVaR95 = Math.max(0, -quantile95);
  const historicalVaR99 = Math.max(0, -quantile99);
  const conservativeDownsideRiskPct = Math.max(parametricVaR95, historicalVaR95);
  const upsideRewardPct = (targetUpsidePrice - currentPrice) / currentPrice;
  const rewardToRiskRatio =
    conservativeDownsideRiskPct > 0 ? upsideRewardPct / conservativeDownsideRiskPct : null;
  const isAsymmetricallyViable =
    rewardToRiskRatio !== null && rewardToRiskRatio > minRewardToRisk + FLOAT_EPSILON;

  return {
    status: 'READY',
    parametricVaR95,
    parametricVaR99,
    historicalVaR95,
    historicalVaR99,
    conservativeDownsideRiskPct,
    upsideRewardPct,
    rewardToRiskRatio,
    isAsymmetricallyViable,
  };
}
