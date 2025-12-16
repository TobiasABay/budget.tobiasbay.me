-- Budget database schema
-- This file contains the SQL schema for the D1 database

-- Create budgets table
CREATE TABLE IF NOT EXISTS budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  year TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, year)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_budgets_year ON budgets(year);

-- Create budget_items table to store line items for each budget
CREATE TABLE IF NOT EXISTS budget_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  budget_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  year TEXT NOT NULL,
  item_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  frequency TEXT NOT NULL,
  months TEXT NOT NULL,
  loan_data TEXT,
  static_expense_data TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (budget_id) REFERENCES budgets(id) ON DELETE CASCADE,
  UNIQUE(user_id, year, item_id)
);

-- Add loan_data column if it doesn't exist (for existing databases)
-- This is a no-op if the column already exists
-- Note: SQLite doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN
-- So this needs to be run manually or handled in application code

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_budget_items_user_year ON budget_items(user_id, year);
CREATE INDEX IF NOT EXISTS idx_budget_items_budget_id ON budget_items(budget_id);


