-- Migration: Add loans table and linked_loan_id column
-- Run this migration to enable the new loan system

-- Create loans table
CREATE TABLE IF NOT EXISTS loans (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  amount REAL NOT NULL,
  start_date TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_loans_user_id ON loans(user_id);

-- Add linked_loan_id column to budget_items
-- Note: SQLite doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN
-- This needs to be run manually or handled in application code
-- ALTER TABLE budget_items ADD COLUMN linked_loan_id TEXT;
