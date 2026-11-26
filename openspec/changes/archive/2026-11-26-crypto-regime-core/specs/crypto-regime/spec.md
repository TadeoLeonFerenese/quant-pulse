# crypto-regime Specification

## Purpose

Provide Quant-Pulse's Core 2 probabilistic crypto risk engine across an extensible watchlist (including `ADA`, `BTC`, `ETH`, `SOL`, `BNB`, `XRP`, `LINK`): market regime classification, perpetual funding/OI cascade alerts, parametric + historical VaR (95%/99%), `R:R > 2.5:1` entry filtering, public Binance REST ingestion, and Core 3 fail-closed gating.

## Requirements

### Requirement: Log Returns and 3-State Market Regime Detection

The math domain MUST compute log returns (`ln(P_t / P_{t-1})`) and classify price series into `RANGE_LOW_VOL`, `STRONG_TREND`, or `PANIC_LIQUIDATION` using Welford volatility, Kaufman Efficiency Ratio, and tail-drop detection, returning `INSUFFICIENT_HISTORY` or `INVALID_INPUT` safely.

#### Scenario: Steady directional series classifies as STRONG_TREND
- GIVEN ≥10 strictly rising positive prices with cumulative move ≥5% and low noise (`ER >= 0.55`)
- WHEN `detectMarketRegime` runs
- THEN status is `READY`, `regime` is `STRONG_TREND`, and `trendDirection` is `UP`

#### Scenario: Tight oscillating series classifies as RANGE_LOW_VOL
- GIVEN ≥10 prices oscillating tightly in a narrow band
- WHEN `detectMarketRegime` runs
- THEN `regime` is `RANGE_LOW_VOL`

#### Scenario: Crash or extreme volatility classifies as PANIC_LIQUIDATION
- GIVEN ≥10 prices ending in a single-period drop `<= -8%` (or per-period volatility `>= 6%`)
- WHEN `detectMarketRegime` runs
- THEN `regime` is `PANIC_LIQUIDATION`

#### Scenario: Short or corrupt price series rejected safely
- GIVEN fewer than `minPrices` samples or a `<= 0` / `NaN` price
- WHEN `detectMarketRegime` or `calculateLogReturns` runs
- THEN it returns `INSUFFICIENT_HISTORY`, `INVALID_INPUT`, or `null` without `NaN`/`Infinity`

### Requirement: Funding Rate and Open Interest Liquidation Cascade Risk

The math domain MUST evaluate perpetual funding rate alongside Open Interest change to flag `CASCADE_LONG_SQUEEZE`, `CASCADE_SHORT_SQUEEZE`, `ELEVATED`, or `NORMAL`.

#### Scenario: Extreme funding plus OI spike triggers cascade squeeze alert
- GIVEN `fundingRate >= 0.0008` and `openInterestChangePct >= 0.10`
- WHEN `evaluateFundingCascadeRisk` runs
- THEN `level` is `CASCADE_LONG_SQUEEZE`
- WHEN `fundingRate <= -0.0008` and `openInterestChangePct >= 0.10`
- THEN `level` is `CASCADE_SHORT_SQUEEZE`

#### Scenario: Normal or single-factor pressure classified accurately
- GIVEN normal funding (`0.0001`) and modest OI (`0.02`)
- WHEN `evaluateFundingCascadeRisk` runs
- THEN `level` is `NORMAL`
- WHEN only funding is extreme OR only OI spikes
- THEN `level` is `ELEVATED`

### Requirement: Parametric & Historical VaR (95%/99%) and R:R > 2.5:1 Viability

The math domain MUST compute Gaussian parametric and empirical historical VaR at 95% and 99% confidence, take `max(parametricVaR95, historicalVaR95)` as the conservative downside band, and mark `isAsymmetricallyViable = true` ONLY when `upsideRewardPct / conservativeDownsideRiskPct > 2.5`.

#### Scenario: High upside vs conservative VaR95 passes 2.5:1 viability
- GIVEN ≥20 log returns with conservative VaR95 ≈ 4% and upside target +15% (`R:R ≈ 3.75`)
- WHEN `calculateVaRAndAsymmetry` runs
- THEN `parametricVaR99 >= parametricVaR95`, `historicalVaR99 >= historicalVaR95`, `rewardToRiskRatio > 2.5`, and `isAsymmetricallyViable` is `true`

#### Scenario: Poor reward-to-risk fails viability check
- GIVEN upside target +5% against conservative VaR95 ≈ 4% (`R:R ≈ 1.25`)
- WHEN `calculateVaRAndAsymmetry` runs
- THEN `isAsymmetricallyViable` is `false`

### Requirement: Public Binance Ingestion, Extensible Watchlist (incl. ADA), and Core 3 Fail-Closed Gate

The Binance client MUST fetch `premiumIndex`, `openInterest`, and `klines` over strict HTTPS with zero API keys via Core 3 `safeFetch`, parsing string numbers with Zod. The crypto store MUST include `ADA` in its default watchlist and support dynamic `addSymbol`/`removeSymbol`. `evaluateCryptoSignal` MUST return `BLOCKED` whenever Core 3 `canRecommendArbitrage` is `false`.

#### Scenario: Binance public endpoints parse ADAUSDT cleanly and reject malformed strings
- GIVEN valid Binance JSON responses for `ADAUSDT`
- WHEN `fetchBinanceCryptoSnapshot` runs via `createSafeFetcher`
- THEN it returns numeric `markPrice`, `fundingRate`, `openInterest`, and close prices
- WHEN any string number is non-numeric or `<= 0`
- THEN it returns `{ ok: false, code: 'INVALID_PAYLOAD' }`

#### Scenario: Core 3 gate blocks crypto signal and watchlist supports ADA + custom symbols
- GIVEN a viable `R:R > 3.0` setup on `ADA`
- WHEN `evaluateCryptoSignal` runs with `canRecommendArbitrage: false`
- THEN `signal` is `BLOCKED` and `canRecommendArbitrage` is `false`
- WHEN `useCryptoStore` initializes
- THEN `watchlist` contains `'ADA'` alongside `'BTC'`, `'ETH'`, `'SOL'` and supports adding `'AVAX'`
