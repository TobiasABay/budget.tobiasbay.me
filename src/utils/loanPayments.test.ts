import { describe, expect, it } from 'vitest';
import { buildLoanSummaries } from './loanPayments';

describe('buildLoanSummaries', () => {
  it('lists each linked month cell as a payment and marks loan done', () => {
    const summaries = buildLoanSummaries(
      [{ id: 'l1', name: 'Car', amount: 10000, startDate: '2026-01-15' }],
      {
        '2026': [
          {
            id: 'e1',
            name: 'Car payment',
            type: 'expense',
            linkedLoanId: 'l1',
            months: { January: 6000, February: 4000, _formulas: { January: 'x' } as unknown as number },
          },
        ],
      }
    );

    expect(summaries).toHaveLength(1);
    const s = summaries[0];
    expect(s.isDone).toBe(true);
    expect(s.remaining).toBe(0);
    expect(s.totalPaid).toBe(10000);
    expect(s.payments).toHaveLength(2);
    // Newest first
    expect(s.payments[0]).toMatchObject({
      date: '2026-02-15',
      amount: 4000,
      loanName: 'Car',
      expenseName: 'Car payment',
      remainingAfter: 0,
    });
    expect(s.payments[1]).toMatchObject({
      date: '2026-01-15',
      amount: 6000,
      remainingAfter: 4000,
    });
  });

  it('keeps loan open when underpaid', () => {
    const [s] = buildLoanSummaries(
      [{ id: 'l1', name: 'Bike', amount: 5000, startDate: '2025-06-01' }],
      {
        '2025': [
          {
            id: 'e1',
            name: 'Bike',
            type: 'expense',
            linkedLoanId: 'l1',
            months: { June: 1000 },
          },
        ],
      }
    );
    expect(s.isDone).toBe(false);
    expect(s.remaining).toBe(4000);
  });
});
