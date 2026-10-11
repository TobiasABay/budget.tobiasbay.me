import { describe, expect, it } from 'vitest';
import {
  BUDGET_MONTHS,
  formatReportingPeriodLabel,
  isIncompleteCurrentMonth,
  monthCashSavings,
  monthLivingExpenses,
  monthNetTotalExpense,
  monthNordnetNet,
  summarizeBudgetYear,
  type BudgetMathItem,
} from './budgetMath';

/** Minimal fixture shaped like 2026 Aug (Afdrag + Nordnet withdrawal) and year totals. */
function buildFixture(): BudgetMathItem[] {
  const months = (values: number[]): { [key: string]: number } => {
    const out: { [key: string]: number } = {};
    BUDGET_MONTHS.forEach((m, i) => {
      if (values[i]) out[m] = values[i];
    });
    return out;
  };

  return [
    {
      type: 'income',
      name: 'Danish Crown',
      months: months([27345, 29285, 17823, 21018, 31121, 26125, 23099, 17947, 0, 0, 0, 0]),
    },
    {
      type: 'income',
      name: 'Boligstøtte',
      months: months([1015, 1015, 0, 0, 1014, 1014, 0, 0, 662, 0, 0, 0]),
    },
    {
      type: 'income',
      name: 'Årsopgørelse',
      months: months([0, 0, 0, 3700, 0, 0, 0, 0, 0, 0, 0, 0]),
    },
    {
      type: 'income',
      name: 'Fødevarecheck',
      months: months([0, 0, 0, 0, 2500, 0, 0, 0, 0, 0, 0, 0]),
    },
    {
      type: 'income',
      name: 'Tesla',
      months: months([0, 0, 0, 0, 0, 0, 0, 0, 26241, 0, 0, 0]),
    },
    // Collapsed living proxy per month (matches audited living totals)
    {
      type: 'expense',
      name: 'Living bundle',
      months: months([13930, 25585, 22826, 15708, 19832, 18529, 15232, 41940, 19869, 388, 0, 0]),
    },
    {
      type: 'expense',
      name: 'Nordnet',
      months: months([14400, 3000, 0, 10800, 7000, 12000, 0, -20000, 0, 0, 0, 0]),
    },
  ];
}

describe('budgetMath', () => {
  it('treats August withdrawal as reducing Total Expense, not inflating it', () => {
    const items = buildFixture();
    const living = monthLivingExpenses(items, 'August');
    const nord = monthNordnetNet(items, 'August');
    const netExp = monthNetTotalExpense(items, 'August');
    expect(living).toBe(41940);
    expect(nord).toBe(-20000);
    expect(netExp).toBe(21940);
  });

  it('computes August cash savings with withdrawal funding Afdrag', () => {
    const income = 17947;
    const living = 41940;
    const nord = -20000;
    expect(monthCashSavings(income, living, nord)).toBe(-3993);
  });

  it('keeps wealth = cash + Nordnet = economic surplus', () => {
    const items = buildFixture();
    // Freeze "now" in November so October counts toward averages
    const summary = summarizeBudgetYear(items, {
      budgetYear: '2026',
      now: new Date(2026, 10, 1),
    });
    expect(summary.totalCashSavings).toBe(9885);
    expect(summary.totalNordnet).toBe(27200);
    expect(summary.wealth).toBe(37085);
    expect(summary.totalEconomicSavings).toBe(37085);
    expect(summary.wealth).toBe(summary.totalCashSavings + summary.totalNordnet);
    expect(Math.round(summary.savingsRate * 10) / 10).toBe(16.1);
  });

  it('excludes incomplete current month from averages but keeps YTD totals', () => {
    const items = buildFixture();
    // "Today" is 11 Oct 2026 — October should drop from averages
    const summary = summarizeBudgetYear(items, {
      budgetYear: '2026',
      now: new Date(2026, 9, 11),
    });
    expect(summary.totalIncome).toBe(230924);
    expect(summary.averageMonths.every((m) => m.month !== 'October')).toBe(true);
    expect(summary.averageMonths.some((m) => m.month === 'September')).toBe(true);
    // Averages use Jan–Sep active months only (Oct excluded)
    const avgIncomeWithoutOct =
      summary.averageMonths.reduce((s, m) => s + m.income, 0) / summary.averageMonths.length;
    expect(summary.averageMonthlyIncome).toBe(avgIncomeWithoutOct);
  });

  it('exposes cash savings rate and withdrawals separately from economic rate', () => {
    const items = buildFixture();
    const summary = summarizeBudgetYear(items, {
      budgetYear: '2026',
      now: new Date(2026, 10, 1),
    });
    expect(summary.totalWithdrawals).toBe(20000);
    expect(Math.round(summary.savingsRate * 10) / 10).toBe(16.1);
    expect(Math.round(summary.cashSavingsRate * 10) / 10).toBe(4.3);
    expect(summary.totalNetExpense).toBe(summary.totalLiving - summary.totalWithdrawals);
  });

  it('labels incomplete YTD period', () => {
    expect(isIncompleteCurrentMonth(9, '2026', new Date(2026, 9, 11))).toBe(true);
    expect(isIncompleteCurrentMonth(8, '2026', new Date(2026, 9, 11))).toBe(false);
    const label = formatReportingPeriodLabel('2026', new Date(2026, 9, 11));
    expect(label.incompleteMonth).toBe('October');
    expect(label.label).toContain('incomplete');
  });
});
