import type {
  Deal,
  FlyerExtractionEvent,
  UploadedFlyerFile,
} from '@/domain/types';
import { RemoteFlyerExtractor } from '@/services/RemoteFlyerExtractor';
import { FlyerExtractionError } from '@/services/flyerExtractionError';

const URL_BASE = 'https://project.supabase.co';
const ANON = 'anon-key';
const FN_PATH = '/functions/v1/extract-flyer';

function pdf(mimeType = 'application/pdf'): UploadedFlyerFile {
  return { name: 'flyer.pdf', mimeType, size: 2048, uri: 'blob:fake-uri' };
}

const SAMPLE_DEAL: Deal = {
  id: 'ext-metro-h2x-chicken_thigh',
  storeId: 'metro-h2x',
  ingredientId: 'chicken_thigh',
  label: 'Chicken Thighs',
  labelFr: 'Cuisses de poulet',
  salePrice: 4.99,
  regularPrice: 8.99,
  unit: 'lb',
  validFrom: '2026-07-20',
  validTo: '2026-07-26',
  provenance: 'extracted',
};

interface PostOutcome {
  status?: number;
  body?: unknown;
  throwNetwork?: boolean;
}

/** Fake fetch: serves the blob read for the file uri, and a canned POST result. */
function makeFetch(post: PostOutcome) {
  const calls: string[] = [];
  const fetchImpl = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    if (url.includes(FN_PATH)) {
      if (post.throwNetwork) throw new Error('network down');
      const status = post.status ?? 200;
      return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => post.body ?? {},
      } as unknown as Response;
    }
    // File-uri read.
    return {
      blob: async () => new Blob(['%PDF-1.4 fake bytes']),
      arrayBuffer: async () => new TextEncoder().encode('fake').buffer,
    } as unknown as Response;
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

function makeExtractor(post: PostOutcome) {
  const { fetchImpl, calls } = makeFetch(post);
  const extractor = new RemoteFlyerExtractor({
    url: URL_BASE,
    anonKey: ANON,
    fetchImpl,
  });
  return { extractor, calls };
}

const INPUT = { file: pdf(), storeId: 'metro-h2x', chain: 'metro' as const };

describe('RemoteFlyerExtractor', () => {
  it('maps a successful response straight through to Deal[]', async () => {
    const { extractor } = makeExtractor({
      status: 200,
      body: { deals: [SAMPLE_DEAL] },
    });
    const deals = await extractor.extract(INPUT);
    expect(deals).toEqual([SAMPLE_DEAL]);
  });

  it('sends auth headers and posts to the edge function URL', async () => {
    const { fetchImpl, calls } = makeFetch({
      status: 200,
      body: { deals: [SAMPLE_DEAL] },
    });
    const spy = jest.fn(fetchImpl);
    const extractor = new RemoteFlyerExtractor({
      url: URL_BASE,
      anonKey: ANON,
      fetchImpl: spy as unknown as typeof fetch,
    });
    await extractor.extract(INPUT);

    const postCall = spy.mock.calls.find((c) => String(c[0]).includes(FN_PATH));
    expect(postCall).toBeDefined();
    const [postUrl, init] = postCall as [string, RequestInit];
    expect(postUrl).toBe(`${URL_BASE}${FN_PATH}`);
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Bearer ${ANON}`,
    );
    expect((init.headers as Record<string, string>).apikey).toBe(ANON);
    const sent = JSON.parse(String(init.body));
    expect(sent.mimeType).toBe('application/pdf');
    expect(sent.storeId).toBe('metro-h2x');
    expect(typeof sent.fileBase64).toBe('string');
    expect(sent.fileBase64.length).toBeGreaterThan(0);
    expect(calls.some((u) => u === 'blob:fake-uri')).toBe(true);
  });

  it('maps HTTP 422 {error:"no_deals_found"} to that reason', async () => {
    const { extractor } = makeExtractor({
      status: 422,
      body: { error: 'no_deals_found' },
    });
    await expect(extractor.extract(INPUT)).rejects.toMatchObject({
      reason: 'no_deals_found',
    });
  });

  it('maps HTTP 500 to a generic error', async () => {
    const { extractor } = makeExtractor({ status: 500, body: { error: 'error' } });
    const err = await extractor.extract(INPUT).catch((e) => e);
    expect(err).toBeInstanceOf(FlyerExtractionError);
    expect(err.reason).toBe('error');
  });

  it('maps a network rejection to a generic error', async () => {
    const { extractor } = makeExtractor({ throwNetwork: true });
    await expect(extractor.extract(INPUT)).rejects.toMatchObject({
      reason: 'error',
    });
  });

  it('rejects an unsupported mime type BEFORE any network call', async () => {
    const { extractor, calls } = makeExtractor({
      status: 200,
      body: { deals: [SAMPLE_DEAL] },
    });
    await expect(
      extractor.extract({ ...INPUT, file: pdf('text/csv') }),
    ).rejects.toMatchObject({ reason: 'unreadable_file' });
    expect(calls).toHaveLength(0);
  });

  it('rejects an oversized file (>20MB) with file_too_large BEFORE any network call', async () => {
    const { extractor, calls } = makeExtractor({
      status: 200,
      body: { deals: [SAMPLE_DEAL] },
    });
    const big = { ...pdf(), size: 20_000_001 };
    await expect(
      extractor.extract({ ...INPUT, file: big }),
    ).rejects.toMatchObject({ reason: 'file_too_large' });
    expect(calls).toHaveLength(0);
  });

  it('lets a 12MB file through client validation to the network call', async () => {
    const { extractor, calls } = makeExtractor({
      status: 200,
      body: { deals: [SAMPLE_DEAL] },
    });
    const big = { ...pdf(), size: 12_000_000 };
    const deals = await extractor.extract({ ...INPUT, file: big });
    expect(deals).toEqual([SAMPLE_DEAL]);
    // It reached the network (blob read + POST), i.e. no early size rejection.
    expect(calls.some((u) => u.includes(FN_PATH))).toBe(true);
  });

  it('maps HTTP 413 {error:"file_too_large"} to that reason', async () => {
    const { extractor } = makeExtractor({
      status: 413,
      body: { error: 'file_too_large' },
    });
    await expect(extractor.extract(INPUT)).rejects.toMatchObject({
      reason: 'file_too_large',
    });
  });

  it('never resolves an empty Deal[] (empty -> no_deals_found)', async () => {
    const { extractor } = makeExtractor({ status: 200, body: { deals: [] } });
    await expect(extractor.extract(INPUT)).rejects.toMatchObject({
      reason: 'no_deals_found',
    });
  });

  it('emits monotonic progress events from 0..1 ending at exactly 1', async () => {
    const events: FlyerExtractionEvent[] = [];
    const { extractor } = makeExtractor({
      status: 200,
      body: { deals: [SAMPLE_DEAL] },
    });
    await extractor.extract(INPUT, { onEvent: (e) => events.push(e) });

    expect(events.length).toBeGreaterThan(0);
    expect(events.every((e) => e.type === 'status')).toBe(true);
    expect(events.every((e) => e.progress >= 0 && e.progress <= 1)).toBe(true);
    for (let i = 1; i < events.length; i += 1) {
      expect(events[i].progress).toBeGreaterThanOrEqual(events[i - 1].progress);
    }
    expect(events[events.length - 1].progress).toBe(1);
  });
});
