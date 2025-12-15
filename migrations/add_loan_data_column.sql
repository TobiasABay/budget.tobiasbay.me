-- Migration: Add loan_data column to budget_items table
-- Run this migration to enable loan functionality

ALTER TABLE budget_items ADD COLUMN loan_data TEXT;
