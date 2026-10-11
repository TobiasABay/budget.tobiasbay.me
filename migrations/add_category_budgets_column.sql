-- Migration: Add category_budgets JSON column to budgets
-- Planned monthly amounts per expense category for a budget year
-- Note: SQLite doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN
ALTER TABLE budgets ADD COLUMN category_budgets TEXT;
