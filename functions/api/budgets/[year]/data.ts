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

// Helper function to check if loan_data column exists
// Since we know the column exists (from migration), we'll always try to use it
// and fall back gracefully if needed
async function checkLoanDataColumnExists(env: Env): Promise<boolean> {
  try {
    // Try a simple query to see if the column exists
    const testResult = await env.budget_db
      .prepare("SELECT loan_data FROM budget_items LIMIT 1")
      .first();
    // If we get here without error, column exists
    return true;
  } catch (e: any) {
    const errorMsg = e?.message || String(e);
    if (errorMsg.includes('no such column: loan_data') || errorMsg.includes('loan_data')) {
      console.log('loan_data column does not exist');
      return false;
    }
    // Other errors - assume column exists (safer)
    console.log('Assuming loan_data column exists (error was:', errorMsg, ')');
    return true;
  }
}

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

    // Check if loan_data column exists
    // Since we know the column exists (user confirmed), we'll try to use it
    // and fall back gracefully if needed
    let hasLoanDataColumn = true; // Default to true since column exists
    try {
      const checkResult = await checkLoanDataColumnExists(env);
      hasLoanDataColumn = checkResult;
      console.log('loan_data column check result:', hasLoanDataColumn);
    } catch (e) {
      console.error('Error checking loan_data column, assuming it exists:', e);
      hasLoanDataColumn = true; // Assume it exists
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
      // Always try to select loan_data (column exists)
      let result;
      try {
        result = await env.budget_db
          .prepare('SELECT item_id, name, type, frequency, months, loan_data FROM budget_items WHERE user_id = ? AND year = ?')
          .bind(userId, year)
          .all();
      } catch (e: any) {
        // If column doesn't exist, fall back to query without it
        const errorMsg = e?.message || String(e);
        if (errorMsg.includes('no such column: loan_data')) {
          console.log('loan_data column not found, using fallback query');
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

        // Parse loan data if it exists (check for both null and undefined)
        // Check if loan_data column exists in the row (might be undefined if column wasn't selected)
        const hasLoanDataColumn = 'loan_data' in row;
        console.log('Loading item:', item.id, 'has loan_data column:', hasLoanDataColumn, 'loan_data value:', row.loan_data, 'type:', typeof row.loan_data);

        if (hasLoanDataColumn && row.loan_data !== null && row.loan_data !== undefined && row.loan_data !== '') {
          try {
            const loanData = JSON.parse(row.loan_data as string);
            console.log('Parsed loan_data for item', item.id, ':', loanData);
            if (loanData && loanData.isLoan) {
              item.isLoan = loanData.isLoan;
              item.loanTitle = loanData.loanTitle || null;
              item.loanStartDate = loanData.loanStartDate || null;
              item.loanValue = loanData.loanValue || null;
              console.log('Successfully loaded loan item:', {
                id: item.id,
                name: item.name,
                loanTitle: item.loanTitle,
                loanStartDate: item.loanStartDate,
                loanValue: item.loanValue
              });
            } else {
              console.log('loan_data exists but isLoan is false or missing for item', item.id);
            }
          } catch (e) {
            // Ignore parse errors for loan_data
            console.error('Error parsing loan_data for item', item.id, ':', e, 'Raw value:', row.loan_data);
          }
        } else {
          if (!hasLoanDataColumn) {
            console.log('Item', item.id, 'does not have loan_data column in result');
          } else {
            console.log('Item', item.id, 'has loan_data column but value is null/undefined/empty:', row.loan_data);
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

      // Debug: Log all items to see what we're receiving
      console.log('Received items to save:', JSON.stringify(body.items, null, 2));

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


        // Always try to insert with loan_data (column exists)
        try {
          const insertResult = await env.budget_db
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

          // Verify what was actually saved
          if (item.isLoan) {
            const verifyResult = await env.budget_db
              .prepare('SELECT loan_data FROM budget_items WHERE item_id = ? AND user_id = ? AND year = ?')
              .bind(item.id, userId, year)
              .first();
            console.log('Verified saved loan_data for item', item.id, ':', verifyResult);
          }
        } catch (e: any) {
          // If column doesn't exist, fall back to insert without it
          const errorMsg = e?.message || String(e);
          if (errorMsg.includes('no such column: loan_data')) {
            console.warn(`Loan item "${item.name}" cannot be saved with loan data. Column doesn't exist.`);
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
            console.error('Error inserting item:', e, 'Item:', item);
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

