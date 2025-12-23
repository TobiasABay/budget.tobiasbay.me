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
  months: { [key: string]: number | { [key: string]: string } }; // Allow nested _formulas object
  formulas?: { [key: string]: string };
  isLoan?: boolean;
  loanTitle?: string;
  loanStartDate?: string;
  loanValue?: number;
  isStaticExpense?: boolean;
  staticExpenseDate?: string;
  staticExpensePrice?: number;
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
      // Always try to select loan_data and static_expense_data (columns exist)
      let result;
      try {
        result = await env.budget_db
          .prepare('SELECT item_id, name, type, frequency, months, loan_data, static_expense_data FROM budget_items WHERE user_id = ? AND year = ?')
          .bind(userId, year)
          .all();
      } catch (e: any) {
        // If columns don't exist, try with just loan_data
        const errorMsg = e?.message || String(e);
        if (errorMsg.includes('no such column: static_expense_data')) {
          try {
            result = await env.budget_db
              .prepare('SELECT item_id, name, type, frequency, months, loan_data FROM budget_items WHERE user_id = ? AND year = ?')
              .bind(userId, year)
              .all();
          } catch (e2: any) {
            // If loan_data also doesn't exist, fall back to basic query
            const errorMsg2 = e2?.message || String(e2);
            if (errorMsg2.includes('no such column: loan_data')) {
              console.log('loan_data column not found, using fallback query');
              result = await env.budget_db
                .prepare('SELECT item_id, name, type, frequency, months FROM budget_items WHERE user_id = ? AND year = ?')
                .bind(userId, year)
                .all();
            } else {
              throw e2;
            }
          }
        } else if (errorMsg.includes('no such column: loan_data')) {
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
        if (hasLoanDataColumn && row.loan_data !== null && row.loan_data !== undefined && row.loan_data !== '') {
          try {
            const loanData = JSON.parse(row.loan_data as string);
            if (loanData && loanData.isLoan) {
              item.isLoan = loanData.isLoan;
              item.loanTitle = loanData.loanTitle || null;
              item.loanStartDate = loanData.loanStartDate || null;
              item.loanValue = loanData.loanValue || null;
            }
          } catch (e) {
            // Ignore parse errors for loan_data
            console.error('Error parsing loan_data for item', item.id, ':', e);
          }
        }

        // Parse static expense data if it exists
        const hasStaticExpenseDataColumn = 'static_expense_data' in row;
        if (hasStaticExpenseDataColumn && row.static_expense_data !== null && row.static_expense_data !== undefined && row.static_expense_data !== '') {
          try {
            const staticExpenseData = JSON.parse(row.static_expense_data as string);
            // If we have static expense data (date or price), treat it as a static expense
            // This handles cases where isStaticExpense flag might be missing
            if (staticExpenseData && (staticExpenseData.isStaticExpense || staticExpenseData.staticExpenseDate || staticExpenseData.staticExpensePrice)) {
              item.isStaticExpense = true;
              item.staticExpenseDate = staticExpenseData.staticExpenseDate || null;
              item.staticExpensePrice = staticExpenseData.staticExpensePrice || null;
            }
          } catch (e) {
            // Ignore parse errors for static_expense_data
            console.error('Error parsing static_expense_data for item', item.id, ':', e);
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

        // Prepare static expense data as JSON if it's a static expense
        const staticExpenseData = item.isStaticExpense ? JSON.stringify({
          isStaticExpense: item.isStaticExpense,
          staticExpenseDate: item.staticExpenseDate || null,
          staticExpensePrice: item.staticExpensePrice || null,
        }) : null;

        // Ensure months is a valid object (handle cases where it might be undefined)
        const monthsData = item.months || {};
        const monthsJson = JSON.stringify(monthsData);

        // Always try to insert with loan_data and static_expense_data (columns exist)
        try {
          await env.budget_db
            .prepare('INSERT INTO budget_items (budget_id, user_id, year, item_id, name, type, frequency, months, loan_data, static_expense_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .bind(
              budgetId,
              userId,
              year,
              item.id,
              item.name,
              item.type,
              item.frequency,
              monthsJson,
              loanData,
              staticExpenseData
            )
            .run();
        } catch (e: any) {
          // If static_expense_data column doesn't exist, try with just loan_data
          const errorMsg = e?.message || String(e);
          if (errorMsg.includes('no such column: static_expense_data')) {
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
                  monthsJson,
                  loanData
                )
                .run();
            } catch (e2: any) {
              // If loan_data also doesn't exist, fall back to insert without it
              const errorMsg2 = e2?.message || String(e2);
              if (errorMsg2.includes('no such column: loan_data')) {
                console.warn(`Item "${item.name}" cannot be saved with loan/static expense data. Columns don't exist.`);
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
                    monthsJson
                  )
                  .run();
              } else {
                console.error('Error inserting item:', e2, 'Item:', item);
                throw e2;
              }
            }
          } else if (errorMsg.includes('no such column: loan_data')) {
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
                monthsJson
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

