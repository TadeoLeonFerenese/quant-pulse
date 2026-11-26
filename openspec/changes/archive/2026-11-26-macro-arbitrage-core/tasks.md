# Tasks: Macro Arbitrage Core (Core 1 — Strict TDD)

## Phase 1: Pure Quant Math & Domain Contracts (RED → GREEN → REFACTOR)

- [x] 1.1 Create branch `feat/macro-arbitrage-core` from `main`.
- [x] 1.2 **RED**: Write `src/domain/math/macroArbitrage.test.ts` covering `calculateImplicitDollar`, `calculateSpreadPct`, `calculateNetCarryTrade` (`TNA` + `TEA`, fees + slippage, exact `breakEvenExitUsdRate`, `FAVORS_CARRY`/`FAVORS_DOLLAR`/`NEUTRAL`, invalid inputs), and `calculateRollingGapZScore` (30d & 90d, `PREMIUM_ANOMALY` `Z > 2.0`, `DISCOUNT_ANOMALY` `Z < -2.0`, `NORMAL`, `reversionProbability`, `INSUFFICIENT_HISTORY`, `stdDev === 0`, non-finite inputs).
- [x] 1.3 **GREEN/REFACTOR**: Implement `src/domain/math/macroArbitrage.ts` (pure TS, zero external imports, pure Abramowitz–Stegun `erf`, Welford stable stats) and `src/domain/macro/types.ts`. Verify 100/100/100/100% coverage on `src/domain/math/**`.

## Phase 2: DolarApi Infrastructure Adapter (RED → GREEN → REFACTOR)

- [x] 2.1 **RED**: Write `src/infrastructure/feeds/dolarApiClient.test.ts` covering valid mapping of `bolsa`/`contadoconliqui`/`blue`/`cripto` → `MEP`/`CCL`/`BLUE`/`CRIPTO`, rejection of `compra: null`, `<= 0`, inverted `venta < compra`, invalid ISO timestamp, or missing required `casa` via Core 3 `createSafeFetcher`.
- [x] 2.2 **GREEN/REFACTOR**: Implement `src/infrastructure/feeds/dolarApiClient.ts` (`DOLAR_API_URL`, `dolarApiQuotesSchema`, `fetchDolarApiQuotes`).

## Phase 3: Fail-Closed Evaluator & Atomic Store (RED → GREEN → REFACTOR)

- [x] 3.1 **RED**: Write `src/application/macro/evaluateMacroSignal.test.ts` covering `BLOCKED` whenever Core 3 `canRecommendArbitrage === false` (even with `Z > 2.5` + profitable carry), `OPPORTUNITY` (convergence anomaly or `FAVORS_CARRY`), `CAUTION` (`FAVORS_DOLLAR`), `NEUTRAL`, and missing quotes/history.
- [x] 3.2 **GREEN/REFACTOR**: Implement `src/application/macro/evaluateMacroSignal.ts`.
- [x] 3.3 **RED → GREEN**: Write `src/application/stores/useMacroStore.test.ts` (quote updates, 30/90d history append & cap, `windowDays` toggle, `selectMacroEvaluation` integrated with Core 3 `canRecommendArbitrage`), then implement `src/application/stores/useMacroStore.ts`.

## Phase 4: Full Quality Gates

- [x] 4.1 Run all local gates (NEVER `npm run build`): `npm run typecheck`, `npm run test`, `npm run test:coverage` (100% on `src/domain/math/**`), `npm run lint`, `npm run format:check`.
