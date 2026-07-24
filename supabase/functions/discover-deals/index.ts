// Supabase edge function: discover this week's real grocery deals for a Montreal
// postal area by hitting Flipp (backflipp.wishabi.com) directly, then using
// Claude ONLY to match candidate items to catalog ingredients. All prices,
// units, labels, and dates are derived server-side (see mapDeals.ts) — never
// from the model.
//
// Deno runtime — this file uses `Deno.*` and `npm:` imports and is NOT meant to
// be imported by Jest. Every pure/testable piece lives in the sibling modules
// (catalog / flipp / weeks / mapDeals), imported with explicit `.ts` specifiers.
import Anthropic from 'npm:@anthropic-ai/sdk';
import { CATALOG, CATALOG_IDS } from './catalog.ts';
import type { Chain, FlippFlyer, FlippItem } from './flipp.ts';
import { chainFromMerchant } from './flipp.ts';
import { weekOf } from './weeks.ts';
import {
  compactCandidateLine,
  mapDeals,
  prefilterItems,
  type Candidate,
  type Match,
} from './mapDeals.ts';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** Browser-ish UA so Flipp's backend serves us like a normal web client. */
const FLIPP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const FLIPP_BASE = 'https://backflipp.wishabi.com/flipp';
const LOCALE = 'fr-ca';

/** Per-search fan-out concurrency + timeout. */
const SEARCH_CONCURRENCY = 8;
const SEARCH_TIMEOUT_MS = 10_000;

/** Chain → weekly-flyer landing page (copy of src/data/flyerUrls.ts; Deno can't
 * import from the app tree). Used as store.flyerUrl. */
const CHAIN_FLYER_URLS: Record<Chain, string> = {
  metro: 'https://www.metro.ca/en/flyer',
  iga: 'https://www.iga.net/en/flyer',
  provigo: 'https://www.provigo.ca/flyers',
  maxi: 'https://www.maxi.ca/flyers',
  superc: 'https://www.superc.ca/en/flyer',
  loblaws: 'https://www.loblaws.ca/flyers',
  walmart: 'https://www.walmart.ca/en/flyer',
};

const CHAIN_LABELS: Record<Chain, string> = {
  metro: 'Metro',
  iga: 'IGA',
  provigo: 'Provigo',
  maxi: 'Maxi',
  superc: 'Super C',
  loblaws: 'Loblaws',
  walmart: 'Walmart',
};

interface SynthStore {
  id: string;
  chain: Chain;
  name: string;
  distanceKm: number;
  dealCount: number;
  flyerUrl?: string;
}

// Structured-output schema: the model's ONLY output is matches. additionalProperties
// false + required on every object; enum-constrained ingredientId.
const MATCH_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['matches'],
  properties: {
    matches: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['ingredientId', 'candidateIndex'],
        properties: {
          ingredientId: { type: 'string', enum: CATALOG_IDS },
          candidateIndex: { type: 'number' },
        },
      },
    },
  },
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function fsaOf(postal: string): string {
  return postal.trim().toUpperCase().replace(/[ -]/g, '').slice(0, 3);
}

/** Non-staple catalog ingredients we fan out one Flipp search per. */
const SEARCH_TARGETS = CATALOG.filter((c) => c.category !== 'staple');

