import { describe, expect, it } from 'vitest';
import {
  buildCategoryBudgetCompareRows,
  extractCategoryBudgetsFromItems,
  fillCategoryAllMonths,
  normalizeCategoryBudgets,
  setCategoryMonthBudget,
  withCategoryBudgetsMetaItem,
} from './categoryBudgets';

describe('categoryBudgets', () => {
  it('normalizes unknown keys and negative amounts away', () => {
    const normalized = normalizeCategoryBudgets({
      Food: { January: 4000, February: -10, NotAMonth: 99 },
      FakeCat: { January: 100 },
      Housing: { March: '2500' as unknown as number },
    });
    expect(normalized).toEqual({
      Food: { January: 4000 },
      Housing: { March: 2500 },
    });
  });

  it('fills all months and builds compare rows', () => {
    let budgets = fillCategoryAllMonths({}, 'Food', 3000);
    budgets = setCategoryMonthBudget(budgets, 'Housing', 'January', 10000);

    const rows = buildCategoryBudgetCompareRows(
      budgets,
      [
        {
          name: 'Groceries',
          type: 'expense',
          months: { January: 3200, February: 2800 },
          category: 'Food',
        },
        {
          name: 'Rent',
          type: 'expense',
          months: { January: 9500 },
          category: 'Housing',
        },
      ],
      'January'
    );

    const food = rows.find((r) => r.category === 'Food');
    const housing = rows.find((r) => r.category === 'Housing');
    expect(food).toMatchObject({ budgeted: 3000, actual: 3200, diff: 200 });
    expect(housing).toMatchObject({ budgeted: 10000, actual: 9500, diff: -500 });
  });

  it('round-trips via meta line item without polluting real items', () => {
    const packed = withCategoryBudgetsMetaItem(
      [{ id: '1', name: 'Rent', type: 'expense', months: { January: 1 } }],
      { Food: { January: 4000 } }
    );
    const { items, categoryBudgets } = extractCategoryBudgetsFromItems(packed);
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('Rent');
    expect(categoryBudgets).toEqual({ Food: { January: 4000 } });
  });
});
