# Proposal: Crypto Regime & Probabilistic Risk Core (Core 2)

## Intent
Quant-Pulse needs Core 2: a probabilistic crypto risk engine covering an extensible multi-asset watchlist (`BTC, ETH, SOL, ADA, BNB, XRP, LINK` + custom Binance USDT symbols). It detects market regimes, flags perpetual funding/OI liquidation cascades, computes parametric & historical VaR (95%/99%), and checks asymmetric entry viability (`R:R > 2.5:1`) — strictly gated fail-closed by Core 3.

## Scope

### In Scope
- Pure quant math (`src/domain/math/cryptoRisk.ts`, 100% coverage, Welford stable stats):
  - `calculateLogReturns(prices)` — `ln(P_t / P_{t-1})`, rejecting `<= 0` or non-finite values
  - `detectMarketRegime(prices, options?)` — classifies `RANGE_LOW_VOL | STRONG_TREND | PANIC_LIQUIDATION` using Kaufman Efficiency Ratio + Welford volatility + tail shock, plus `trendDirection: 'UP' | 'DOWN' | 'FLAT'`
  - `evaluateFundingCascadeRisk(input)` — perpetual funding rate + OI delta → `NORMAL | ELEVATED | CASCADE_LONG_SQUEEZE | CASCADE_SHORT_SQUEEZE`
  - `calculateVaRAndAsymmetry(input)` — Parametric (Gaussian 95%/99%) + Historical (5%/1% empirical quantiles) VaR; conservative downside band `max(parametricVaR95, historicalVaR95)`; `rewardToRiskRatio` and `isAsymmetricallyViable` (`R:R > 2.5`)
- Domain contracts (`src/domain/crypto/types.ts`): `DEFAULT_CRYPTO_WATCHLIST` (`['BTC', 'ETH', 'SOL', 'ADA', 'BNB', 'XRP', 'LINK']`), `CryptoMarketSnapshot`, `CryptoRiskEvaluation`
- Public Binance adapter (`src/infrastructure/feeds/binanceClient.ts`): zero API keys; Zod schemas parsing Binance string numbers via Core 3 `safeFetch` for `premiumIndex`, `openInterest`, and `klines` (1d closes)
- Fail-closed evaluator (`src/application/crypto/evaluateCryptoSignal.ts`): forces `BLOCKED` whenever Core 3 `canRecommendArbitrage === false`
- Atomic Zustand store (`src/application/stores/useCryptoStore.ts`): extensible watchlist (`addSymbol`/`removeSymbol`, normalized uppercase), per-asset snapshots, and pure selector `selectCryptoEvaluation`

### Out of Scope
- Dashboard UI screens & charts → dedicated UI change
- Automated order execution or private Binance API keys (strictly prohibited by `AGENT.md`)
- WebSocket streaming (REST polling via Core 3 `fetchWithIntegrity` first)

## Capabilities

### New Capabilities
- `crypto-regime`: log returns, 3-state market regime detection, funding/OI cascade risk, parametric+historical VaR 95/99 with `R:R > 2.5:1` asymmetry filter, public Binance adapter, and extensible multi-crypto watchlist including ADA

### Modified Capabilities
None

## Approach
Hexagonal inside-out under **Strict TDD (Red → Green → Refactor)**: pure math (`cryptoRisk.ts` at 100% coverage) → domain types → Binance Zod adapter (via Core 3 `safeFetch`) → fail-closed evaluator & extensible Zustand store. Zero new npm dependencies.

## Affected Areas
| Area | Impact | Description |
|---|---|---|
| `src/domain/math/cryptoRisk.ts` | New | Pure log returns, regime, funding cascade, VaR 95/99 + R:R (100% cov) |
| `src/domain/crypto/types.ts` | New | Watchlist defaults (incl. ADA) & closed crypto risk contracts |
| `src/infrastructure/feeds/binanceClient.ts` | New | Public Binance `premiumIndex`, `openInterest`, `klines` via Core 3 `safeFetch` |
| `src/application/crypto/evaluateCryptoSignal.ts` | New | Combines regime + funding + VaR + Core 3 fail-closed gate |
| `src/application/stores/useCryptoStore.ts` | New | Extensible watchlist store + pure derived selector |

## Risks
| Risk | Likelihood | Mitigation |
|---|---|---|
| Binance string numbers malformed or `<= 0` | Med | Strict Zod string→finite number validation; fails closed to Core 3 cache |
| Fat crypto tails underestimated by Gaussian VaR | High | Use conservative `max(parametricVaR95, historicalVaR95)` for R:R check |
| Short history (<20 returns) skews 99% VaR | Med | Return `INSUFFICIENT_HISTORY` below `minReturns` |

## Rollback Plan
Isolated on branch `feat/crypto-regime-core`; revert commit or drop branch.

## Dependencies
- Core 3 (`data-integrity-core`) on `main`. Zero new packages.

## Success Criteria
- [ ] Strict TDD RED → GREEN → REFACTOR evidence for every unit
- [ ] `src/domain/math/**` maintains 100/100/100/100% coverage
- [ ] `npm run typecheck`, `npm run test`, `npm run test:coverage`, `npm run lint`, `npm run format:check` all exit `0`
- [ ] Default watchlist includes `ADA` and supports dynamic `addSymbol`/`removeSymbol`
- [ ] When Core 3 `canRecommendArbitrage === false`, crypto signal is ALWAYS `BLOCKED`