Deno.serve(async (req: Request): Promise<Response> => {
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

    const postalCode = payload?.postalCode;
    const forceRefresh = payload?.forceRefresh === true;
    if (typeof postalCode !== 'string' || postalCode.trim() === '') {
      return json(400, { error: 'error' });
    }

    const fsa = fsaOf(postalCode);
    // Pilot market is Montreal (H-prefixed FSAs). Anything else: loud failure.
    if (!/^H\d[A-Z]$/.test(fsa)) {
      return json(422, { error: 'no_flyers_found' });
    }

    const todayISO = new Date().toISOString().slice(0, 10);
    const week = weekOf(todayISO);

    // 1) Serve the shared cache unless a manual refresh was requested.
    if (!forceRefresh) {
      const cached = await readCache(fsa, week);
      if (cached) return json(200, cached);
    }

    // 2) Live pipeline: flyers → stores.
    let flyers: FlippFlyer[];
    try {
      flyers = await fetchFlyers(postalCode);
    } catch {
      return json(502, { error: 'error' });
    }

    const { stores, allowedFlyerIds, knownChains } = synthesizeStores(
      flyers,
      fsa,
      todayISO,
    );
    if (stores.length === 0) {
      return json(422, { error: 'no_flyers_found' });
    }
    const storeByChain = new Map<Chain, SynthStore>(
      stores.map((s) => [s.chain, s]),
    );

    // 3) Search fan-out: one query per non-staple ingredient.
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) return json(502, { error: 'error' });

    const { candidates, failedRatio } = await runSearches(
      postalCode,
      todayISO,
      allowedFlyerIds,
      knownChains,
      storeByChain,
    );
    // If more than half the searches failed, the data is too incomplete to trust.
    if (failedRatio > 0.5) return json(502, { error: 'error' });

    // 4) Claude matching (the model's only job).
    let matches: Match[] = [];
    if (candidates.length > 0) {
      try {
        matches = await matchWithClaude(apiKey, candidates);
      } catch {
        return json(502, { error: 'error' });
      }
    }

    const deals = mapDeals(candidates, matches, todayISO);

    // Zero deals across ALL stores → loud failure, never a silent-empty 200.
    if (deals.length === 0) {
      return json(422, { error: 'no_flyers_found' });
    }

    // 5) Stamp per-store deal counts.
    const countByStore = new Map<string, number>();
    for (const d of deals) {
      countByStore.set(d.storeId, (countByStore.get(d.storeId) ?? 0) + 1);
    }
    const finalStores = stores.map((s) => ({
      id: s.id,
      chain: s.chain,
      name: s.name,
      distanceKm: s.distanceKm,
      dealCount: countByStore.get(s.id) ?? 0,
      flyerUrl: s.flyerUrl,
    }));

    const result = {
      postalCode,
      stores: finalStores,
      deals,
      fetchedAt: new Date().toISOString(),
    };

    // 6) Best-effort cache write + label-mapping learning (never affect response).
    await writeCache(fsa, week, result);
    void recordLabelMappings(deals);

    return json(200, result);
  } catch {
    return json(502, { error: 'error' });
  }
});

/* ------------------------------- Flipp fetch ------------------------------ */

async function fetchFlyers(postalCode: string): Promise<FlippFlyer[]> {
  const url = `${FLIPP_BASE}/flyers?locale=${LOCALE}&postal_code=${encodeURIComponent(
    postalCode,
  )}`;
  const res = await fetch(url, { headers: { 'User-Agent': FLIPP_UA } });
  if (!res.ok) throw new Error(`flyers ${res.status}`);
  const body = (await res.json()) as { flyers?: FlippFlyer[] } | FlippFlyer[];
  if (Array.isArray(body)) return body;
  return Array.isArray(body?.flyers) ? body.flyers : [];
}

/**
 * Turn the flyers list into one synthetic store per target chain (first flyer
 * wins), collecting the set of allowed flyer ids used to gate item searches.
 */
