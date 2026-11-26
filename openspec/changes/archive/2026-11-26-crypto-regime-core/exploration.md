## Exploration: crypto-regime-core

### Current State
- `main` (`b4bf32c`) has `scaffolding-base`, `data-integrity-core` (Core 3), and `macro-arbitrage-core` (Core 1) complete with 60/60 tests passing, `strict_tdd: true`, and 100% coverage in `src/domain/math/**`.
- `AGENT.md` Core 2 requires: 3-state market regime detection (Range/Low-Vol, Strong Trend, Panic/Mass Liquidation), perpetual funding rates + Open Interest liquidation cascade risk, and parametric + historical VaR (95% & 99%) with asymmetric entry viability (`R:R > 2.5:1`) — gated fail-closed by Core 3.
- User preference (`#638`): watchlist MUST support multiple cryptos and specifically include **ADA** alongside BTC, ETH, SOL, etc. (extensible symbols, not hardcoded to 3 coins).

### Affected Areas (all NEW)
- `src/domain/math/cryptoRisk.ts` — pure quant math (100% coverage, Welford stable stats):
  - `calculateLogReturns(prices)` — `ln(P_t / P_{t-1})`, rejects non-finite or `<= 0`
  - `detectMarketRegime(prices, options?)` — classifies into `RANGE_LOW_VOL | STRONG_TREND | PANIC_LIQUIDATION` via Kaufman Efficiency Ratio (`|P_n - P_0| / sum(|ΔP|)`) + Welford volatility + tail-drop shock detection, plus `trendDirection: 'UP' | 'DOWN' | 'FLAT'`
  - `evaluateFundingCascadeRisk(input)` — perpetual funding rate + OI spike → `NORMAL | ELEVATED | CASCADE_LONG_SQUEEZE | CASCADE_SHORT_SQUEEZE`
  - `calculateVaRAndAsymmetry(input)` — Parametric (Gaussian `z95=1.64485`, `z99=2.32635`) + Historical (empirical 5% & 1% quantiles) VaR; conservative downside band = `max(paramVaR95, histVaR95)`; `rewardToRiskRatio = upsideRewardPct / downsideRiskPct`; `isAsymmetricallyViable = R:R > 2.5`
- `src/domain/crypto/types.ts` — extensible `CryptoAssetSymbol` (default watchlist: `BTC`, `ETH`, `SOL`, `ADA`, `BNB`, `XRP`, `LINK` → Binance `${symbol}USDT`), `CryptoMarketSnapshot`, `CryptoRiskEvaluation`
- `src/infrastructure/feeds/binanceClient.ts` — Zod-validated public REST adapter via Core 3 `safeFetch` (ZERO API keys needed!):
  - `GET https://fapi.binance.com/fapi/v1/premiumIndex?symbol=...` (`markPrice`, `lastFundingRate`, `nextFundingTime`)
  - `GET https://fapi.binance.com/fapi/v1/openInterest?symbol=...` (`openInterest`)
  - `GET https://api.binance.com/api/v3/klines?symbol=...&interval=1d&limit=31` (close prices at index `4`)
- `src/application/crypto/evaluateCryptoSignal.ts` — combines regime + funding cascade + VaR/R:R + Core 3 `canRecommendArbitrage` fail-closed gate
- `src/application/stores/useCryptoStore.ts` — atomic Zustand store with extensible watchlist (`DEFAULT_CRYPTO_WATCHLIST` including `ADA`), `addSymbol`/`removeSymbol`, snapshots per asset, and pure selector `selectCryptoEvaluation`

### Approaches

| Decision | Option A | Option B | Recommendation |
|---|---|---|---|
| Default watchlist | `['BTC', 'ETH', 'SOL', 'ADA', 'BNB', 'XRP', 'LINK']` + `addSymbol`/`removeSymbol` | Fixed `['BTC', 'ETH', 'SOL', 'ADA']` only | **Option A** — covers major caps + ADA out of the box and lets user add any Binance USDT pair |
| Downside risk for R:R (>2.5:1) | **Conservative `max(parametricVaR95, historicalVaR95)`** (protects against fat crypto tails) | Parametric VaR 95% only (underestimates fat-tail crashes) | **Option A** — crypto returns are leptokurtic (fat-tailed); taking the stricter of parametric & historical avoids false viable entries |
| Binance public adapter | Include `binanceClient.ts` now (no keys, Zod + Core 3 `safeFetch`) | Pure math + store only | **Option A** — completes end-to-end Core 2 + Core 3 integration just like DolarApi in Core 1 |

### Risks
- **Binance string numbers**: `markPrice`, `lastFundingRate`, `openInterest`, and kline `close` arrive as JSON strings → Zod parses and validates finite bounds strictly.
- **CORS in desktop browser vs Capacitor**: Binance public `api.binance.com` / `fapi.binance.com` work over HTTPS in Capacitor/mobile; tests use stubbed `fetch` via `createSafeFetcher`.
- **Small return samples for VaR 99%**: Empirical 1% quantile needs enough history (enforce `minReturns = 20` or return `INSUFFICIENT_HISTORY`).

### Ready for Proposal
Yes — confirm 2 quick items with user:
1. Default watchlist: `BTC, ETH, SOL, ADA, BNB, XRP, LINK` (extensible), or want any other specific coins added by default?
2. Include `binanceClient.ts` (public HTTPS endpoints, no API key) in this change + conservative `max(parametricVaR95, historicalVaR95)` for the R:R > 2.5:1 check?
