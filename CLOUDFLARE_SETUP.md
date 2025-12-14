# Cloudflare Setup Guide

This guide explains how to set up Cloudflare D1 database for the budget application.

## 1. Database Already Created

The D1 database has been created using Wrangler CLI:
- **Database Name**: `budget-db`
- **Database ID**: `f2aa434c-95b2-495b-bfa4-e10778b2d7a4`
- **Binding**: `budget_db`

## 2. Database Schema

The database schema has been applied to both local and remote databases. The schema includes:

- `budgets` table with columns:
  - `id` (INTEGER PRIMARY KEY)
  - `user_id` (TEXT NOT NULL)
  - `year` (TEXT NOT NULL)
  - `created_at` (DATETIME)
  - `updated_at` (DATETIME)
  - UNIQUE constraint on `(user_id, year)`

## 3. Bind D1 Database to Pages Project

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **Workers & Pages** > **Pages**
3. Select your project (`budget-tobiasbay-me`)
4. Go to **Settings** > **Functions**
5. Under **D1 Database Bindings**, click **Add binding**
6. Set:
   - **Variable name**: `budget_db`
   - **D1 database**: Select `budget-db`
7. Click **Save**

## 4. Local Development

**Important**: Both local and production frontends use the same Cloudflare Pages backend and remote database. This ensures data consistency across environments.

### Running Local Frontend

The local frontend connects directly to the production API (`https://budget.tobiasbay.me/api`):

```bash
# Run local frontend development server
npm run dev

# Or run both frontend and backend (backend uses remote database)
npm run dev:all
```

The local frontend will automatically connect to the production backend, so you'll see the same data as in production.

### Database Management

```bash
# Execute SQL queries on remote database (used by both local and production)
wrangler d1 execute budget-db --file=./schema.sql --config=wrangler.toml --remote

# View data in remote database
wrangler d1 execute budget-db --command="SELECT * FROM budgets" --config=wrangler.toml --remote
```

## 5. Deploy

1. Push your code to your repository
2. Cloudflare Pages will automatically deploy
3. The Functions will be available at `/api/budgets`
4. Make sure the D1 database binding is configured in the Pages project settings

## 6. API Endpoints

The application uses the following API endpoints:

- `GET /api/budgets` - Get all budgets for the authenticated user
- `POST /api/budgets` - Create a new budget (requires `year` in body)
- `DELETE /api/budgets/:year` - Delete a specific budget

All endpoints require the `X-User-Id` header with the Clerk user ID.

## 7. Architecture

### Unified Backend and Database

Both local and production frontends use:
- **Same Backend**: Cloudflare Pages Functions at `https://budget.tobiasbay.me/api`
- **Same Database**: Remote D1 database (`budget-db`)

This ensures:
- Data consistency across environments
- No need to sync between local and production databases
- Easier development workflow

### Configuration

- **Local Frontend**: Connects to `https://budget.tobiasbay.me/api` (production backend)
- **Production Frontend**: Uses relative path `/api` (same production backend)
- **Backend**: Cloudflare Pages Functions with D1 database binding
- **Database**: Remote D1 database (same for both environments)

## Notes

- Each user's budgets are stored in the `budgets` table with `user_id` and `year` columns
- The D1 database binding is configured in `wrangler.toml` for production environment
- Make sure to bind the D1 database in the Cloudflare Pages project settings
- CORS is configured in the backend to allow requests from any origin

