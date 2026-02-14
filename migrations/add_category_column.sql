-- Migration: Add category column to budget_items
-- Run this migration to enable expense categorization

-- Add category column to budget_items
-- Note: SQLite doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN
-- This needs to be run manually or handled in application code
ALTER TABLE budget_items ADD COLUMN category TEXT;


