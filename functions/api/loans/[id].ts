/// <reference types="@cloudflare/workers-types" />

// Cloudflare Pages Function for managing individual loans
// PUT /api/loans/[id] - Update a loan
// DELETE /api/loans/[id] - Delete a loan

interface Env {
  budget_db: D1Database;
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
  const { request, params } = context;

  // Handle CORS preflight - must be first and cannot fail
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  const { env } = context;
  const loanId = decodeURIComponent(params.id as string);

  try {
    const userId = request.headers.get('X-User-Id');

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized: User ID required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!loanId) {
      return new Response(JSON.stringify({ error: 'Loan ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify the loan belongs to the user
    const existingLoan = await env.budget_db
      .prepare('SELECT id FROM loans WHERE id = ? AND user_id = ?')
      .bind(loanId, userId)
      .first();

    if (!existingLoan) {
      return new Response(JSON.stringify({ error: 'Loan not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (request.method === 'PUT') {
      // Update the loan
      const body = await request.json() as { name?: string; amount?: number; startDate?: string };

      const updates: string[] = [];
      const values: any[] = [];

      if (body.name !== undefined) {
        updates.push('name = ?');
        values.push(body.name.trim());
      }
      if (body.amount !== undefined) {
        updates.push('amount = ?');
        values.push(body.amount);
      }
      if (body.startDate !== undefined) {
        updates.push('start_date = ?');
        values.push(body.startDate);
      }

      if (updates.length === 0) {
        return new Response(JSON.stringify({ error: 'No fields to update' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(loanId, userId);

      await env.budget_db
        .prepare(`UPDATE loans SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`)
        .bind(...values)
        .run();

      // Return the updated loan
      const result = await env.budget_db
        .prepare('SELECT id, user_id, name, amount, start_date, created_at, updated_at FROM loans WHERE id = ?')
        .bind(loanId)
        .first();

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (request.method === 'DELETE') {
      // Delete the loan
      await env.budget_db
        .prepare('DELETE FROM loans WHERE id = ? AND user_id = ?')
        .bind(loanId, userId)
        .run();

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

