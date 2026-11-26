# Design: Macro Arbitrage Core (Core 1)

## Technical Approach

Implement Core 1 inside-out under **Strict TDD** with zero new dependencies, reusing Core 3 (`safeFetch`, `fetchWithIntegrity`, `canRecommendArbitrage`). All quantitative formulas live in pure TypeScript under `src/domain/math/macroArbitrage.ts` (enforced at 100/100/100/100% coverage), domain types in `src/domain/macro/types.ts`, DolarApi Zod parsing in `src/infrastructure/feeds/dolarApiClient.ts`, and fail-closed signal evaluation + state in `src/application/`.

## Architecture Decisions

| Topic | Options Considered | Tradeoff | Decision |
|---|---|---|---|
| Rate input representation | Decimal rates (`0.48`) vs percent numbers (`48`) | Decimals prevent `/100` scaling bugs in compound formulas | **Decimal rates (`0.48` = 48%) with `TNA \| TEA` union** |
| Friction model | Round-trip `brokerFeeRate + slippageRate` vs single fee | Explicitly separates broker fee (0.5%–1.5%) from execution slippage | **`frictionMultiplier = 1 - (brokerFeeRate + slippageRate)`** |
| Reversion probability | Pure Abramowitz–Stegun `erf` (7.1.26) vs stats npm dep | Pure `erf` has `<1.5e-7` max error, 0 bundle cost, 100% deterministic | **Pure `erf` normal two-tailed confidence** |
| Z-Score convergence | Two-sided (`\|Z\| > 2.0`) vs one-sided (`Z > 2.0`) | Two-sided catches both wide (`PREMIUM_ANOMALY`) and compressed (`DISCOUNT_ANOMALY`) gaps | **Two-sided `\|Z\| > 2.0`** |
| DolarApi validation | Partial map vs require all 4 core rates (`MEP/CCL/BLUE/CRIPTO`) | Missing or `null`/`venta < compra` quotes would skew spreads | **Strict Zod schema requiring all 4 valid quotes; invalid → Core 3 fallback** |

## Data Flow

```
  [https://dolarapi.com/v1/dolares]
          │  safeFetch + dolarApiSnapshotSchema (Zod)
          ▼
  dolarApiClient.ts (infrastructure) ──► fetchWithIntegrity (Core 3)
          │
          ▼ FxQuoteMap (MEP, CCL, BLUE, CRIPTO) + canRecommendArbitrage
  evaluateMacroSignal.ts (application)
          ├─► calculateSpreadPct()          (domain/math — 100% cov)
          ├─► calculateNetCarryTrade()      (domain/math — 100% cov)
          └─► calculateRollingGapZScore()   (domain/math — 100% cov)
          │
          ▼ MacroSignalEvaluation (BLOCKED if !canRecommendArbitrage)
  useMacroStore.ts (Zustand atomic store + pure selector)
```

## File Changes

| File | Action | Description |
|---|---|---|
| `src/domain/math/macroArbitrage.ts` | Create | `calculateImplicitDollar`, `calculateSpreadPct`, `calculateNetCarryTrade`, `calculateRollingGapZScore` (100% cov) |
| `src/domain/math/macroArbitrage.test.ts` | Create | Exhaustive unit tests covering all formulas, boundaries, TNA/TEA, 30/90d, `stdDev===0`, `NaN`/`<=0` |
| `src/domain/macro/types.ts` | Create | `DollarKind`, `FxQuote`, `FxQuoteMap`, `MacroTrafficLight`, `MacroSignalEvaluation` |
| `src/infrastructure/feeds/dolarApiClient.ts` | Create | `DOLAR_API_URL`, `dolarApiQuotesSchema`, `fetchDolarApiQuotes` using `HttpFetcherPort` |
| `src/infrastructure/feeds/dolarApiClient.test.ts` | Create | Unit/integration tests for valid mapping, `compra: null`, inverted `venta < compra`, missing required casa |
| `src/application/macro/evaluateMacroSignal.ts` | Create | Pure evaluator combining spreads, carry trade, 30/90d Z-Scores, and Core 3 fail-closed gate |
| `src/application/macro/evaluateMacroSignal.test.ts` | Create | Tests for `BLOCKED`, `OPPORTUNITY`, `CAUTION`, `NEUTRAL`, and insufficient history |
| `src/application/stores/useMacroStore.ts` | Create | Atomic Zustand store (`quotes`, `gapHistory`, `windowDays`, `carryInput`) + `selectMacroEvaluation` |
| `src/application/stores/useMacroStore.test.ts` | Create | Store state updates, history capping, and Core 3 fail-closed selector integration |

## Key Contracts (Non-Obvious)

```ts
// src/domain/math/macroArbitrage.ts
export type RateSpec =
  | { readonly kind: 'TNA'; readonly annualRate: number }
  | { readonly kind: 'TEA'; readonly annualRate: number };

export type GapConvergenceSignal = 'NORMAL' | 'PREMIUM_ANOMALY' | 'DISCOUNT_ANOMALY';

export type RollingGapZScoreResult =
  | { readonly status: 'INVALID_INPUT' }
  | { readonly status: 'INSUFFICIENT_HISTORY'; readonly requiredSamples: 30 | 90; readonly availableSamples: number }
  | {
      readonly status: 'READY';
      readonly windowDays: 30 | 90;
      readonly mean: number;
      readonly stdDev: number;
      readonly zScore: number;
      readonly signal: GapConvergenceSignal;
      readonly reversionProbability: number;
    };
```

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit (`domain/math`) | Every formula & branch of `macroArbitrage.ts` (including exact `breakEvenExitUsdRate` algebraic identity & `erf` accuracy) | Vitest, 100/100/100/100% enforced by `vitest.config.ts` |
| Unit (`infrastructure/feeds`) | DolarApi Zod schema validation, null/inverted rejection, mapping via stubbed `safeFetch` | Vitest + real `createSafeFetcher` |
| Integration (`application`) | `evaluateMacroSignal` + `useMacroStore` + Core 3 `fetchWithIntegrity` fail-closed integration | Vitest |

## Migration / Rollout

No migration required. Purely additive modules; zero new dependencies.

## Open Questions

None.
