import { BUDGET_MONTHS } from './budgetMath';

export type LoanLike = {
  id: string;
  name: string;
  amount: number;
  startDate: string;
};

export type BudgetItemLike = {
  id?: string;
  name?: string;
  type?: 'income' | 'expense';
  months?: { [key: string]: unknown };
  linkedLoanId?: string;
};

export type LoanPaymentEntry = {
  key: string;
  loanId: string;
  loanName: string;
  expenseName: string;
  year: string;
  month: string;
  /** Approximate calendar date for the payment (YYYY-MM-DD). */
  date: string;
  amount: number;
  /** Remaining balance after this payment (chronological). */
  remainingAfter: number;
};

export type LoanSummary = {
  loan: LoanLike;
  payments: LoanPaymentEntry[];
  totalPaid: number;
  remaining: number;
  isDone: boolean;
};

function monthIndex(month: string): number {
  return (BUDGET_MONTHS as readonly string[]).indexOf(month);
}

function paymentDayFromStartDate(startDate: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((startDate || '').trim());
  if (!m) return 1;
  const day = parseInt(m[3], 10);
  if (!Number.isFinite(day) || day < 1) return 1;
  return Math.min(day, 28); // keep valid for all months
}

function toYyyyMmDd(year: number, monthIdx: number, day: number): string {
  const y = String(year);
  const mo = String(monthIdx + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}-${mo}-${d}`;
}

function monthAmount(months: { [key: string]: unknown } | undefined, month: string): number {
  if (!months) return 0;
  const raw = months[month];
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n) || n === 0) return 0;
  return n;
}

/** Build per-month payments from linked budget expenses, newest first within each loan. */
export function buildLoanSummaries(
  loans: LoanLike[],
  budgetData: { [year: string]: BudgetItemLike[] }
): LoanSummary[] {
  const years = Object.keys(budgetData).sort(
    (a, b) => parseInt(a, 10) - parseInt(b, 10)
  );

  return loans.map((loan) => {
    const day = paymentDayFromStartDate(loan.startDate);
    const startYear = (() => {
      const m = /^(\d{4})/.exec((loan.startDate || '').trim());
      return m ? parseInt(m[1], 10) : NaN;
    })();

    const chronologic: LoanPaymentEntry[] = [];

    for (const year of years) {
      const yearNum = parseInt(year, 10);
      if (Number.isFinite(startYear) && yearNum < startYear) continue;

      const items = (budgetData[year] || []).filter(
        (item) => item.type === 'expense' && item.linkedLoanId === loan.id
      );

      for (const month of BUDGET_MONTHS) {
        const mi = monthIndex(month);
        if (mi < 0) continue;

        for (const item of items) {
          const amount = monthAmount(item.months, month);
          if (amount === 0) continue;

          chronologic.push({
            key: `${loan.id}-${year}-${month}-${item.id || item.name || 'x'}`,
            loanId: loan.id,
            loanName: loan.name,
            expenseName: (item.name && String(item.name).trim()) || loan.name,
            year,
            month,
            date: toYyyyMmDd(yearNum, mi, day),
            amount,
            remainingAfter: 0,
          });
        }
      }
    }

    chronologic.sort((a, b) => {
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp !== 0) return dateCmp;
      return a.expenseName.localeCompare(b.expenseName, undefined, { sensitivity: 'base' });
    });

    let remaining = loan.amount;
    let totalPaid = 0;
    for (const payment of chronologic) {
      totalPaid += payment.amount;
      remaining = Math.max(0, remaining - payment.amount);
      payment.remainingAfter = remaining;
    }

    const isDone = loan.amount > 0 && remaining <= 0 && totalPaid > 0;

    // Newest payments first for display
    const payments = [...chronologic].reverse();

    return {
      loan,
      payments,
      totalPaid,
      remaining,
      isDone,
    };
  });
}
