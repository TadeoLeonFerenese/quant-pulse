# Proposal: Macro Arbitrage Core (Core 1)

## Intent
Quant-Pulse needs its first real financial engine: Core 1 (Macro Arbitrage & Real-Time FX Gaps). Investors need implicit dollar calculation (MEP AL30/GD30, CCL, Blue, USDT/Cripto), net carry trade math deducting broker fees + slippage, and rolling 30/90-day Z-Score convergence alerts (`|Z| > 2.0`) — strictly gated fail-closed by Core 3 (`data-integrity-core`).

## Scope

### In Scope
- Pure quant math (`src/domain/math/macroArbitrage.ts`, 100% coverage):
  - `calculateImplicitDollar(arsBondPrice, usdBondPrice)` for AL30/GD30 MEP & CCL ratios
  - `calculateSpreadPct(targetRate, baseRate)` for MEP vs Blue / Cripto gaps
  - `calculateNetCarryTrade(input)` supporting `TNA` and `TEA`, two-leg broker fees (0.5%–1.5% configurable) + slippage, returning net USD return, net ARS/USD profit, and `breakEvenExitUsdRate`
  - `calculateRollingGapZScore(history, currentGap, windowDays: 30 | 90)` with two-sided convergence alert (`|Z| > 2.0`: `PREMIUM_ANOMALY` / `DISCOUNT_ANOMALY`), pure normal-CDF reversion probability, and explicit `INSUFFICIENT_HISTORY` / `stdDev === 0` handling
- Domain types (`src/domain/macro/types.ts`): `DollarKind` (`MEP | CCL | BLUE | CRIPTO`), `FxQuote` (`bid`/`ask` validated), `MacroTrafficLight`
- Live feed adapter (`src/infrastructure/feeds/dolarApiClient.ts`): Zod schema for `https://dolarapi.com/v1/dolares` (`bolsa`, `contadoconliqui`, `blue`, `cripto`), mapping into `FxQuote` through Core 3's `safeFetch` + `fetchWithIntegrity`
- Fail-closed evaluator (`src/application/macro/evaluateMacroSignal.ts`): forces `BLOCKED` whenever Core 3 `canRecommendArbitrage === false`
- Atomic Zustand store (`src/application/stores/useMacroStore.ts`) with pure selectors

### Out of Scope
- Dashboard UI screens & interactive simulator widgets → dedicated UI change
- Crypto regime & VaR engine → Core 2 (`crypto-regime-core`)
- Historical 30/90d backfill API integration (history window fed via store / cache for now)

## Capabilities

### New Capabilities
- `macro-arbitrage`: implicit FX calculation, net carry trade math, two-sided 30/90d gap Z-Score convergence detection, DolarApi adapter, and Core 3 fail-closed macro signal evaluation

### Modified Capabilities
None

## Approach
Hexagonal inside-out under **Strict TDD (Red → Green → Refactor)**: pure math (`src/domain/math/macroArbitrage.ts` at 100% coverage) → domain types → DolarApi Zod adapter (reusing Core 3 `safeFetch`) → fail-closed evaluator & Zustand store. Zero new npm dependencies required.

## Affected Areas
| Area | Impact | Description |
|---|---|---|
| `src/domain/math/macroArbitrage.ts` | New | Pure implicit FX, spread, carry trade, 30/90d Z-Score (100% cov) |
| `src/domain/macro/types.ts` | New | Closed FX & macro signal contracts |
| `src/infrastructure/feeds/dolarApiClient.ts` | New | Zod adapter for `dolarapi.com/v1/dolares` via Core 3 `safeFetch` |
| `src/application/macro/evaluateMacroSignal.ts` | New | Combines math + Core 3 fail-closed gate |
| `src/application/stores/useMacroStore.ts` | New | Atomic store + pure derived selectors |

## Risks
| Risk | Likelihood | Mitigation |
|---|---|---|
| DolarApi returns `compra: null` or `<= 0` | Med | Strict Zod schema rejects invalid quotes; Core 3 falls back & blocks |
| Cold start lacks 30/90 daily samples | High | Return `INSUFFICIENT_HISTORY` instead of bogus Z-Score |
| Mid-price hides bid/ask spread | Med | Explicit `bid`/`ask` in `FxQuote`; reject inverted `ask < bid` |

## Rollback Plan
Isolated on branch `feat/macro-arbitrage-core`; revert commit or drop branch.

## Dependencies
- Core 3 (`data-integrity-core`) already on `main`. Zero new packages.

## Success Criteria
- [ ] Strict TDD RED → GREEN → REFACTOR evidence for every unit
- [ ] `src/domain/math/**` maintains 100/100/100/100% coverage
- [ ] `npm run typecheck`, `npm run test`, `npm run test:coverage`, `npm run lint`, `npm run format:check` all exit `0`
- [ ] When Core 3 `canRecommendArbitrage === false`, macro signal is ALWAYS `BLOCKED`
