# macro-arbitrage Specification

## Purpose

Provide Quant-Pulse's Core 1 macro arbitrage engine: implicit FX ratios (MEP AL30/GD30, CCL, Blue, Cripto), net carry trade math after fees and slippage, two-sided 30/90-day gap Z-Score convergence detection, DolarApi ingestion, and strict fail-closed gating via Core 3.

## Requirements

### Requirement: Implicit Dollar and FX Gap Calculations

The math domain MUST compute implicit dollar rates (`arsBondPrice / usdBondPrice`) and percentage spreads (`(target - base) / base`), returning `null` for any non-finite or non-positive input.

#### Scenario: Valid AL30/GD30 implicit MEP calculation
- GIVEN positive finite prices `arsBondPrice = 60_000` and `usdBondPrice = 50`
- WHEN `calculateImplicitDollar` runs
- THEN it returns `1_200`

#### Scenario: Invalid or zero FX inputs fail safely
- GIVEN a zero, negative, or `NaN` bond or FX price
- WHEN `calculateImplicitDollar` or `calculateSpreadPct` runs
- THEN it returns `null` without returning `NaN` or `Infinity`

### Requirement: Net Carry Trade Calculator (TNA / TEA with Fees and Slippage)

The math domain MUST compute net USD return, net ARS/USD profit, `breakEvenExitUsdRate`, and a directional verdict (`FAVORS_CARRY | FAVORS_DOLLAR | NEUTRAL`) for both `TNA` and `TEA` rates after subtracting broker commissions and slippage.

#### Scenario: Profitable TNA carry trade net of fees and slippage
- GIVEN `capitalArs = 1_200_000`, `TNA = 0.48`, `horizonDays = 30`, `entryUsdRate = 1_200`, `projectedExitUsdRate = 1_210`, `brokerFeeRate = 0.01`, `slippageRate = 0.002`
- WHEN `calculateNetCarryTrade` runs
- THEN it deducts `1.2%` total friction, computes exact `finalUsd`, positive `netReturnUsdPct`, exact `breakEvenExitUsdRate`, and verdict `FAVORS_CARRY`

#### Scenario: Projected FX jump turns TEA carry trade unfavorable
- GIVEN a `TEA` rate whose net ARS yield is exceeded by the projected exit dollar rise plus friction
- WHEN `calculateNetCarryTrade` runs
- THEN `netReturnUsdPct` is negative and verdict is `FAVORS_DOLLAR`

#### Scenario: Invalid carry trade parameters rejected
- GIVEN `capitalArs <= 0`, `horizonDays <= 0`, or `brokerFeeRate + slippageRate >= 1`
- WHEN `calculateNetCarryTrade` runs
- THEN it returns `null`

### Requirement: Rolling 30/90-Day Gap Z-Score and Two-Sided Convergence Alert

The math domain MUST compute Z-Score over the latest `30` or `90` historical gap samples, trigger `PREMIUM_ANOMALY` when `Z > 2.0` and `DISCOUNT_ANOMALY` when `Z < -2.0` with normal-CDF reversion probability, and return `INSUFFICIENT_HISTORY` if fewer than `windowDays` samples exist.

#### Scenario: Gap exceeding +2.0 sigma emits PREMIUM_ANOMALY with reversion probability
- GIVEN 30 historical gap samples with known mean and positive `stdDev`
- WHEN `currentGap` yields `zScore > 2.0`
- THEN status is `READY`, signal is `PREMIUM_ANOMALY`, and `reversionProbability > 0.954`

#### Scenario: Compressed gap below -2.0 sigma emits DISCOUNT_ANOMALY
- GIVEN 30 or 90 historical gap samples
- WHEN `currentGap` yields `zScore < -2.0`
- THEN signal is `DISCOUNT_ANOMALY` and `reversionProbability > 0.954`

#### Scenario: Insufficient history or flat variance handled safely
- GIVEN fewer than `windowDays` samples
- WHEN `calculateRollingGapZScore` runs
- THEN it returns `status: 'INSUFFICIENT_HISTORY'`
- WHEN `stdDev === 0` and `currentGap === mean`
- THEN `zScore` is `0` and signal is `NORMAL`

### Requirement: DolarApi Ingestion and Core 3 Fail-Closed Macro Signal

The DolarApi adapter MUST validate `bolsa` (MEP), `contadoconliqui` (CCL), `blue`, and `cripto` quotes via Zod (rejecting null, non-positive, or inverted `venta < compra` quotes) through Core 3's `safeFetch`. Macro signal evaluation MUST return `trafficLight: 'BLOCKED'` whenever Core 3 `canRecommendArbitrage` is `false`.

#### Scenario: DolarApi response maps valid quotes and rejects corrupt rows
- GIVEN a valid DolarApi array containing `bolsa`, `contadoconliqui`, `blue`, and `cripto` with positive `compra <= venta`
- WHEN `fetchDolarApiQuotes` runs through `safeFetch`
- THEN it returns typed `FxQuote` entries for `MEP`, `CCL`, `BLUE`, and `CRIPTO`
- WHEN any required quote has `compra: null` or `venta < compra`
- THEN `safeFetch` returns `INVALID_PAYLOAD`

#### Scenario: Core 3 gate blocks macro signal regardless of Z-Score or carry profit
- GIVEN a profitable carry trade and `Z > 2.5` convergence opportunity
- WHEN `evaluateMacroSignal` runs with `canRecommendArbitrage: false`
- THEN `trafficLight` is `BLOCKED` and `canRecommendArbitrage` is `false`