function synthesizeStores(
  flyers: FlippFlyer[],
  fsa: string,
  todayISO: string,
): {
  stores: SynthStore[];
  allowedFlyerIds: Set<string>;
  knownChains: Set<Chain>;
} {
  const today = Date.parse(`${todayISO}T00:00:00Z`);
  const stores: SynthStore[] = [];
  const seenChains = new Set<Chain>();
  const allowedFlyerIds = new Set<string>();
  let order = 0;

  for (const flyer of flyers) {
    const chain = chainFromMerchant(flyer.merchant);
    if (!chain) continue;

    // Skip flyers that have already ended.
    const validTo = typeof flyer.valid_to === 'string' ? flyer.valid_to : null;
    if (validTo) {
      const to = Date.parse(`${validTo.slice(0, 10)}T00:00:00Z`);
      if (!Number.isNaN(to) && to < today) continue;
    }

    if (flyer.id != null) allowedFlyerIds.add(String(flyer.id));

    if (seenChains.has(chain)) continue;
    seenChains.add(chain);

    const fsaLower = fsa.toLowerCase();
    stores.push({
      id: `${chain}-${fsaLower}`,
      chain,
      name: `${CHAIN_LABELS[chain]} ${fsa}`,
      // Stable placeholder distances by order found (0.8, 1.2, 1.6, …).
      distanceKm: Math.round((0.8 + order * 0.4) * 10) / 10,
      dealCount: 0,
      flyerUrl: CHAIN_FLYER_URLS[chain],
    });
    order += 1;
  }

  return { stores, allowedFlyerIds, knownChains: seenChains };
}

/** Primary search term for an ingredient: its French name, used as-is. */
function searchQuery(nameFr: string): string {
  return nameFr;
}

/** Bounded-concurrency fan-out of item searches, tolerating individual failures. */
async function runSearches(
  postalCode: string,
  todayISO: string,
  allowedFlyerIds: Set<string>,
  knownChains: Set<Chain>,
  storeByChain: Map<Chain, SynthStore>,
): Promise<{ candidates: Candidate[]; failedRatio: number }> {
  const candidates: Candidate[] = [];
  let failed = 0;

  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < SEARCH_TARGETS.length) {
      const target = SEARCH_TARGETS[cursor];
      cursor += 1;
      const q = searchQuery(target.nameFr);
      let items: FlippItem[];
      try {
        items = await fetchItems(postalCode, q);
      } catch {
        failed += 1;
        continue;
      }
      const kept = prefilterItems(items, {
        allowedFlyerIds,
        knownChains,
        todayISO,
        query: q,
      });
      for (const item of kept) {
        const chain = chainFromMerchant(item.merchant_name);
        if (!chain) continue;
        const store = storeByChain.get(chain);
        if (!store) continue;
        candidates.push({ ...item, storeId: store.id, chain });
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(SEARCH_CONCURRENCY, SEARCH_TARGETS.length) },
    () => worker(),
  );
  await Promise.all(workers);

  return {
    candidates,
    failedRatio: SEARCH_TARGETS.length === 0 ? 0 : failed / SEARCH_TARGETS.length,
  };
}

