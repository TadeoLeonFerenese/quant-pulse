# Proposal: Data Integrity Core (Core 3)

## Intent
Quant-Pulse cannot run macro arbitrage or crypto risk engines on unverified, stale, or corrupted feeds. We need Core 3 first: a fail-closed data integrity, outlier-blocking, timeout, and stale-while-revalidate fallback module built under **Strict TDD** with 100% coverage in `src/domain/math/**`.

## Scope

### In Scope
- Pure statistical outlier guard (`src/domain/math/outlierGuard.ts`): detects `>4σ` spikes within `<1s` against a trusted-only rolling window, handles `stdDev === 0`, `NaN`/`Infinity`/`<= 0`, and warm-up cleanly (100% test coverage)
- Domain integrity contracts & freshness classifier (`src/domain/integrity/`): closed status union (`FRESH | STALE | ANOMALY_BLOCKED | OFFLINE_FALLBACK | OFFLINE_EMPTY`), `>10 min` stale rule, strict fail-closed gate (`canRecommendArbitrage` is `true` **only** when `FRESH`), ports `SnapshotCachePort` and `HttpFetcherPort`
- Safe HTTPS fetcher (`src/infrastructure/http/safeFetch.ts`): strict `https://` enforcement, hard `3000ms` timeout via `AbortController`, defensive error parsing (Capacitor empty `statusText`), and `zod` (`^4.6.7`) payload sanitization
- Local cache adapter (`src/infrastructure/cache/indexedDbCache.ts`) + `InMemorySnapshotCache` for deterministic tests (`fake-indexeddb@^6.2.8` devDep)
- Stale-while-revalidate orchestrator (`src/application/integrity/fetchWithIntegrity.ts`) + atomic Zustand store (`src/application/stores/useIntegrityStore.ts`)
- Non-interactive `IntegrityBadge` atom (`src/ui/atoms/IntegrityBadge.tsx`) with `HH:mm:ss` timestamp, semantic colors (emerald/yellow/rose), zero false affordance, zero emoji+Lucide duplication

### Out of Scope
- Specific exchange/broker clients (Binance, DolarApi, Ámbito) → Macro & Crypto engine changes
- Native SQLite plugin (`@capacitor-community/sqlite`) → optional future swap behind `SnapshotCachePort`
- Macro arbitrage math (Core 1) and Crypto probabilistic engine (Core 2)

## Capabilities

### New Capabilities
- `data-integrity`: fail-closed outlier detection (`>4σ` in `<1s`), 3s HTTPS fetch + Zod sanitization, local SWR cache (`>10m` STALE), and visible status indicator

### Modified Capabilities
None

## Approach
Hexagonal inside-out under **Strict TDD (Red → Green → Refactor)**: pure math & domain types first (zero React/IO), then infrastructure adapters (`safeFetch`, `indexedDbCache`), then application SWR orchestrator + Zustand store, finally presentational `IntegrityBadge` atom.

## Affected Areas
| Area | Impact | Description |
|---|---|---|
| `package.json`, lockfile | Modified | Add `zod` + devDep `fake-indexeddb` |
| `src/domain/math/outlierGuard.ts` | New | Pure `>4σ` in `<1s` guard (100% coverage) |
| `src/domain/integrity/**` | New | Status types, freshness rules, ports |
| `src/infrastructure/{http,cache}/**` | New | `safeFetch` + `indexedDbCache` |
| `src/application/{integrity,stores}/**` | New | SWR use case + `useIntegrityStore` |
| `src/ui/atoms/IntegrityBadge.tsx` | New | Presentational status badge |

## Risks
| Risk | Likelihood | Mitigation |
|---|---|---|
| Cold-start false positives (<5 ticks) | Med | Explicit warm-up rule + finite/positive validation |
| Clock flakiness in tests | Med | Injectable `now: () => number` clock everywhere |
| Outlier poisoning rolling mean/σ | High | Rejected ticks never enter the trusted baseline window |

## Rollback Plan
Isolated on branch `feat/data-integrity-core`; revert commit or drop branch. No existing runtime behavior modified.

## Dependencies
- `zod@^4.6.7` (runtime), `fake-indexeddb@^6.2.8` (dev)

## Success Criteria
- [ ] Strict TDD RED → GREEN → REFACTOR evidence for every task
- [ ] `src/domain/math/**` maintains 100% lines/branches/functions/statements coverage
- [ ] `npm run typecheck`, `npm run test`, `npm run test:coverage`, `npm run lint`, `npm run format:check` all exit `0`
- [ ] Network failure / timeout / outlier never crashes and blocks arbitrage recommendations (`canRecommendArbitrage === false`)
