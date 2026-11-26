import type { CarryTradeResult, RollingGapZScoreResult } from '@/domain/math/macroArbitrage';

export type DollarKind = 'MEP' | 'CCL' | 'BLUE' | 'CRIPTO';

export interface FxQuote {
  readonly kind: DollarKind;
  readonly bid: number;
  readonly ask: number;
  readonly updatedAtMs: number;
}

export type FxQuoteMap = Readonly<Record<DollarKind, FxQuote>>;

export type MacroTrafficLight = 'OPPORTUNITY' | 'NEUTRAL' | 'CAUTION' | 'BLOCKED';

export interface MacroSignalEvaluation {
  readonly trafficLight: MacroTrafficLight;
  readonly canRecommendArbitrage: boolean;
  readonly headline: string;
  readonly mepVsBlueSpreadPct: number | null;
  readonly mepVsCriptoSpreadPct: number | null;
  readonly carryTrade: CarryTradeResult | null;
  readonly blueZScore: RollingGapZScoreResult;
  readonly criptoZScore: RollingGapZScoreResult;
}
