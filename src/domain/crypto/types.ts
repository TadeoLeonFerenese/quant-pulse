import type {
  FundingCascadeResult,
  MarketRegimeResult,
  VaRAsymmetryResult,
} from '@/domain/math/cryptoRisk';

export const DEFAULT_CRYPTO_WATCHLIST: readonly string[] = [
  'BTC',
  'ETH',
  'SOL',
  'ADA',
  'BNB',
  'XRP',
  'LINK',
];

export function normalizeCryptoSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

export function toBinanceUsdtPair(symbol: string): string {
  return `${normalizeCryptoSymbol(symbol)}USDT`;
}

export interface CryptoMarketSnapshot {
  readonly symbol: string;
  readonly pair: string;
  readonly markPrice: number;
  readonly fundingRate: number;
  readonly openInterest: number;
  readonly openInterestChangePct: number;
  readonly dailyCloses: readonly number[];
  readonly capturedAtMs: number;
}

export type CryptoSignalLevel =
  'VIABLE_ENTRY' | 'WAIT' | 'CASCADE_WARNING' | 'EXIT_PANIC' | 'BLOCKED';

export interface CryptoRiskEvaluation {
  readonly symbol: string;
  readonly signal: CryptoSignalLevel;
  readonly canRecommendArbitrage: boolean;
  readonly headline: string;
  readonly regime: MarketRegimeResult;
  readonly fundingCascade: FundingCascadeResult | null;
  readonly varAsymmetry: VaRAsymmetryResult;
}
