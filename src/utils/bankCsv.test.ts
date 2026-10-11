import { describe, expect, it } from 'vitest';
import {
  aggregateBankByMonth,
  buildReconcileRows,
  parseAmount,
  parseBankCsv,
  parseBankDate,
  splitCsvLine,
} from './bankCsv';

describe('bankCsv', () => {
  it('parses Danish amounts', () => {
    expect(parseAmount('-1.234,56')).toBeCloseTo(-1234.56);
    expect(parseAmount('1234,50')).toBeCloseTo(1234.5);
    expect(parseAmount('(500,00)')).toBeCloseTo(-500);
    expect(parseAmount('kr. 99.95')).toBeCloseTo(99.95);
  });

  it('parses common date formats', () => {
    const d1 = parseBankDate('15-08-2026');
    expect(d1?.getFullYear()).toBe(2026);
    expect(d1?.getMonth()).toBe(7);
    expect(d1?.getDate()).toBe(15);
    const d2 = parseBankDate('2026-08-15');
    expect(d2?.getMonth()).toBe(7);
  });

  it('splits semicolon CSV with quotes', () => {
    expect(splitCsvLine('Dato;Beløb;Tekst', ';')).toEqual(['Dato', 'Beløb', 'Tekst']);
    expect(splitCsvLine('01-08-2026;"-1.000,00";"Husleje, Aalborg"', ';')).toEqual([
      '01-08-2026',
      '-1.000,00',
      'Husleje, Aalborg',
    ]);
  });

  it('parses a Danish-style statement and aggregates August', () => {
    const csv = [
      'Dato;Beløb;Tekst',
      '01-08-2026;17947,00;Løn',
      '05-08-2026;-6130,00;Husleje',
      '11-08-2026;-20000,00;Afdrag Carsten',
      '12-08-2026;-4840,00;Rome Ferie',
      '01-07-2026;-100,00;Ignored other month pattern but same year',
    ].join('\n');

    const parsed = parseBankCsv(csv);
    expect(parsed.transactions.length).toBe(5);
    const byMonth = aggregateBankByMonth(parsed.transactions, 2026);
    expect(byMonth[7].income).toBeCloseTo(17947);
    expect(byMonth[7].expense).toBeCloseTo(6130 + 20000 + 4840);
    expect(byMonth[6].expense).toBeCloseTo(100);
  });

  it('builds reconcile diffs bank − budget', () => {
    const rows = buildReconcileRows(
      [
        { month: 'August', income: 17947, netExpense: 21940 },
      ],
      [
        {
          monthIndex: 0,
          month: 'August',
          income: 17947,
          expense: 30970,
          count: 4,
        },
      ]
    );
    expect(rows[0].expenseDiff).toBeCloseTo(30970 - 21940);
    expect(rows[0].incomeDiff).toBe(0);
  });
});
