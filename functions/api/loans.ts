/// <reference types="@cloudflare/workers-types" />

// Cloudflare Pages Function for managing loans
// GET /api/loans - Get all loans for a user
// POST /api/loans - Create a new loan
// PUT /api/loans/[id] - Update a loan
// DELETE /api/loans/[id] - Delete a loan

interface Env {
  budget_db: D1Database;
}

interface Loan {
  id: string;
  userId: string;
  name: string;
  amount: number;
  startDate: string; // Format: "YYYY-MM-DD"
  createdAt?: string;
  updatedAt?: string;
}

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Id',
};

// Explicit OPTIONS handler for preflight requests
export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });
};

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request } = context;

  // Handle CORS preflight - must be first and cannot fail
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  const { env } = context;

  try {
    const userId = request.headers.get('X-User-Id');

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized: User ID required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (request.method === 'GET') {
      // Get all loans for the user
      // Handle case where loans table might not exist yet
      let result;
      try {
        result = await env.budget_db
          .prepare('SELECT id, user_id, name, amount, start_date, created_at, updated_at FROM loans WHERE user_id = ? ORDER BY created_at DESC')
          .bind(userId)
          .all();
      } catch (e: any) {
        // If table doesn't exist, return empty array
        const errorMsg = e?.message || String(e);
        if (errorMsg.includes('no such table: loans')) {
          return new Response(JSON.stringify([]), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        throw e;
      }

      const loans: Loan[] = result.results.map((row: any) => ({
        id: row.id as string,
        userId: row.user_id as string,
        name: row.name as string,
        amount: row.amount as number,
        startDate: row.start_date as string,
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
      }));

      return new Response(JSON.stringify(loans), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (request.method === 'POST') {
      // Create a new loan
      const body = await request.json() as { name: string; amount: number; startDate: string };

      if (!body.name || !body.amount || !body.startDate) {
        return new Response(JSON.stringify({ error: 'Name, amount, and startDate are required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const loanId = Date.now().toString();

      try {
        await env.budget_db
          .prepare('INSERT INTO loans (id, user_id, name, amount, start_date) VALUES (?, ?, ?, ?, ?)')
          .bind(loanId, userId, body.name.trim(), body.amount, body.startDate)
          .run();
      } catch (e: any) {
        const errorMsg = e?.message || String(e);
        if (errorMsg.includes('no such table: loans')) {
          return new Response(JSON.stringify({ error: 'Loans table does not exist. Please run the database migration.' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        throw e;
      }

      // Return the created loan
      const result = await env.budget_db
        .prepare('SELECT id, user_id, name, amount, start_date, created_at, updated_at FROM loans WHERE id = ?')
        .bind(loanId)
        .first();

      if (!result) {
        throw new Error('Failed to retrieve created loan');
      }

      const loan: Loan = {
        id: (result as any).id as string,
        userId: (result as any).user_id as string,
        name: (result as any).name as string,
        amount: (result as any).amount as number,
        startDate: (result as any).start_date as string,
        createdAt: (result as any).created_at as string,
        updatedAt: (result as any).updated_at as string,
      };

      return new Response(JSON.stringify(loan), {
        status: 201,
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
