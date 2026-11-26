## Exploration: data-integrity-core

### Current State
- `scaffolding-base` merged on `main` (`9beb7fd`). Strict TDD Mode is now **ACTIVE** (`strict_tdd: true`, Vitest 5.1, 100% coverage gate on `src/domain/math/**`).
- `src/domain/math/`, `src/application/`, `src/infrastructure/`, and `src/ui/` are empty skeletons ready for Core 3.
- `AGENT.md` mandates Core 3 (Data Integrity & Fallback) before macro/crypto engines: fail-closed on anomalies (`>4σ` in `<1s`) or disconnect, strict HTTPS + payload sanitization, 3s network timeout, stale-while-revalidate local cache with timestamp visible to the second, yellow `STALE` badge after 10 minutes, zero crashes offline.

### Affected Areas (all NEW + 1 package.json dep if Zod chosen)
- `src/domain/math/outlierGuard.ts` — pure statistical outlier detector (`>4σ` in `<1s`, safe `stdDev === 0` & `NaN`/`Infinity` guards; 100% coverage)
- `src/domain/integrity/` — closed types (`IntegrityStatus`, `TrustedSnapshot<T>`, `IntegrityGateResult`), freshness classifier (`FRESH` / `STALE` > 10m), `SnapshotCachePort` & `HttpFetcherPort` interfaces
- `src/infrastructure/http/safeFetch.ts` — strict HTTPS-only guard, 3000ms `AbortController` timeout, defensive error parsing (Capacitor empty `statusText`), Zod payload sanitization
- `src/infrastructure/cache/indexedDbCache.ts` — browser + Capacitor WebView IndexedDB adapter implementing `SnapshotCachePort` (plus `InMemorySnapshotCache` for tests)
- `src/application/integrity/fetchWithIntegrity.ts` — stale-while-revalidate orchestrator + fail-closed gate (`canRecommendArbitrage`)
- `src/application/stores/useIntegrityStore.ts` — atomic Zustand store tracking per-source integrity state & timestamps
- `src/ui/atoms/IntegrityBadge.tsx` — non-interactive semantic status badge (`FRESH` / `STALE` yellow / `BLOCKED` red) showing `HH:mm:ss` timestamp (no false affordance, no emoji+Lucide duplication)

### Approaches

| Decision | Option A | Option B | Recommendation |
|---|---|---|---|
| Outlier math (`>4σ` in `<1s`) | Classical Z-Score on **trusted-only** rolling window (never push rejected ticks) + `stdDev === 0` guard | Modified Z-Score (MAD) | **Option A** — matches `AGENT.md` `4σ` spec directly; keeping rejected outliers out of the rolling window prevents baseline poisoning |
| Payload sanitization | **Zod** runtime schemas | Hand-written TS type guards | **Option A (Zod)** — aligns with `spec-architect`, scales cleanly to Binance/DolarApi/Ámbito payloads |
| Local cache | Hexagonal `SnapshotCachePort` + **IndexedDB** adapter (zero native plugins) | `@capacitor-community/sqlite` | **Option A (IndexedDB)** — runs identically in browser, Vitest/fake-idb, and Capacitor WebView without local Android SDK |
| Fail-closed on `STALE` (>10m) | Block recommendations on `STALE` too (`canRecommend = status === 'FRESH'`) | Allow recommendations on `STALE` with yellow warning | **Option A (strict fail-closed)** — safer for financial arbitrage; needs user confirmation |

### Recommendation
Build Core 3 strictly inside-out under **Strict TDD (Red → Green → Refactor)**:
1. Pure domain math (`outlierGuard`) + integrity state machine + ports (100% coverage).
2. Infrastructure adapters (`safeFetch` with 3s timeout + HTTPS enforcement + Zod validation; `indexedDbCache`).
3. Application use case (`fetchWithIntegrity` SWR) + Zustand store.
4. Presentational `IntegrityBadge` atom (mobile-first, 4px/8px, non-interactive `role="status"`).

### Risks
- **Cold-start window**: First 1–4 ticks lack enough variance for a meaningful `4σ` baseline → must define explicit `minSamples` warm-up rule (e.g., accept finite positive values during warm-up while still guarding extreme relative spikes or `<= 0`/`NaN`).
- **Clock skew / system time jumps**: Prefer injectable `now: () => number` clock in domain/application so tests are 100% deterministic (zero flaky `Date.now()`).
- **IndexedDB in jsdom**: jsdom has no built-in `indexedDB` → test `fetchWithIntegrity` against `InMemorySnapshotCache` and test `indexedDbCache` with `fake-indexeddb` (or minimal IDB mock).

### Ready for Proposal
Yes — confirm 2 design questions with user:
1. When data is **STALE (>10 min)** (no anomaly, just old cache): block arbitrage recommendations too (strict fail-closed), or allow with yellow warning?
2. Add **Zod** (`zod`) as runtime schema validator for external API payloads?
