import { describe, expect, it, vi } from 'vitest';
import { createSafeFetcher } from '@/infrastructure/http/safeFetch';
import { DOLAR_API_URL, fetchDolarApiQuotes } from './dolarApiClient';

const validPayload = [
  {
    moneda: 'USD',
    casa: 'oficial',
    nombre: 'Oficial',
    compra: 1000,
    venta: 1040,
    fechaActualizacion: '2026-11-26T15:00:00.000Z',
  },
  {
    moneda: 'USD',
    casa: 'bolsa',
    nombre: 'Bolsa',
    compra: 1180,
    venta: 1190,
    fechaActualizacion: '2026-11-26T15:00:00.000Z',
  },
  {
    moneda: 'USD',
    casa: 'contadoconliqui',
    nombre: 'Contado con liquidación',
    compra: 1200,
    venta: 1215,
    fechaActualizacion: '2026-11-26T15:00:00.000Z',
  },
  {
    moneda: 'USD',
    casa: 'blue',
    nombre: 'Blue',
    compra: 1220,
    venta: 1240,
    fechaActualizacion: '2026-11-26T15:00:00.000Z',
  },
  {
    moneda: 'USD',
    casa: 'cripto',
    nombre: 'Cripto',
    compra: 1210,
    venta: 1230,
    fechaActualizacion: '2026-11-26T15:00:00.000Z',
  },
];

describe('fetchDolarApiQuotes', () => {
  it('points to strict HTTPS DolarApi endpoint', () => {
    expect(DOLAR_API_URL).toBe('https://dolarapi.com/v1/dolares');
  });

  it('maps bolsa, contadoconliqui, blue, and cripto into typed FxQuote entries', async () => {
    const fetchSpy = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(validPayload), { status: 200 }));

    const result = await fetchDolarApiQuotes(createSafeFetcher(fetchSpy));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.MEP).toEqual({
      kind: 'MEP',
      bid: 1180,
      ask: 1190,
      updatedAtMs: Date.parse('2026-11-26T15:00:00.000Z'),
    });
    expect(result.data.CCL.ask).toBe(1215);
    expect(result.data.BLUE.ask).toBe(1240);
    expect(result.data.CRIPTO.ask).toBe(1230);
  });

  it('rejects payload with null compra, inverted venta < compra, invalid date, or missing required casa', async () => {
    const badPayloads = [
      validPayload.map((row) => (row.casa === 'blue' ? { ...row, compra: null } : row)),
      validPayload.map((row) =>
        row.casa === 'bolsa' ? { ...row, compra: 1250, venta: 1190 } : row,
      ),
      validPayload.map((row) =>
        row.casa === 'cripto' ? { ...row, fechaActualizacion: 'not-a-date' } : row,
      ),
      validPayload.filter((row) => row.casa !== 'contadoconliqui'),
    ];

    for (const bad of badPayloads) {
      const fetchSpy = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(JSON.stringify(bad), { status: 200 }));

      const result = await fetchDolarApiQuotes(createSafeFetcher(fetchSpy));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('INVALID_PAYLOAD');
      }
    }
  });
});
