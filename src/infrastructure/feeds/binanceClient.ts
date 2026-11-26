import { z } from 'zod';
import {
  normalizeCryptoSymbol,
  toBinanceUsdtPair,
  type CryptoMarketSnapshot,
} from '@/domain/crypto/types';
import type { FetchResult, HttpFetcherPort } from '@/domain/integrity/ports';

const BINANCE_FAPI_BASE = 'https://fapi.binance.com/fapi/v1';
const BINANCE_SPOT_BASE = 'https://api.binance.com/api/v3';

const finiteNumberString = z.string().transform((raw, ctx): number => {
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    ctx.addIssue({ code: 'custom', message: `Expected finite numeric string, got "${raw}"` });
    return z.NEVER;
  }
  return value;
});

const positiveNumberString = finiteNumberString.refine((n) => n > 0, {
  error: 'Expected positive number',
});

const premiumIndexSchema = z.object({
  symbol: z.string(),
  markPrice: positiveNumberString,
  lastFundingRate: finiteNumberString,
  time: z.number().int().positive(),
});

const openInterestSchema = z.object({
  symbol: z.string(),
  openInterest: positiveNumberString,
  time: z.number().int().positive(),
});

const klinesSchema = z
  .array(
    z.tuple([
      z.number(),
      z.string(),
      z.string(),
      z.string(),
      positiveNumberString,
      z.string(),
      z.number(),
      z.string(),
      z.number(),
      z.string(),
      z.string(),
      z.string(),
    ]),
  )
  .transform((rows) => rows.map((row) => row[4]));

export async function fetchBinanceCryptoSnapshot(
  rawSymbol: string,
  fetcher: HttpFetcherPort,
  options: { readonly previousOpenInterest?: number; readonly timeoutMs?: number } = {},
): Promise<FetchResult<CryptoMarketSnapshot>> {
  const symbol = normalizeCryptoSymbol(rawSymbol);
  const pair = toBinanceUsdtPair(symbol);

  const [premiumRes, oiRes, klinesRes] = await Promise.all([
    fetcher.fetchJson(
      `${BINANCE_FAPI_BASE}/premiumIndex?symbol=${pair}`,
      premiumIndexSchema,
      options.timeoutMs,
    ),
    fetcher.fetchJson(
      `${BINANCE_FAPI_BASE}/openInterest?symbol=${pair}`,
      openInterestSchema,
      options.timeoutMs,
    ),
    fetcher.fetchJson(
      `${BINANCE_SPOT_BASE}/klines?symbol=${pair}&interval=1d&limit=31`,
      klinesSchema,
      options.timeoutMs,
    ),
  ]);

  if (!premiumRes.ok) {
    return premiumRes;
  }
  if (!oiRes.ok) {
    return oiRes;
  }
  if (!klinesRes.ok) {
    return klinesRes;
  }

  const prevOi = options.previousOpenInterest;
  const openInterestChangePct =
    prevOi !== undefined && Number.isFinite(prevOi) && prevOi > 0
      ? (oiRes.data.openInterest - prevOi) / prevOi
      : 0;

  return {
    ok: true,
    data: {
      symbol,
      pair,
      markPrice: premiumRes.data.markPrice,
      fundingRate: premiumRes.data.lastFundingRate,
      openInterest: oiRes.data.openInterest,
      openInterestChangePct,
      dailyCloses: klinesRes.data,
      capturedAtMs: Math.max(premiumRes.data.time, oiRes.data.time),
    },
  };
}
