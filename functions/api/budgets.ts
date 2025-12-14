/// <reference types="@cloudflare/workers-types" />

// Cloudflare Pages Function for managing budgets
// GET /api/budgets - Get all budgets for a user
// POST /api/budgets - Create a new budget

interface Env {
  budget_db: D1Database;
}

interface BudgetRequest {
  year: string;
  userId: string;
}

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
  const { request, env } = context;

  // Handle CORS preflight (fallback if onRequestOptions doesn't work)
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    });
  }

  try {
    // Get user ID from header
    // In production, you should verify the Clerk session token from the Authorization header
    // For now, we're using X-User-Id header which is set by the frontend
    const userId = request.headers.get('X-User-Id');

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized: User ID required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (request.method === 'GET') {
      // Get all budgets for the user from D1 database
      const result = await env.budget_db
        .prepare('SELECT year FROM budgets WHERE user_id = ? ORDER BY year ASC')
        .bind(userId)
        .all();

      const budgets = result.results.map((row: any) => row.year as string);

      return new Response(JSON.stringify(budgets), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (request.method === 'POST') {
      // Create a new budget in D1 database
      const body = (await request.json()) as BudgetRequest;
      const { year } = body;

      if (!year) {
        return new Response(JSON.stringify({ error: 'Year is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      try {
        // Insert the budget (UNIQUE constraint will prevent duplicates)
        await env.budget_db
          .prepare('INSERT INTO budgets (user_id, year) VALUES (?, ?)')
          .bind(userId, year)
          .run();

        // Get all budgets for the user
        const result = await env.budget_db
          .prepare('SELECT year FROM budgets WHERE user_id = ? ORDER BY year ASC')
          .bind(userId)
          .all();

        const budgets = result.results.map((row: any) => row.year as string);

        return new Response(JSON.stringify({ success: true, budgets }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (error: any) {
        // Check if it's a unique constraint violation
        if (error.message?.includes('UNIQUE constraint failed')) {
          return new Response(JSON.stringify({ error: 'Budget already exists' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        throw error;
      }
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

