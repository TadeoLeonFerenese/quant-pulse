# data-integrity Specification

## Purpose

Guarantee fail-closed data integrity for all external market feeds in `quant-pulse`: detect flash statistical anomalies, enforce HTTPS and strict timeouts, sanitize payloads, preserve last trusted snapshots offline, and block arbitrage recommendations whenever data is not verified and fresh.

## Requirements

### Requirement: Flash Statistical Outlier Guard (>4σ in <1s)

The math domain MUST evaluate incoming price ticks against a rolling window of previously accepted trusted ticks. Any non-finite, non-positive value, or tick deviating by more than `4σ` within `< 1000ms` MUST be rejected and MUST NOT enter the trusted baseline window.

#### Scenario: Normal tick within 4σ is accepted
- GIVEN a trusted baseline of ≥5 ticks with positive variance
- WHEN a new tick arrives within `< 1000ms` with `|value - mean| / stdDev <= 4`
- THEN the guard returns `ACCEPTED` with `reason: 'WITHIN_BOUNDS'` and the computed `zScore`

#### Scenario: Flash outlier >4σ in <1s is rejected
- GIVEN a trusted baseline of ≥5 ticks with positive variance
- WHEN a tick arrives within `< 1000ms` with `|value - mean| / stdDev > 4`
- THEN the guard returns `REJECTED` with `reason: 'OUTLIER_4SIGMA_FLASH'`
- AND the baseline window remains unchanged

#### Scenario: Zero-variance baseline rejects sudden jump in <1s
- GIVEN a trusted baseline of ≥5 identical positive prices (`stdDev === 0`)
- WHEN a different price arrives within `< 1000ms`
- THEN the guard returns `REJECTED` with `reason: 'OUTLIER_4SIGMA_FLASH'` and `zScore: Infinity`

#### Scenario: Corrupt value or cold-start warm-up
- GIVEN any baseline state
- WHEN a tick has `NaN`, `Infinity`, or `<= 0`
- THEN the guard returns `REJECTED` (`NON_FINITE_OR_NON_POSITIVE`)
- WHEN a finite positive tick arrives with `< 5` baseline ticks
- THEN the guard returns `ACCEPTED` (`WARMUP`)

### Requirement: Strict HTTPS Fetch with 3s Timeout and Zod Sanitization

External HTTP calls MUST reject non-HTTPS URLs before sending requests, abort after `3000ms`, parse error payloads defensively (without relying on `statusText`), validate JSON via schema, and NEVER throw unhandled exceptions.

#### Scenario: Non-HTTPS URL rejected immediately
- GIVEN a URL starting with `http://`
- WHEN `safeFetch` is invoked
- THEN no network request is made and it returns `{ ok: false, code: 'INSECURE_URL' }`

#### Scenario: Network call exceeding 3000ms aborts cleanly
- GIVEN an HTTPS endpoint that does not respond within `3000ms`
- WHEN `safeFetch` runs with default timeout
- THEN the request aborts and returns `{ ok: false, code: 'TIMEOUT' }`

#### Scenario: Malformed payload rejected by schema
- GIVEN an HTTPS `200` response whose JSON violates the Zod schema
- WHEN `safeFetch` parses the body
- THEN it returns `{ ok: false, code: 'INVALID_PAYLOAD' }`

### Requirement: Stale-While-Revalidate Cache and Strict Fail-Closed Gate

The system MUST persist accepted snapshots locally and classify snapshots older than `10 minutes` (`600000ms`) as `STALE`. On network failure or anomaly, the system MUST NOT crash, MUST retain the last trusted snapshot, and MUST set `canRecommendArbitrage = false`. Arbitrage recommendations SHALL be enabled ONLY when status is `FRESH`.

#### Scenario: Valid fresh fetch caches snapshot and unlocks recommendations
- GIVEN an HTTPS fetch returns valid data accepted by the outlier guard
- WHEN `fetchWithIntegrity` runs
- THEN the snapshot is persisted to cache, status is `FRESH`, and `canRecommendArbitrage` is `true`

#### Scenario: Network failure falls back to cached snapshot and blocks recommendations
- GIVEN a cached trusted snapshot exists and the network fetch fails or times out
- WHEN `fetchWithIntegrity` runs
- THEN it returns the cached snapshot without throwing, sets `canRecommendArbitrage` to `false`, and marks status `STALE` if `age > 600000ms` or `OFFLINE_FALLBACK` otherwise

#### Scenario: Flash outlier blocks recommendations and preserves previous cache
- GIVEN a valid cached snapshot exists and a new response fails the `>4σ` guard
- WHEN `fetchWithIntegrity` runs
- THEN cache is NOT overwritten, status is `ANOMALY_BLOCKED`, and `canRecommendArbitrage` is `false`

### Requirement: Non-Interactive Visible Status Badge

The UI MUST expose an `IntegrityBadge` atom rendering `role="status"` (never a button), a single Lucide icon (no emojis), semantic status color (emerald `FRESH`, yellow `STALE`/`OFFLINE_FALLBACK`, rose `ANOMALY_BLOCKED`/`OFFLINE_EMPTY`), and timestamp formatted to the second (`HH:mm:ss`).

#### Scenario: Badge displays stale state with second-precision timestamp
- GIVEN status is `STALE` and `capturedAtMs` is a valid timestamp
- WHEN `IntegrityBadge` renders
- THEN it displays `HH:mm:ss` precision, yellow semantic styling, and no `button` role
