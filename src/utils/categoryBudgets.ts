import { EXPENSE_CATEGORIES, type ExpenseCategory } from './budgetCategories';
import {
  BUDGET_MONTHS,
  isInvestmentTransferItem,
  type BudgetMathItem,
  type BudgetMonth,
} from './budgetMath';

/**
 * Stored as a sentinel line item inside the existing PUT /budgets/:year/data payload
 * so it works with the production API (no new route required).
 */
export const CATEGORY_BUDGETS_META_ID = '__category_budgets_v1__';

/** Planned monthly amounts per expense category for one budget year. */
export type CategoryMonthlyBudgets = {
  [category: string]: Partial<Record<BudgetMonth, number>>;
};

type ItemLike = {
  id?: string;
  name?: string;
  type?: string;
  amount?: number;
  frequency?: string;
  months?: { [key: string]: unknown };
  category?: string | null;
};

export function isCategoryBudgetsMetaItem(item: ItemLike | null | undefined): boolean {
  if (!item) return false;
  const id = typeof item.id === 'string' ? item.id : '';
  const name = typeof item.name === 'string' ? item.name : '';
  return id === CATEGORY_BUDGETS_META_ID || name === CATEGORY_BUDGETS_META_ID;
}

export function extractCategoryBudgetsFromItems(items: ItemLike[] | null | undefined): {
  items: ItemLike[];
  categoryBudgets: CategoryMonthlyBudgets;
} {
  const list = Array.isArray(items) ? items : [];
  const meta = list.find(isCategoryBudgetsMetaItem);
  const rest = list.filter((item) => !isCategoryBudgetsMetaItem(item));
  const raw = meta?.months && typeof meta.months === 'object' ? (meta.months as any)._categoryBudgets : null;
  return {
    items: rest,
    categoryBudgets: normalizeCategoryBudgets(raw),
  };
}

/** Returns a copy of `items` with the meta row upserted (or omitted if empty). */
export function withCategoryBudgetsMetaItem(
  items: ItemLike[],
  budgets: CategoryMonthlyBudgets
): ItemLike[] {
  const cleaned = (items || []).filter((item) => !isCategoryBudgetsMetaItem(item));
  const normalized = normalizeCategoryBudgets(budgets);
  if (!hasAnyCategoryBudget(normalized)) return cleaned;
  return [
    ...cleaned,
    {
      id: CATEGORY_BUDGETS_META_ID,
      name: CATEGORY_BUDGETS_META_ID,
      type: 'expense',
      amount: 0,
      frequency: 'Meta',
      months: { _categoryBudgets: normalized },
      category: null,
    },
  ];
}

export type CategoryBudgetCompareRow = {
  category: string;
  budgeted: number;
  actual: number;
  diff: number;
};

function normalizeAmount(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
}

/** Parse API / JSON into a clean map (only known categories + months, non-negative numbers). */
export function normalizeCategoryBudgets(raw: unknown): CategoryMonthlyBudgets {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: CategoryMonthlyBudgets = {};
  for (const cat of EXPENSE_CATEGORIES) {
    const entry = (raw as Record<string, unknown>)[cat];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const months: Partial<Record<BudgetMonth, number>> = {};
    for (const month of BUDGET_MONTHS) {
      const amt = normalizeAmount((entry as Record<string, unknown>)[month]);
      if (amt > 0) months[month] = amt;
    }
    if (Object.keys(months).length > 0) out[cat] = months;
  }
  return out;
}

export function getCategoryMonthBudget(
  budgets: CategoryMonthlyBudgets,
  category: string,
  month: BudgetMonth
): number {
  return normalizeAmount(budgets[category]?.[month]);
}

export function getCategoryBudgetedTotal(
  budgets: CategoryMonthlyBudgets,
  category: string,
  monthScope?: string | 'all'
): number {
  if (!monthScope || monthScope === 'all') {
    return BUDGET_MONTHS.reduce((sum, m) => sum + getCategoryMonthBudget(budgets, category, m), 0);
  }
  if ((BUDGET_MONTHS as readonly string[]).includes(monthScope)) {
    return getCategoryMonthBudget(budgets, category, monthScope as BudgetMonth);
  }
  return 0;
}

export function setCategoryMonthBudget(
  budgets: CategoryMonthlyBudgets,
  category: ExpenseCategory,
  month: BudgetMonth,
  amount: number
): CategoryMonthlyBudgets {
  const next: CategoryMonthlyBudgets = { ...budgets };
  const months = { ...(next[category] || {}) };
  const amt = normalizeAmount(amount);
  if (amt > 0) {
    months[month] = amt;
  } else {
    delete months[month];
  }
  if (Object.keys(months).length === 0) {
    delete next[category];
  } else {
    next[category] = months;
  }
  return next;
}

export function fillCategoryAllMonths(
  budgets: CategoryMonthlyBudgets,
  category: ExpenseCategory,
  amount: number
): CategoryMonthlyBudgets {
  let next = budgets;
  for (const month of BUDGET_MONTHS) {
    next = setCategoryMonthBudget(next, category, month, amount);
  }
  return next;
}

/** Actual spend by expense category (excludes Nordnet transfers). Fun items use their own category labels. */
export function actualSpendByCategory(
  items: BudgetMathItem[],
  monthScope?: string | 'all'
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const item of items) {
    if (item.type !== 'expense' || isInvestmentTransferItem(item)) continue;
    const category = (item.category && String(item.category).trim()) || 'Other';
    let amount = 0;
    if (!monthScope || monthScope === 'all') {
      amount = BUDGET_MONTHS.reduce((sum, m) => sum + (item.months?.[m] || 0), 0);
    } else if ((BUDGET_MONTHS as readonly string[]).includes(monthScope)) {
      amount = item.months?.[monthScope] || 0;
    }
    if (amount === 0) continue;
    totals[category] = (totals[category] || 0) + amount;
  }
  return totals;
}

/**
 * Compare planned category budgets vs actual registered spend.
 * Includes every EXPENSE_CATEGORIES row plus any extra actual categories with spend.
 */
export function buildCategoryBudgetCompareRows(
  budgets: CategoryMonthlyBudgets,
  items: BudgetMathItem[],
  monthScope: string | 'all' = 'all'
): CategoryBudgetCompareRow[] {
  const actuals = actualSpendByCategory(items, monthScope);
  const categories = new Set<string>([
    ...EXPENSE_CATEGORIES,
    ...Object.keys(actuals),
    ...Object.keys(budgets),
  ]);

  const rows: CategoryBudgetCompareRow[] = [];
  for (const category of categories) {
    const budgeted = getCategoryBudgetedTotal(budgets, category, monthScope);
    const actual = normalizeAmount(actuals[category] || 0);
    if (budgeted === 0 && actual === 0) continue;
    rows.push({
      category,
      budgeted,
      actual,
      diff: actual - budgeted,
    });
  }

  rows.sort((a, b) => {
    const aKnown = (EXPENSE_CATEGORIES as readonly string[]).indexOf(a.category);
    const bKnown = (EXPENSE_CATEGORIES as readonly string[]).indexOf(b.category);
    if (aKnown !== -1 && bKnown !== -1) return aKnown - bKnown;
    if (aKnown !== -1) return -1;
    if (bKnown !== -1) return 1;
    return a.category.localeCompare(b.category, undefined, { sensitivity: 'base' });
  });

  return rows;
}

export function hasAnyCategoryBudget(budgets: CategoryMonthlyBudgets): boolean {
  return Object.keys(budgets).some((cat) =>
    BUDGET_MONTHS.some((m) => getCategoryMonthBudget(budgets, cat, m) > 0)
  );
}
