// Cloudflare Pages Function for deleting a specific budget
// DELETE /api/budgets/[year] - Delete a budget

interface Env {
  budget_db: D1Database;
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  const year = params.year as string;

  // Handle CORS
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get user ID from header
    const userId = request.headers.get('X-User-Id') || 'default-user';

    if (!year) {
      return new Response(JSON.stringify({ error: 'Year is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Delete the budget from D1 database
    const deleteResult = await env.budget_db
      .prepare('DELETE FROM budgets WHERE user_id = ? AND year = ?')
      .bind(userId, year)
      .run();

    if (deleteResult.meta.changes === 0) {
      return new Response(JSON.stringify({ error: 'Budget not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get all remaining budgets for the user
    const result = await env.budget_db
      .prepare('SELECT year FROM budgets WHERE user_id = ? ORDER BY year ASC')
      .bind(userId)
      .all();

    const budgets = result.results.map((row: any) => row.year as string);

    return new Response(JSON.stringify({ success: true, budgets }), {
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

