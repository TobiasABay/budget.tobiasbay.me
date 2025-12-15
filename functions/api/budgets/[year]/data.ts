/// <reference types="@cloudflare/workers-types" />

// Cloudflare Pages Function for managing budget data
// GET /api/budgets/[year]/data - Get budget line items for a year
// PUT /api/budgets/[year]/data - Save budget line items for a year

interface Env {
  budget_db: D1Database;
}

interface BudgetItem {
  id: string;
  name: string;
  type: 'income' | 'expense';
  amount: number;
  frequency: string;
  months: { [key: string]: number };
  isLoan?: boolean;
  loanTitle?: string;
  loanStartDate?: string;
  loanValue?: number;
}

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Id',
};

// Explicit OPTIONS handler for preflight requests
export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, {
    status: 200,
    headers: corsHeaders
  });
};

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  const year = decodeURIComponent(params.year as string);

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    });
  }

  if (request.method !== 'GET' && request.method !== 'PUT') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const userId = request.headers.get('X-User-Id');

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized: User ID required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!year) {
      return new Response(JSON.stringify({ error: 'Year is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get or create budget record
    let budgetResult = await env.budget_db
      .prepare('SELECT id FROM budgets WHERE user_id = ? AND year = ?')
      .bind(userId, year)
      .first();

    let budgetId: number;
    if (!budgetResult) {
      const insertResult = await env.budget_db
        .prepare('INSERT INTO budgets (user_id, year) VALUES (?, ?)')
        .bind(userId, year)
        .run();
      budgetId = insertResult.meta.last_row_id;
    } else {
      budgetId = (budgetResult as any).id;
    }

    if (request.method === 'GET') {
      // Try to select with loan_data, fallback if column doesn't exist
      let result;
      try {
        result = await env.budget_db
          .prepare('SELECT item_id, name, type, frequency, months, loan_data FROM budget_items WHERE user_id = ? AND year = ?')
          .bind(userId, year)
          .all();
      } catch (e: any) {
        // If loan_data column doesn't exist, select without it
        if (e?.message?.includes('no such column: loan_data') || e?.message?.includes('loan_data')) {
          result = await env.budget_db
            .prepare('SELECT item_id, name, type, frequency, months FROM budget_items WHERE user_id = ? AND year = ?')
            .bind(userId, year)
            .all();
        } else {
          throw e;
        }
      }

      const items: BudgetItem[] = result.results.map((row: any) => {
        const item: BudgetItem = {
          id: row.item_id as string,
          name: row.name as string,
          type: row.type as 'income' | 'expense',
          amount: 0,
          frequency: row.frequency as string,
          months: JSON.parse(row.months as string || '{}'),
        };

        // Parse loan data if it exists
        if (row.loan_data) {
          try {
            const loanData = JSON.parse(row.loan_data as string);
            if (loanData.isLoan) {
              item.isLoan = loanData.isLoan;
              item.loanTitle = loanData.loanTitle;
              item.loanStartDate = loanData.loanStartDate;
              item.loanValue = loanData.loanValue;
            }
          } catch (e) {
            // Ignore parse errors for loan_data
          }
        }

        return item;
      });

      return new Response(JSON.stringify(items), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (request.method === 'PUT') {
      const body = await request.json() as { items: BudgetItem[] };

      if (!body.items || !Array.isArray(body.items)) {
        return new Response(JSON.stringify({ error: 'Invalid request: items array required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Delete existing items
      await env.budget_db
        .prepare('DELETE FROM budget_items WHERE user_id = ? AND year = ?')
        .bind(userId, year)
        .run();

      // Insert new items
      for (const item of body.items) {
        // Prepare loan data as JSON if it's a loan
        const loanData = item.isLoan ? JSON.stringify({
          isLoan: item.isLoan,
          loanTitle: item.loanTitle || null,
          loanStartDate: item.loanStartDate || null,
          loanValue: item.loanValue || null,
        }) : null;

        // Try to insert with loan_data, fallback if column doesn't exist
        try {
          await env.budget_db
            .prepare('INSERT INTO budget_items (budget_id, user_id, year, item_id, name, type, frequency, months, loan_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .bind(
              budgetId,
              userId,
              year,
              item.id,
              item.name,
              item.type,
              item.frequency,
              JSON.stringify(item.months),
              loanData
            )
            .run();
        } catch (e: any) {
          // If loan_data column doesn't exist, insert without it
          // Note: Loan data will be lost until migration is run
          if (e?.message?.includes('no such column: loan_data') || e?.message?.includes('loan_data')) {
            await env.budget_db
              .prepare('INSERT INTO budget_items (budget_id, user_id, year, item_id, name, type, frequency, months) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
              .bind(
                budgetId,
                userId,
                year,
                item.id,
                item.name,
                item.type,
                item.frequency,
                JSON.stringify(item.months)
              )
              .run();
          } else {
            throw e;
          }
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

