/// <reference types="@cloudflare/workers-types" />

// POST /api/receipts/taggun — multipart form field `file` → Taggun verbose OCR (line items).
// Configure: `npx wrangler secret put TAGGUN_API_KEY` (production) or `.dev.vars` locally.

const TAGGUN_VERBOSE_URL = 'https://api.taggun.io/api/receipt/v1/verbose/file';

interface Env {
  budget_db: D1Database;
  TAGGUN_API_KEY?: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Id',
};

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { status: 200, headers: corsHeaders });
};

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const userId = request.headers.get('X-User-Id');
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized: User ID required' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const apiKey = env.TAGGUN_API_KEY?.trim();
  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error:
          'Receipt scanning is not configured. Set TAGGUN_API_KEY (e.g. wrangler secret put TAGGUN_API_KEY).',
      }),
      { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  let incoming: FormData;
  try {
    incoming = await request.formData();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid form data' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const file = incoming.get('file');
  if (!file || typeof file === 'string') {
    return new Response(JSON.stringify({ error: 'Missing file field' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const outbound = new FormData();
  outbound.append('file', file, (file as File).name || 'receipt.jpg');
  outbound.append('extractLineItems', 'true');
  outbound.append('incognito', 'true');
  outbound.append('extractTime', 'false');
  outbound.append('refresh', 'false');

  const taggunRes = await fetch(TAGGUN_VERBOSE_URL, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      apikey: apiKey,
    },
    body: outbound,
  });

  const text = await taggunRes.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = { error: 'Invalid JSON from Taggun', detail: text.slice(0, 500) };
  }

  if (!taggunRes.ok) {
    return new Response(JSON.stringify(body), {
      status: taggunRes.status >= 400 && taggunRes.status < 600 ? taggunRes.status : 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
};
