/** Regular expense categories used for category budget targets. */
export const EXPENSE_CATEGORIES = [
  'Housing',
  'Insurance',
  'Food',
  'Transportation',
  'Utilities',
  'Healthcare',
  'Fitness',
  'Entertainment',
  'Shopping',
  'Education',
  'Other',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
