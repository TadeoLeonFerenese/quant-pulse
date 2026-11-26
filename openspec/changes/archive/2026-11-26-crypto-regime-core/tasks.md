# Tasks: Crypto Regime & Probabilistic Risk Core (Core 2 — Strict TDD)

## Phase 1: Pure Quant Math & Domain Contracts (RED → GREEN → REFACTOR)

- [x] 1.1 Create branch `feat/crypto-regime-core` from `main`.
- [x] 1.2 **RED**: Write `src/domain/math/cryptoRisk.test.ts` covering `calculateLogReturns`, `detectMarketRegime` (`STRONG_TREND` UP/DOWN, `RANGE_LOW_VOL`, `PANIC_LIQUIDATION` crash & high-vol, flat prices, `INSUFFICIENT_HISTORY`, `INVALID_INPUT`), `evaluateFundingCascadeRisk` (4 risk levels + non-finite), and `calculateVaRAndAsymmetry` (Parametric & Historical VaR 95/99, conservative `max`, `R:R > 2.5` viable vs non-viable, zero downside risk, `INSUFFICIENT_HISTORY`, `INVALID_INPUT`).
- [x] 1.3 **GREEN/REFACTOR**: Implement `src/domain/math/cryptoRisk.ts` (pure TS, Welford stable stats, 100/100/100/100% coverage) and `src/domain/crypto/types.ts` (`DEFAULT_CRYPTO_WATCHLIST` incl. `ADA`, `toBinanceUsdtPair`).

## Phase 2: Public Binance REST Adapter (RED → GREEN → REFACTOR)

- [x] 2.1 **RED**: Write `src/infrastructure/feeds/binanceClient.test.ts` covering valid `ADAUSDT` parsing across `premiumIndex`, `openInterest`, and `klines` via Core 3 `createSafeFetcher`, rejection of malformed string numbers, and upstream error propagation.
- [x] 2.2 **GREEN/REFACTOR**: Implement `src/infrastructure/feeds/binanceClient.ts` (zero API keys, strict Zod schemas).

## Phase 3: Fail-Closed Evaluator & Extensible Watchlist Store (RED → GREEN → REFACTOR)

- [x] 3.1 **RED**: Write `src/application/crypto/evaluateCryptoSignal.test.ts` covering `BLOCKED` (Core 3 `canRecommendArbitrage === false`), `EXIT_PANIC`, `CASCADE_WARNING`, `VIABLE_ENTRY` (`R:R > 2.5`), and `WAIT`.
- [x] 3.2 **GREEN/REFACTOR**: Implement `src/application/crypto/evaluateCryptoSignal.ts`.
- [x] 3.3 **RED → GREEN**: Write `src/application/stores/useCryptoStore.test.ts` (default watchlist incl. `ADA`, dynamic `addSymbol`/`removeSymbol`/dedupe, Core 3 fail-closed `selectCryptoEvaluation`), then implement `src/application/stores/useCryptoStore.ts`.

## Phase 4: Full Quality Gates

- [x] 4.1 Run all local gates (NEVER `npm run build`): `npm run typecheck`, `npm run test`, `npm run test:coverage` (100% on `src/domain/math/**`), `npm run lint`, `npm run format:check`.
