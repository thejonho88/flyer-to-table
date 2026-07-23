// Supabase edge function: extract grocery deals from an uploaded flyer using
// Claude, then validate/normalize the result server-side.
//
// Deno runtime — this file uses `Deno.*` and `npm:` imports and is NOT meant to
// be imported by Jest (it is excluded from the app tsconfig too). All the pure
// logic that IS unit-tested lives in ./validate.ts and ./catalog.ts.
import Anthropic from 'npm:@anthropic-ai/sdk';
import { CATALOG, CATALOG_IDS } from './catalog.ts';
import { validateDeals } from './validate.ts';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ALLOWED_MIME = new Set(['application/pdf', 'image/png', 'image/jpeg']);

// ~10 MB decoded ≈ 14M base64 chars. Reject larger up front (413).
const MAX_BASE64_CHARS = 14_000_000;

/** JSON response with CORS headers on EVERY response, including errors. */
function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

// Structured-output schema. Structured outputs require additionalProperties:false
// and a `required` array on every object; no minLength/minimum constraints.
const DEALS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['deals'],
  properties: {
    deals: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'ingredientId',
          'label',
          'labelFr',
          'salePrice',
          'regularPrice',
          'unit',
          'validFrom',
          'validTo',
        ],
        properties: {
          ingredientId: { type: 'string', enum: CATALOG_IDS },
          label: { type: 'string' },
          labelFr: { type: 'string' },
          salePrice: { type: 'number' },
          regularPrice: { type: ['number', 'null'] },
          unit: { type: 'string' },
          validFrom: { type: ['string', 'null'] },
          validTo: { type: ['string', 'null'] },
        },
      },
    },
  },
};

function buildPrompt(chain: string): string {
  const catalogLines = CATALOG.map(
    (c) => `${c.id} | ${c.name} | ${c.nameFr} | ${c.defaultUnit}`,
  ).join('\n');

  return `You are extracting grocery deals from a weekly flyer ("circulaire") from the Quebec grocery chain "${chain}". The flyer content is likely written in French.

Catalog of known ingredients (id | name | nameFr | defaultUnit):
${catalogLines}

Instructions:
- Extract ONLY deals you can confidently map to one of the catalog ids above. Skip everything else — non-food items, household goods, and any product with no clear catalog match.
- Quebec pricing conventions: meat is usually priced per lb — report it with unit "lb". Fish and seafood are often priced per 100 g — when a price is shown per 100 g, report unit "100g" and the price EXACTLY as printed (e.g. "2,99 $/100 g" -> salePrice 2.99, unit "100g"). Do NOT convert the price yourself. For any other item, report the price and the exact unit it is expressed in on the flyer.
- Use the flyer's validity dates if visible, formatted as YYYY-MM-DD. If a date is not shown, use null.
- regularPrice is the pre-sale ("regular") price if the flyer shows one, otherwise null. Do not guess it.
- labelFr must be the original French product text from the flyer. label must be a concise English description of the same product.
- Return one entry for every deal you can confidently map. Return an empty list if you cannot confidently map any.`;
}

Deno.serve(async (req: Request): Promise<Response> => {
  // CORS preflight.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return json(405, { error: 'error' });
  }

  try {
    let payload: Record<string, unknown>;
    try {
      payload = (await req.json()) as Record<string, unknown>;
    } catch {
      return json(400, { error: 'error' });
    }

    const fileBase64 = payload?.fileBase64;
    const mimeType = payload?.mimeType;
    const fileName = payload?.fileName;
    const chain = payload?.chain;
    const storeId = payload?.storeId;

    // Missing/typed-wrong required fields -> 400.
    if (
      typeof fileBase64 !== 'string' ||
      typeof mimeType !== 'string' ||
      typeof chain !== 'string' ||
      typeof storeId !== 'string' ||
      fileBase64.length === 0
    ) {
      return json(400, { error: 'error' });
    }

    // Unreadable file type -> 415.
    if (!ALLOWED_MIME.has(mimeType)) {
      return json(415, { error: 'unreadable_file' });
    }
    // Too large -> 413.
    if (fileBase64.length > MAX_BASE64_CHARS) {
      return json(413, { error: 'unreadable_file' });
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) return json(502, { error: 'error' });

    const anthropic = new Anthropic({ apiKey });

    const mediaBlock =
      mimeType === 'application/pdf'
        ? {
            type: 'document' as const,
            source: {
              type: 'base64' as const,
              media_type: 'application/pdf' as const,
              data: fileBase64,
            },
          }
        : {
            type: 'image' as const,
            source: {
              type: 'base64' as const,
              media_type: mimeType as 'image/png' | 'image/jpeg',
              data: fileBase64,
            },
          };

    let response;
    try {
      response = await anthropic.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 16000,
        thinking: { type: 'adaptive' },
        output_config: {
          format: { type: 'json_schema', schema: DEALS_SCHEMA },
        },
        messages: [
          {
            role: 'user',
            content: [
              mediaBlock,
              { type: 'text', text: buildPrompt(chain) },
            ],
          },
        ],
      } as unknown as Parameters<typeof anthropic.messages.create>[0]);
    } catch {
      // Anthropic API / network error.
      return json(502, { error: 'error' });
    }

    // Refusals and truncation cannot be trusted as structured output.
    if (
      response.stop_reason === 'refusal' ||
      response.stop_reason === 'max_tokens'
    ) {
      return json(502, { error: 'error' });
    }

    const textBlock = response.content.find(
      (b: { type: string }) => b.type === 'text',
    ) as { type: 'text'; text: string } | undefined;
    if (!textBlock || typeof textBlock.text !== 'string') {
      return json(502, { error: 'error' });
    }

    let parsed: { deals?: unknown };
    try {
      parsed = JSON.parse(textBlock.text);
    } catch {
      return json(502, { error: 'error' });
    }

    const todayISO = new Date().toISOString().slice(0, 10);
    const result = validateDeals(parsed?.deals, {
      storeId,
      chain,
      todayISO,
    });

    if (!result.ok) {
      return json(422, { error: result.reason });
    }

    // Fire-and-forget: record French label -> ingredient mappings for future
    // heuristics. Must never affect the response (errors swallowed).
    void recordLabelMappings(result.deals, chain);

    return json(200, { deals: result.deals });
  } catch {
    // Belt-and-suspenders: no unhandled rejection ever escapes.
    return json(502, { error: 'error' });
  }
});

/**
 * Best-effort upsert into public.label_mappings using the service role (both
 * env vars are auto-injected into edge functions). Swallows every error.
 */
async function recordLabelMappings(
  deals: Array<{ labelFr?: string; ingredientId: string }>,
  chain: string,
): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) return;

    const rows = deals
      .filter((d) => typeof d.labelFr === 'string' && d.labelFr.length > 0)
      .map((d) => ({
        label_fr: d.labelFr,
        ingredient_id: d.ingredientId,
        chain,
      }));
    if (rows.length === 0) return;

    await fetch(`${supabaseUrl}/rest/v1/label_mappings`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify(rows),
    });
  } catch {
    // Never affect the primary response.
  }
}
