import type { FxQuoteMap, MacroSignalEvaluation, MacroTrafficLight } from '@/domain/macro/types';
import {
  calculateNetCarryTrade,
  calculateRollingGapZScore,
  calculateSpreadPct,
  type CarryTradeInput,
  type RollingGapZScoreResult,
  type RollingWindowDays,
} from '@/domain/math/macroArbitrage';

export interface EvaluateMacroSignalParams {
  readonly quotes: FxQuoteMap;
  readonly carryInput: CarryTradeInput | null;
  readonly blueGapHistory: readonly number[];
  readonly criptoGapHistory: readonly number[];
  readonly windowDays: RollingWindowDays;
  readonly canRecommendArbitrage: boolean;
}

function hasConvergenceAnomaly(result: RollingGapZScoreResult): boolean {
  return result.status === 'READY' && result.signal !== 'NORMAL';
}

export function evaluateMacroSignal(params: EvaluateMacroSignalParams): MacroSignalEvaluation {
  const {
    quotes,
    carryInput,
    blueGapHistory,
    criptoGapHistory,
    windowDays,
    canRecommendArbitrage,
  } = params;

  const mepVsBlueSpreadPct = calculateSpreadPct(quotes.BLUE.ask, quotes.MEP.ask);
  const mepVsCriptoSpreadPct = calculateSpreadPct(quotes.CRIPTO.ask, quotes.MEP.ask);
  const carryTrade = carryInput !== null ? calculateNetCarryTrade(carryInput) : null;

  const blueZScore: RollingGapZScoreResult =
    mepVsBlueSpreadPct !== null
      ? calculateRollingGapZScore(blueGapHistory, mepVsBlueSpreadPct, windowDays)
      : { status: 'INVALID_INPUT' };

  const criptoZScore: RollingGapZScoreResult =
    mepVsCriptoSpreadPct !== null
      ? calculateRollingGapZScore(criptoGapHistory, mepVsCriptoSpreadPct, windowDays)
      : { status: 'INVALID_INPUT' };

  if (!canRecommendArbitrage) {
    return {
      trafficLight: 'BLOCKED',
      canRecommendArbitrage: false,
      headline: 'Recomendaciones bloqueadas por integridad de datos',
      mepVsBlueSpreadPct,
      mepVsCriptoSpreadPct,
      carryTrade,
      blueZScore,
      criptoZScore,
    };
  }

  let trafficLight: MacroTrafficLight = 'NEUTRAL';
  let headline = 'Brechas y tasa dentro de rango normal';

  if (
    hasConvergenceAnomaly(blueZScore) ||
    hasConvergenceAnomaly(criptoZScore) ||
    carryTrade?.verdict === 'FAVORS_CARRY'
  ) {
    trafficLight = 'OPPORTUNITY';
    headline =
      hasConvergenceAnomaly(blueZScore) || hasConvergenceAnomaly(criptoZScore)
        ? 'Anomalía estadística de brecha (|Z| > 2.0): oportunidad de convergencia'
        : 'Carry trade neto positivo en USD';
  } else if (carryTrade?.verdict === 'FAVORS_DOLLAR') {
    trafficLight = 'CAUTION';
    headline = 'Cobertura en dólar supera la tasa neta proyectada';
  }

  return {
    trafficLight,
    canRecommendArbitrage: true,
    headline,
    mepVsBlueSpreadPct,
    mepVsCriptoSpreadPct,
    carryTrade,
    blueZScore,
    criptoZScore,
  };
}
