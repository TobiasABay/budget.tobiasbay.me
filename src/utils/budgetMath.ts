/**
 * Canonical budget math for the year-grid model.
 *
 * Definitions (do not change silently):
 * - Living = all expense cells except investment transfers (Nordnet-by-name today)
 * - Total Expense (display) = living − Nordnet withdrawals (funded spending does not inflate the total)
 * - Cash savings = income − living − Nordnet net (deposits reduce cash; withdrawals increase cash)
 * - Economic surplus = income − living (Nordnet is where part of the surplus sits)
 * - Wealth ≈ cash cumulative + Nordnet cumulative (= economic surplus over time)
 * - Savings rate = economic surplus / income
 */

export const BUDGET_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export type BudgetMonth = (typeof BUDGET_MONTHS)[number];

export type BudgetMathItem = {
  type: 'income' | 'expense';
  name: string;
  months?: { [key: string]: number };
  category?: string | null;
};

/** Investment transfer row (currently name-matched "nordnet"). Positive = deposit, negative = withdrawal. */
export function isInvestmentTransferItem(item: BudgetMathItem): boolean {
  return item.type === 'expense' && item.name.toLowerCase().trim().includes('nordnet');
}

/** @deprecated Prefer isInvestmentTransferItem — kept for call-site clarity during migration. */
export const isNordnetItem = isInvestmentTransferItem;

export function monthIncome(items: BudgetMathItem[], month: string): number {
  return items
    .filter((item) => item.type === 'income')
    .reduce((sum, item) => sum + (item.months?.[month] || 0), 0);
}

export function monthLivingExpenses(items: BudgetMathItem[], month: string): number {
  return items
    .filter((item) => item.type === 'expense' && !isInvestmentTransferItem(item))
    .reduce((sum, item) => sum + (item.months?.[month] || 0), 0);
}

export function monthNordnetNet(items: BudgetMathItem[], month: string): number {
  return items
    .filter((item) => isInvestmentTransferItem(item))
    .reduce((sum, item) => sum + (item.months?.[month] || 0), 0);
}

export function nordnetWithdrawalCash(nordnetNet: number): number {
  return nordnetNet < 0 ? -nordnetNet : 0;
}

/** Living minus withdrawals — what Total Expense shows in the grid. */
export function monthNetTotalExpense(items: BudgetMathItem[], month: string): number {
  const living = monthLivingExpenses(items, month);
  return living - nordnetWithdrawalCash(monthNordnetNet(items, month));
}

export function monthCashSavings(income: number, living: number, nordnetNet: number): number {
  return income - living - nordnetNet;
}

export function monthEconomicSavings(income: number, living: number): number {
  return income - living;
}

export type MonthSummary = {
  month: BudgetMonth;
  monthIndex: number;
  income: number;
  living: number;
  netExpense: number;
  nordnetNet: number;
  cashSavings: number;
  economicSavings: number;
  hasActivity: boolean;
};

export type YearSummary = {
  months: MonthSummary[];
  totalIncome: number;
  totalLiving: number;
  totalNetExpense: number;
  totalCashSavings: number;
  totalEconomicSavings: number;
  totalNordnet: number;
  wealth: number;
  /** Economic: (income − living) / income */
  savingsRate: number;
  /** Cash: cash savings / income */
  cashSavingsRate: number;
  /** Absolute Nordnet withdrawals in the year (positive number). */
  totalWithdrawals: number;
  /** Months used for averages (excludes incomplete current calendar month). */
  averageMonths: MonthSummary[];
  averageMonthlyIncome: number;
  averageMonthlyNetExpense: number;
  averageMonthlyCashSavings: number;
};

/** True when `monthIndex` is the current calendar month of `budgetYear`. */
export function isIncompleteCurrentMonth(
  monthIndex: number,
  budgetYear: string | undefined,
  now: Date = new Date()
): boolean {
  if (!budgetYear) return false;
  const y = Number.parseInt(budgetYear, 10);
  if (!Number.isFinite(y) || y !== now.getFullYear()) return false;
  return monthIndex === now.getMonth();
}

