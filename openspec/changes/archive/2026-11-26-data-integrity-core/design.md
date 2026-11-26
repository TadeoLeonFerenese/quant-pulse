# Design: Data Integrity Core (Core 3)

## Technical Approach

Implement Core 3 inside-out under **Strict TDD (Red → Green → Refactor)** following hexagonal boundaries: pure math (`src/domain/math/outlierGuard.ts`, 100% coverage) and domain ports/state machine (`src/domain/integrity/`) have ZERO imports from React, Zustand, Zod, or browser APIs. Infrastructure adapters (`safeFetch`, `indexedDbCache`) satisfy domain ports. An application SWR use case (`fetchWithIntegrity`) and atomic Zustand store (`useIntegrityStore`) feed a pure presentational atom (`IntegrityBadge`).

## Architecture Decisions

| Topic | Options Considered | Tradeoff | Decision |
|---|---|---|---|
| Outlier baseline | Classical Z-Score on trusted-only window vs MAD | Classical matches `AGENT.md` `4σ` directly; excluding rejected ticks prevents baseline poisoning | **Classical Z-Score (trusted-only window, `stdDev === 0` guard)** |
| Domain purity vs Zod | Import `zod` in domain vs structural `SafeParseSchema<T>` port | Structural interface keeps `src/domain/` 100% dependency-free while accepting any `z.ZodType<T>` | **Structural `SafeParseSchema<T>` in domain; `zod@^4.6.7` in infra/callers** |
| Local cache | Native IndexedDB adapter vs `@capacitor-community/sqlite` | IndexedDB runs identically in browser, Capacitor WebView, and `fake-indexeddb` without Android SDK | **`IndexedDbSnapshotCache` behind `SnapshotCachePort` + `InMemorySnapshotCache`** |
| Clock determinism | Direct `Date.now()` vs injectable `now: () => number` | Injectable clock eliminates flaky timer/stale tests | **Injectable `now` defaulting to `Date.now`** |
| Fail-closed on `STALE` | Block recommendations vs warn-only | Arbitrage on >10m old quotes risks financial loss | **Strict fail-closed (`canRecommendArbitrage === (status === 'FRESH')`)** |

## Data Flow

```
  [External HTTPS API]
          │  (3000ms AbortController + HTTPS check + Zod safeParse)
          ▼
     safeFetch.ts (infrastructure)
          │ FetchResult<T>
          ▼
  fetchWithIntegrity.ts (application) ◄──► SnapshotCachePort (IndexedDB / InMemory)
          │
          ├─► evaluateOutlier() (domain/math — 100% coverage)
          ├─► classifyFreshness() (>10m → STALE)
          │
          ▼ SourceIntegrityState<T> (canRecommendArbitrage = status === 'FRESH')
  useIntegrityStore.ts (Zustand) ──► IntegrityBadge.tsx (ui/atoms, HH:mm:ss)
```

## File Changes

| File | Action | Description |
|---|---|---|
| `package.json`, `package-lock.json` | Modify | Add `zod@^4.6.7` and devDep `fake-indexeddb@^6.2.8` |
| `src/domain/math/outlierGuard.ts` | Create | `evaluateOutlier`, `appendTrustedTick` (100% coverage) |
| `src/domain/math/outlierGuard.test.ts` | Create | Exhaustive unit tests (happy, >4σ, `stdDev===0`, `>=1s`, `NaN`/`<=0`, warm-up) |
| `src/domain/integrity/types.ts` | Create | `IntegrityStatus`, `TrustedSnapshot<T>`, `SourceIntegrityState<T>`, `canRecommendArbitrage` |
| `src/domain/integrity/freshness.ts` | Create | `STALE_THRESHOLD_MS = 600_000`, `classifyFreshness` |
| `src/domain/integrity/ports.ts` | Create | `SnapshotCachePort`, `HttpFetcherPort`, `SafeParseSchema<T>`, `FetchResult<T>` |
| `src/domain/integrity/freshness.test.ts` | Create | Unit tests for boundary `600_000ms`, `600_001ms`, fail-closed helper |
| `src/infrastructure/http/safeFetch.ts` | Create | Strict HTTPS, 3s timeout, Capacitor-safe error parsing, schema validation |
| `src/infrastructure/http/safeFetch.test.ts` | Create | Unit tests with stubbed `fetch` + fake timers + Zod schemas |
| `src/infrastructure/cache/inMemoryCache.ts` | Create | Deterministic `SnapshotCachePort` for tests |
| `src/infrastructure/cache/indexedDbCache.ts` | Create | Browser/WebView IndexedDB adapter with graceful fallback |
| `src/infrastructure/cache/indexedDbCache.test.ts` | Create | Tests using `fake-indexeddb/auto` + unavailable IDB error path |
| `src/application/integrity/fetchWithIntegrity.ts` | Create | SWR orchestrator combining fetcher, outlier guard, cache, freshness |
| `src/application/integrity/fetchWithIntegrity.test.ts` | Create | Integration tests for FRESH, STALE, OFFLINE_FALLBACK, OFFLINE_EMPTY, ANOMALY_BLOCKED |
| `src/application/stores/useIntegrityStore.ts` | Create | Atomic Zustand store + `selectCanRecommendArbitrage` pure selector |
| `src/application/stores/useIntegrityStore.test.ts` | Create | Store transitions & multi-source fail-closed selector tests |
| `src/ui/atoms/IntegrityBadge.tsx` | Create | Presentational badge (`role="status"`, Lucide icon, `HH:mm:ss`, semantic tokens) |
| `src/ui/atoms/IntegrityBadge.test.tsx` | Create | RTL tests for all 5 statuses, `HH:mm:ss` formatting, zero button affordance |

## Key Contracts (Non-Obvious)

```ts
// src/domain/math/outlierGuard.ts
export interface PriceTick {
  readonly value: number;
  readonly timestampMs: number;
}
export type OutlierCheckResult =
  | { readonly status: 'ACCEPTED'; readonly zScore: number | null; readonly reason: 'WARMUP' | 'WITHIN_BOUNDS' | 'SLOW_MOVE' }
  | { readonly status: 'REJECTED'; readonly zScore: number | null; readonly reason: 'NON_FINITE_OR_NON_POSITIVE' | 'OUTLIER_4SIGMA_FLASH' };

// src/domain/integrity/types.ts
export type IntegrityStatus = 'FRESH' | 'STALE' | 'ANOMALY_BLOCKED' | 'OFFLINE_FALLBACK' | 'OFFLINE_EMPTY';
export const canRecommendArbitrage = (status: IntegrityStatus): boolean => status === 'FRESH';
```

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit (`domain/math`) | Every branch of `evaluateOutlier` & `appendTrustedTick` | Vitest, 100% lines/branches/funcs/stmts enforced by `vitest.config.ts` |
| Unit (`domain/integrity`, `infrastructure`) | Freshness boundaries, HTTPS check, 3s timeout (`vi.useFakeTimers`), Zod rejection, IndexedDB roundtrip | Vitest + `fake-indexeddb` + stubbed `fetch` |
| Integration (`application`, `ui/atoms`) | Full SWR fallback flows, Zustand multi-source fail-closed selector, `IntegrityBadge` DOM & a11y | Vitest + `@testing-library/react` |

## Migration / Rollout

No migration required. Purely additive modules; existing `App.tsx` remains green.

## Open Questions

None.
