## Exploration: macro-arbitrage-core

### Current State
- `main` (`0df6d3d`) has `scaffolding-base` + `data-integrity-core` (Core 3) complete with 38/38 tests passing and `strict_tdd: true` (100% coverage enforced on `src/domain/math/**`).
- Core 3 provides `evaluateOutlier`, `fetchWithIntegrity`, `createSafeFetcher`, `IndexedDbSnapshotCache`, `useIntegrityStore` (`selectCanRecommendArbitrage`), and `IntegrityBadge`.
- `AGENT.md` Core 1 requires: implicit dollar mapping (MEP AL30/GD30, CCL, Blue, USDT P2P), net carry trade (TNA/TEA vs projected FX gap, subtracting broker fees 0.5–1.5% + slippage), rolling 30/90d Z-Score of MEP vs Blue/Crypto gap, and convergence alert when `|Z| > 2.0` with mean-reversion probability — gated fail-closed by Core 3.

### Affected Areas (all NEW)
- `src/domain/math/macroArbitrage.ts` — pure quant math (100% coverage):
  - `calculateImplicitDollar(arsBondPrice, usdBondPrice)` (AL30/GD30 MEP & CCL)
  - `calculateSpreadPct(targetRate, baseRate)` (brecha MEP vs Blue / Cripto)
  - `calculateNetCarryTrade(input)` — supports TNA (`tna * days / 365`) and TEA (`(1 + tea)^(days/365) - 1`), deducts broker fee (0.5–1.5% default) + slippage, outputs `netReturnUsdPct`, `netProfitArs`, `netProfitUsd`, `breakEvenExitUsdRate`
  - `calculateRollingGapZScore(historicalGaps, currentGap, windowDays: 30 | 90)` — rolling mean, stdDev, Z-Score, convergence signal (`|Z| > 2.0`), normal-CDF tail probability via pure Abramowitz–Stegun `erf`
- `src/domain/macro/types.ts` — closed types (`DollarKind`, `FxQuote` with `bid`/`ask`, `MacroTrafficLight`, `MacroRecommendation`)
- `src/infrastructure/feeds/dolarApiClient.ts` (optional in this change vs separate) — Zod-validated adapter for `https://dolarapi.com/v1/dolares` wired through Core 3's `safeFetch`
- `src/application/macro/evaluateMacroSignal.ts` — combines math outputs + Core 3 `canRecommendArbitrage` fail-closed gate (if integrity is not `FRESH`, forces `BLOCKED`)
- `src/application/stores/useMacroStore.ts` — atomic Zustand store holding latest FX quotes, gap history (30/90d), carry inputs, and derived traffic-light signals

### Approaches

| Decision | Option A | Option B | Recommendation |
|---|---|---|---|
| Carry trade friction model | **Explicit round-trip legs** (`entryFee + exitFee + slippage`, default 0.5%–1.5% total configurable) | Single flat fee deduction | **Option A** — realistic for ARS↔USD broker operations (two trades = two commissions + slippage) |
| Z-Score convergence direction | **Two-sided (`|Z| > 2.0`)**: distinguishes `PREMIUM_ALERT` (`Z > 2.0`, gap unusually wide) and `DISCOUNT_ALERT` (`Z < -2.0`, gap unusually compressed) | One-sided (`Z > 2.0` only) | **Option A** — catches both overheated Blue/Crypto and unusually cheap Blue/Crypto vs MEP |
| Scope of live API adapter | Include `dolarApiClient.ts` (DolarApi Zod schema via Core 3 `safeFetch`) now | Keep this change pure quant engine + store, defer live feeds to `market-feeds` | **Option A (include DolarApi adapter)** — proves Core 3 + Core 1 work end-to-end with real Argentine dollar schemas |

### Recommendation
Build Core 1 inside-out under **Strict TDD** (100% coverage in `src/domain/math/macroArbitrage.ts`):
1. Pure quant math (`macroArbitrage.ts`) with exhaustive edge-case tests (`<= 0`, `NaN`, inverted bid/ask, `stdDev === 0`, `< windowDays` history, exact `Z = 2.0` vs `2.01`, TNA vs TEA parity).
2. Domain types + fail-closed evaluator (`evaluateMacroSignal.ts`) strictly honoring Core 3's `canRecommendArbitrage`.
3. `dolarApiClient.ts` (if confirmed) + `useMacroStore.ts`.

### Risks
- **DolarApi response quirks**: sometimes `compra` can be `null` on certain endpoints (e.g. `mayorista` or holidays) → Zod schema must guard nullable/non-positive fields and reject cleanly via Core 3 fail-closed.
- **Window warm-up (30/90d)**: On first launch, user won't have 90 days of local ticks yet → return explicit `INSUFFICIENT_HISTORY` status when `history.length < windowDays` rather than computing a misleading Z-Score on 3 points.
- **Floating-point precision**: use `toBeCloseTo` in tests for irrational roots/exponentials and guard division by zero everywhere.

### Ready for Proposal
Yes — confirm 2 quick decisions with user:
1. Include the live **DolarApi adapter** (`dolarApiClient.ts` via Core 3 `safeFetch` + Zod) in this change, or keep this change pure math + store?
2. For Z-Score convergence alert: detect **both extremes (`|Z| > 2.0`: brecha muy alta o muy baja)**, or only `Z > 2.0`?
