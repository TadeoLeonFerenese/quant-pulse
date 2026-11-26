import type {
  CryptoMarketSnapshot,
  CryptoRiskEvaluation,
  CryptoSignalLevel,
} from '@/domain/crypto/types';
import {
  calculateLogReturns,
  calculateVaRAndAsymmetry,
  detectMarketRegime,
  evaluateFundingCascadeRisk,
  type VaRAsymmetryResult,
} from '@/domain/math/cryptoRisk';

export interface EvaluateCryptoSignalParams {
  readonly snapshot: CryptoMarketSnapshot;
  readonly targetUpsidePrice: number;
  readonly canRecommendArbitrage: boolean;
}

export function evaluateCryptoSignal(params: EvaluateCryptoSignalParams): CryptoRiskEvaluation {
  const { snapshot, targetUpsidePrice, canRecommendArbitrage } = params;
  const regime = detectMarketRegime(snapshot.dailyCloses);
  const fundingCascade = evaluateFundingCascadeRisk({
    fundingRate: snapshot.fundingRate,
    openInterestChangePct: snapshot.openInterestChangePct,
  });

  const logReturns = calculateLogReturns(snapshot.dailyCloses);
  const varAsymmetry: VaRAsymmetryResult =
    logReturns !== null
      ? calculateVaRAndAsymmetry({
          logReturns,
          currentPrice: snapshot.markPrice,
          targetUpsidePrice,
        })
      : { status: 'INVALID_INPUT' };

  if (!canRecommendArbitrage) {
    return {
      symbol: snapshot.symbol,
      signal: 'BLOCKED',
      canRecommendArbitrage: false,
      headline: `${snapshot.symbol}: recomendaciones bloqueadas por integridad de datos`,
      regime,
      fundingCascade,
      varAsymmetry,
    };
  }

  let signal: CryptoSignalLevel = 'WAIT';
  let headline = `${snapshot.symbol}: esperar mejor asimetría (> 2.5:1)`;

  if (regime.status === 'READY' && regime.regime === 'PANIC_LIQUIDATION') {
    signal = 'EXIT_PANIC';
    headline = `${snapshot.symbol}: régimen de pánico / liquidación masiva`;
  } else if (
    fundingCascade !== null &&
    (fundingCascade.level === 'CASCADE_LONG_SQUEEZE' ||
      fundingCascade.level === 'CASCADE_SHORT_SQUEEZE')
  ) {
    signal = 'CASCADE_WARNING';
    headline = `${snapshot.symbol}: alerta de liquidación en cascada (funding + OI extremos)`;
  } else if (varAsymmetry.status === 'READY' && varAsymmetry.isAsymmetricallyViable) {
    signal = 'VIABLE_ENTRY';
    headline = `${snapshot.symbol}: entrada asimétrica viable (R:R > 2.5:1)`;
  }

  return {
    symbol: snapshot.symbol,
    signal,
    canRecommendArbitrage: true,
    headline,
    regime,
    fundingCascade,
    varAsymmetry,
  };
}