/** Short label for Insights period chips, e.g. "YTD through October (incomplete)". */
export function formatReportingPeriodLabel(
  budgetYear: string | undefined,
  now: Date = new Date()
): { label: string; incompleteMonth: string | null } {
  if (!budgetYear) {
    return { label: 'Full year', incompleteMonth: null };
  }
  const y = Number.parseInt(budgetYear, 10);
  if (!Number.isFinite(y)) {
    return { label: `Budget ${budgetYear}`, incompleteMonth: null };
  }
  if (y < now.getFullYear()) {
    return { label: `Full year ${budgetYear}`, incompleteMonth: null };
  }
  if (y > now.getFullYear()) {
    return { label: `Budget ${budgetYear} (future)`, incompleteMonth: null };
  }
  const incompleteMonth = BUDGET_MONTHS[now.getMonth()];
  return {
    label: `YTD through ${incompleteMonth} (incomplete)`,
    incompleteMonth,
  };
}

/**
 * Full-year rollup. Pass `budgetYear` (e.g. "2026") so the current calendar month
 * is excluded from averages while still included in YTD totals.
 */
export function summarizeBudgetYear(
  items: BudgetMathItem[],
  options?: { budgetYear?: string; now?: Date }
): YearSummary {
  const now = options?.now ?? new Date();
  const months: MonthSummary[] = BUDGET_MONTHS.map((month, monthIndex) => {
    const income = monthIncome(items, month);
    const living = monthLivingExpenses(items, month);
    const nordnetNet = monthNordnetNet(items, month);
    const netExpense = living - nordnetWithdrawalCash(nordnetNet);
    const cashSavings = monthCashSavings(income, living, nordnetNet);
    const economicSavings = monthEconomicSavings(income, living);
    const hasActivity = income !== 0 || living !== 0 || nordnetNet !== 0;
    return {
      month,
      monthIndex,
      income,
      living,
      netExpense,
      nordnetNet,
      cashSavings,
      economicSavings,
      hasActivity,
    };
  });

  const totalIncome = months.reduce((s, m) => s + m.income, 0);
  const totalLiving = months.reduce((s, m) => s + m.living, 0);
  const totalNetExpense = months.reduce((s, m) => s + m.netExpense, 0);
  const totalCashSavings = months.reduce((s, m) => s + m.cashSavings, 0);
  const totalEconomicSavings = months.reduce((s, m) => s + m.economicSavings, 0);
  const totalNordnet = months.reduce((s, m) => s + m.nordnetNet, 0);
  const wealth = totalCashSavings + totalNordnet;
  const savingsRate = totalIncome > 0 ? (totalEconomicSavings / totalIncome) * 100 : 0;
  const cashSavingsRate = totalIncome > 0 ? (totalCashSavings / totalIncome) * 100 : 0;
  const totalWithdrawals = months.reduce(
    (s, m) => s + nordnetWithdrawalCash(m.nordnetNet),
    0
  );

  const averageMonths = months.filter(
    (m) =>
      m.hasActivity &&
      !isIncompleteCurrentMonth(m.monthIndex, options?.budgetYear, now)
  );
  const divisor = averageMonths.length || 1;
  const averageMonthlyIncome =
    averageMonths.reduce((s, m) => s + m.income, 0) / divisor;
  const averageMonthlyNetExpense =
    averageMonths.reduce((s, m) => s + m.netExpense, 0) / divisor;
  const averageMonthlyCashSavings =
    averageMonths.reduce((s, m) => s + m.cashSavings, 0) / divisor;

  return {
    months,
    totalIncome,
    totalLiving,
    totalNetExpense,
    totalCashSavings,
    totalEconomicSavings,
    totalNordnet,
    wealth,
    savingsRate,
    cashSavingsRate,
    totalWithdrawals,
    averageMonths,
    averageMonthlyIncome,
    averageMonthlyNetExpense,
    averageMonthlyCashSavings,
  };
}