async function fetchItems(
  postalCode: string,
  query: string,
): Promise<FlippItem[]> {
  const url = `${FLIPP_BASE}/items/search?locale=${LOCALE}&postal_code=${encodeURIComponent(
    postalCode,
  )}&q=${encodeURIComponent(query)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': FLIPP_UA },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`items ${res.status}`);
    const body = (await res.json()) as { items?: FlippItem[] } | FlippItem[];
    if (Array.isArray(body)) return body;
    return Array.isArray(body?.items) ? body.items : [];
  } finally {
    clearTimeout(timeout);
  }
}

/* ------------------------------ Claude match ------------------------------ */

function buildMatchPrompt(candidates: Candidate[]): string {
  const catalogLines = CATALOG.filter((c) => c.category !== 'staple')
    .map((c) => `${c.id} | ${c.name} | ${c.nameFr}`)
    .join('\n');
  const candidateLines = candidates
    .map((c, i) => compactCandidateLine(i, c))
    .join('\n');

  return `You match grocery flyer items to a fixed catalog of cooking ingredients. The flyer items are from Quebec circulaires (French, "fr | en" names).

Catalog ingredients (id | name | nameFr):
${catalogLines}

Candidate flyer items (index | name | current_price | original_price | post_price_text | merchant):
${candidateLines}

Return one match per candidate that is genuinely the SAME core ingredient as a catalog id. Rules:
- Match only the plain, primary form of an ingredient. REJECT derivatives and prepared/value-added products: e.g. chicken wings / drumsticks / marinated / breaded / cooked / deli chicken are NOT "chicken_breast"; prepared/dressed salads and salad kits are NOT a leaf-vegetable ingredient; seasoned or flavoured variants that change the ingredient are not matches.
- A given candidate index may match at most one ingredient. Omit candidates with no confident match.
- Use ONLY the candidate indices shown above.
- Do not invent prices or ids; you only choose {ingredientId, candidateIndex} pairs.`;
}

async function matchWithClaude(
  apiKey: string,
  candidates: Candidate[],
): Promise<Match[]> {
  const anthropic = new Anthropic({ apiKey });
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: {
      format: { type: 'json_schema', schema: MATCH_SCHEMA },
    },
    messages: [
      { role: 'user', content: [{ type: 'text', text: buildMatchPrompt(candidates) }] },
    ],
  } as unknown as Parameters<typeof anthropic.messages.create>[0]);

  if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') {
    throw new Error('untrustworthy model output');
  }
  const textBlock = response.content.find(
    (b: { type: string }) => b.type === 'text',
  ) as { type: 'text'; text: string } | undefined;
  if (!textBlock || typeof textBlock.text !== 'string') {
    throw new Error('no text block');
  }
  const parsed = JSON.parse(textBlock.text) as { matches?: unknown };
  return Array.isArray(parsed?.matches) ? (parsed.matches as Match[]) : [];
}

/* ------------------------------ cache (REST) ------------------------------ */

function serviceRest(): { url: string; key: string } | null {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return null;
  return { url, key };
}

async function readCache(
  fsa: string,
  week: string,
): Promise<Record<string, unknown> | null> {
  try {
    const svc = serviceRest();
    if (!svc) return null;
    const url =
      `${svc.url}/rest/v1/deal_cache?postal_area=eq.${fsa}` +
      `&week_of=eq.${week}&select=result&limit=1`;
    const res = await fetch(url, {
      headers: { apikey: svc.key, Authorization: `Bearer ${svc.key}` },
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ result?: Record<string, unknown> }>;
    const result = rows?.[0]?.result;
    return result && typeof result === 'object' ? result : null;
  } catch {
    return null;
  }
}

async function writeCache(
  fsa: string,
  week: string,
  result: Record<string, unknown>,
): Promise<void> {
  try {
    const svc = serviceRest();
    if (!svc) return;
    await fetch(`${svc.url}/rest/v1/deal_cache?on_conflict=postal_area,week_of`, {
      method: 'POST',
      headers: {
        apikey: svc.key,
        Authorization: `Bearer ${svc.key}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        postal_area: fsa,
        week_of: week,
        result,
        fetched_at: new Date().toISOString(),
      }),
    });
  } catch {
    // Never affect the primary response.
  }
}

/**
 * Best-effort upsert into public.label_mappings (learned French-label →
 * ingredient associations). Swallows every error.
 */
async function recordLabelMappings(
  deals: Array<{ labelFr?: string; ingredientId: string; storeId: string }>,
): Promise<void> {
  try {
    const svc = serviceRest();
    if (!svc) return;
    const rows = deals
      .filter((d) => typeof d.labelFr === 'string' && d.labelFr.length > 0)
      .map((d) => ({
        label_fr: d.labelFr,
        ingredient_id: d.ingredientId,
        chain: d.storeId.split('-')[0],
      }));
    if (rows.length === 0) return;
    await fetch(`${svc.url}/rest/v1/label_mappings`, {
      method: 'POST',
      headers: {
        apikey: svc.key,
        Authorization: `Bearer ${svc.key}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify(rows),
    });
  } catch {
    // Never affect the primary response.
  }
}
