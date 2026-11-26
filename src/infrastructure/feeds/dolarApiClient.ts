import { z } from 'zod';
import type { FetchResult, HttpFetcherPort } from '@/domain/integrity/ports';
import type { DollarKind, FxQuote, FxQuoteMap } from '@/domain/macro/types';

export const DOLAR_API_URL = 'https://dolarapi.com/v1/dolares';

const CASA_TO_DOLLAR_KIND: Readonly<Record<string, DollarKind>> = {
  bolsa: 'MEP',
  contadoconliqui: 'CCL',
  blue: 'BLUE',
  cripto: 'CRIPTO',
};

const rawDolarRowSchema = z.object({
  moneda: z.string(),
  casa: z.string(),
  nombre: z.string(),
  compra: z.number().nullable(),
  venta: z.number().nullable(),
  fechaActualizacion: z.string(),
});

export const dolarApiQuotesSchema = z
  .array(rawDolarRowSchema)
  .transform((rows, ctx): FxQuoteMap => {
    const mapped: Partial<Record<DollarKind, FxQuote>> = {};

    for (const row of rows) {
      const kind = CASA_TO_DOLLAR_KIND[row.casa];
      if (kind === undefined) {
        continue;
      }

      if (
        row.compra === null ||
        row.venta === null ||
        !Number.isFinite(row.compra) ||
        !Number.isFinite(row.venta) ||
        row.compra <= 0 ||
        row.venta < row.compra
      ) {
        ctx.addIssue({
          code: 'custom',
          message: `Invalid bid/ask for ${row.casa}`,
        });
        return z.NEVER;
      }

      const updatedAtMs = Date.parse(row.fechaActualizacion);
      if (!Number.isFinite(updatedAtMs)) {
        ctx.addIssue({
          code: 'custom',
          message: `Invalid fechaActualizacion for ${row.casa}`,
        });
        return z.NEVER;
      }

      mapped[kind] = {
        kind,
        bid: row.compra,
        ask: row.venta,
        updatedAtMs,
      };
    }

    if (
      mapped.MEP === undefined ||
      mapped.CCL === undefined ||
      mapped.BLUE === undefined ||
      mapped.CRIPTO === undefined
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'Missing one or more required dollar quotes (MEP, CCL, BLUE, CRIPTO)',
      });
      return z.NEVER;
    }

    return {
      MEP: mapped.MEP,
      CCL: mapped.CCL,
      BLUE: mapped.BLUE,
      CRIPTO: mapped.CRIPTO,
    };
  });

export function fetchDolarApiQuotes(
  fetcher: HttpFetcherPort,
  timeoutMs?: number,
): Promise<FetchResult<FxQuoteMap>> {
  return fetcher.fetchJson(DOLAR_API_URL, dolarApiQuotesSchema, timeoutMs);
}
