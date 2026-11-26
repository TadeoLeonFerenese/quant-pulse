# Tasks: Data Integrity Core (Core 3 — Strict TDD)

## Phase 1: Dependencies & Domain Foundation (RED → GREEN → REFACTOR)

- [x] 1.1 Create branch `feat/data-integrity-core`, add `zod@^4.6.7` and devDep `fake-indexeddb@^6.2.8` to `package.json`, and run `npm install`.
- [x] 1.2 **RED**: Write `src/domain/math/outlierGuard.test.ts` covering all scenarios (`WITHIN_BOUNDS`, `OUTLIER_4SIGMA_FLASH` `<1s`, `SLOW_MOVE` `>=1s`, `stdDev===0` same vs jump, `NaN`/`Infinity`/`<=0`, `WARMUP <5`, `appendTrustedTick` window cap). Verify tests fail.
- [x] 1.3 **GREEN/REFACTOR**: Implement `src/domain/math/outlierGuard.ts` (pure TS, zero external imports). Verify 100% lines/branches/functions/statements coverage.
- [x] 1.4 **RED → GREEN**: Write `src/domain/integrity/freshness.test.ts` (`600_000ms` boundary, `600_001ms` `STALE`, `canRecommendArbitrage` strictly `true` only on `FRESH`), then implement `src/domain/integrity/types.ts`, `src/domain/integrity/freshness.ts`, and `src/domain/integrity/ports.ts`.

## Phase 2: Infrastructure Adapters (RED → GREEN → REFACTOR)

- [x] 2.1 **RED**: Write `src/infrastructure/http/safeFetch.test.ts` (reject `http://` as `INSECURE_URL` without calling fetch, abort at `3000ms` as `TIMEOUT`, HTTP error body parsing with empty `statusText`, invalid JSON / Zod mismatch as `INVALID_PAYLOAD`, valid Zod parse, network error without throwing).
- [x] 2.2 **GREEN/REFACTOR**: Implement `src/infrastructure/http/safeFetch.ts` satisfying `HttpFetcherPort`.
- [x] 2.3 **RED → GREEN**: Write `src/infrastructure/cache/indexedDbCache.test.ts` (`fake-indexeddb/auto` get/set/overwrite + unavailable IDB graceful fallback), then implement `src/infrastructure/cache/inMemoryCache.ts` and `src/infrastructure/cache/indexedDbCache.ts`.

## Phase 3: Application Orchestrator & Store (RED → GREEN → REFACTOR)

- [x] 3.1 **RED**: Write `src/application/integrity/fetchWithIntegrity.test.ts` covering `FRESH` (caches & unlocks), `ANOMALY_BLOCKED` (preserves prior cache & locks), `OFFLINE_FALLBACK` (`<=10m` cached & locks), `STALE` (`>10m` cached & locks), and `OFFLINE_EMPTY` (no crash & locks).
- [x] 3.2 **GREEN/REFACTOR**: Implement `src/application/integrity/fetchWithIntegrity.ts` using injectable `now` clock.
- [x] 3.3 **RED → GREEN**: Write `src/application/stores/useIntegrityStore.test.ts` (per-source recording, trusted-only baseline updates, `selectCanRecommendArbitrage` multi-source fail-closed), then implement `src/application/stores/useIntegrityStore.ts`.

## Phase 4: Presentational UI Atom & Final Gates

- [x] 4.1 **RED → GREEN**: Write `src/ui/atoms/IntegrityBadge.test.tsx` (all 5 statuses, `HH:mm:ss` second precision, `role="status"` non-button, zero emojis), then implement `src/ui/atoms/IntegrityBadge.tsx` (4px/8px scale, Lucide icons, semantic colors).
- [x] 4.2 Run all local gates (NEVER `npm run build`): `npm run typecheck`, `npm run test`, `npm run test:coverage` (100% on `src/domain/math/**`), `npm run lint`, `npm run format:check`.
