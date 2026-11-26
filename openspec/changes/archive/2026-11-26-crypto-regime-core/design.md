# Design: Crypto Regime & Probabilistic Risk Core (Core 2)

## Technical Approach

Implement Core 2 inside-out under **Strict TDD** with zero new dependencies, reusing Core 3 (`safeFetch`, `canRecommendArbitrage`) and our Welford numerical stability pattern (`pattern/welford-rolling-stats`). All math lives in `src/domain/math/cryptoRisk.ts` (100/100/100/100% coverage), types in `src/domain/crypto/types.ts`, public Binance REST Zod parsing in `src/infrastructure/feeds/binanceClient.ts`, and fail-closed signal evaluation + extensible watchlist store in `src/application/`.

## Architecture Decisions

| Topic | Options Considered | Tradeoff | Decision |
|---|---|---|---|
| Regime algorithm | Kaufman ER + Welford vol + tail shock vs ADX/ATR indicators | ER + log-return vol needs only close prices, has zero lag warmup bloat, maps cleanly to all 3 regimes | **Kaufman ER + Welford σ + tail drop** |
| VaR downside band | `max(parametricVaR95, historicalVaR95)` vs parametric only | Crypto returns are fat-tailed; taking `max` prevents false positive R:R entries | **Conservative `max(param95, hist95)`** |
| Watchlist model | Extensible `string` symbols (`DEFAULT_CRYPTO_WATCHLIST` incl. `ADA`) vs closed 3-coin union | User explicitly requested `ADA` + multiple cryptos | **Extensible normalized uppercase symbols; default `['BTC','ETH','SOL','ADA','BNB','XRP','LINK']`** |
| Binance client | Public REST (`premiumIndex` + `openInterest` + `klines`) via Core 3 `safeFetch` vs Binance SDK | Zero API keys, zero new deps, inherits 3s timeout & HTTPS enforcement | **Pure `safeFetch` + Zod schemas** |

## Data Flow

```
  [Binance Public HTTPS: fapi premiumIndex, fapi openInterest, api klines]
          │  safeFetch (3s timeout + Zod string→number schemas)
          ▼
  binanceClient.ts (infrastructure) ──► CryptoMarketSnapshot (per symbol, e.g. ADA)
          │
          ▼ + canRecommendArbitrage (Core 3)
  evaluateCryptoSignal.ts (application)
          ├─► detectMarketRegime()         (domain/math — 100% cov)
          ├─► evaluateFundingCascadeRisk() (domain/math — 100% cov)
          └─► calculateVaRAndAsymmetry()   (domain/math — 100% cov)
          │
          ▼ CryptoRiskEvaluation (BLOCKED if !canRecommendArbitrage)
  useCryptoStore.ts (extensible watchlist incl. ADA + pure selector)
```

## File Changes

| File | Action | Description |
|---|---|---|
| `src/domain/math/cryptoRisk.ts` | Create | `calculateLogReturns`, `detectMarketRegime`, `evaluateFundingCascadeRisk`, `calculateVaRAndAsymmetry` (100% cov) |
| `src/domain/math/cryptoRisk.test.ts` | Create | Exhaustive unit tests for all regimes, funding squeezes, parametric+historical VaR 95/99, R:R > 2.5, invalid/short inputs |
| `src/domain/crypto/types.ts` | Create | `DEFAULT_CRYPTO_WATCHLIST` (incl. `ADA`), `toBinanceUsdtPair`, `CryptoMarketSnapshot`, `CryptoSignalLevel`, `CryptoRiskEvaluation` |
| `src/infrastructure/feeds/binanceClient.ts` | Create | Zod schemas for `premiumIndex`, `openInterest`, `klines` + `fetchBinanceCryptoSnapshot(symbol, fetcher)` |
| `src/infrastructure/feeds/binanceClient.test.ts` | Create | Tests for valid `ADAUSDT` parsing, malformed string rejection, upstream fetch error propagation |
| `src/application/crypto/evaluateCryptoSignal.ts` | Create | Combines regime, funding cascade, VaR/R:R, and Core 3 fail-closed gate |
| `src/application/crypto/evaluateCryptoSignal.test.ts` | Create | Tests for `BLOCKED`, `EXIT_PANIC`, `CASCADE_WARNING`, `VIABLE_ENTRY`, `WAIT` |
| `src/application/stores/useCryptoStore.ts` | Create | Atomic Zustand store with `watchlist`, `addSymbol`, `removeSymbol`, `setSnapshot`, `selectCryptoEvaluation` |
| `src/application/stores/useCryptoStore.test.ts` | Create | Default watchlist (`ADA` included), dynamic add/remove/dedupe, Core 3 fail-closed selector |

## Key Contracts (Non-Obvious)

```ts
// src/domain/crypto/types.ts
export const DEFAULT_CRYPTO_WATCHLIST: readonly string[] = [
  'BTC', 'ETH', 'SOL', 'ADA', 'BNB', 'XRP', 'LINK',
];
export const toBinanceUsdtPair = (symbol: string): string => `${symbol.trim().toUpperCase()}USDT`;

export type CryptoSignalLevel = 'VIABLE_ENTRY' | 'WAIT' | 'CASCADE_WARNING' | 'EXIT_PANIC' | 'BLOCKED';
```

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit (`domain/math`) | Every branch of `cryptoRisk.ts` (Welford, ER, all 3 regimes, 4 cascade levels, param+hist VaR 95/99, R:R > 2.5) | Vitest, 100/100/100/100% enforced by `vitest.config.ts` |
| Integration (`infrastructure/feeds`) | Binance 3-endpoint fetch + Zod string parsing via real `createSafeFetcher` | Vitest + stubbed `fetch` |
| Integration (`application`) | `evaluateCryptoSignal` + `useCryptoStore` (incl. ADA & Core 3 fail-closed gate) | Vitest |

## Migration / Rollout

No migration required. Purely additive modules; zero new dependencies.

## Open Questions

None.
