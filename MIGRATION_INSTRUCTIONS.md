# Database Migration Instructions

## Add Loan Data Column

To enable loan functionality, you need to add the `loan_data` column to your `budget_items` table.

### For Cloudflare D1 (Production)

1. Go to Cloudflare Dashboard → D1 Database
2. Select your database (budget-db)
3. Go to the "Execute SQL" tab
4. Run the following SQL:

```sql
ALTER TABLE budget_items ADD COLUMN loan_data TEXT;
```

### For Local Development (Wrangler)

Run this command:

```bash
wrangler d1 execute budget-db --local --command "ALTER TABLE budget_items ADD COLUMN loan_data TEXT;"
```

### For Remote/Production Database

```bash
wrangler d1 execute budget-db --remote --command "ALTER TABLE budget_items ADD COLUMN loan_data TEXT;"
```

### Verify Migration

After running the migration, you can verify it worked by running:

```sql
PRAGMA table_info(budget_items);
```

You should see `loan_data` in the list of columns.

## Important Notes

- **Backup your database** before running migrations in production
- The migration is safe to run multiple times (it will fail gracefully if the column already exists)
- After the migration, existing loans will need to be recreated (they were saved as regular expenses before the migration)
