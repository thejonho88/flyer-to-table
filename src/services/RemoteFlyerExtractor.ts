import type {
  Deal,
  FlyerExtractInput,
  FlyerExtractOptions,
  FlyerExtractionEvent,
  FlyerExtractionFailure,
  FlyerExtractor,
} from '@/domain/types';
import { FlyerExtractionError } from './flyerExtractionError';

const VALID_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
]);

const KNOWN_REASONS = new Set<FlyerExtractionFailure>([
  'unreadable_file',
  'file_too_large',
  'no_deals_found',
  'error',
]);

/**
 * Decoded-size ceiling; fail fast before encoding. base64 of 20 MB ≈ 27 MB,
 * which must stay under Anthropic's 32 MB request limit. Real Montreal
 * circulaires run 10–15 MB, so 10 MB was too low. The edge function mirrors
 * this as MAX_BASE64_CHARS = ceil(20 MB × 4/3); keep the two consistent (the
 * client cap may be slightly stricter than the server's).
 */
export const MAX_FILE_BYTES = 20_000_000;

/** Server-side Claude extraction can take a while; give it a generous ceiling. */
const REQUEST_TIMEOUT_MS = 180_000;

/** How often the progress ticker advances while awaiting the server. */
const TICK_INTERVAL_MS = 2000;

const EXTRACTING_MESSAGE = 'Extracting deals with AI (this can take a minute)…';

type FetchImpl = typeof fetch;

export interface RemoteFlyerExtractorOptions {
  /** Supabase project URL, e.g. https://xxxx.supabase.co (no trailing slash needed). */
  url: string;
  /** Public anon key (sent as both Authorization bearer and apikey). */
  anonKey: string;
  /** Injectable fetch for tests; defaults to the global. */
  fetchImpl?: FetchImpl;
}

/**
 * Live flyer extractor: reads the picked file, base64-encodes it, and POSTs it
 * to the extract-flyer edge function which runs Claude + server-side validation.
 *
 * Fails LOUDLY (FlyerExtractionError) and, like the mock, never resolves an
 * empty Deal[]. Unsupported file types are rejected BEFORE any network call.
 * Emits monotonic progress events (reading -> analyzing ramp -> done at 1.0).
 */
export class RemoteFlyerExtractor implements FlyerExtractor {
  private readonly url: string;
  private readonly anonKey: string;
  private readonly fetchImpl: FetchImpl;

  constructor(opts: RemoteFlyerExtractorOptions) {
    this.url = opts.url.replace(/\/+$/, '');
    this.anonKey = opts.anonKey;
    // Bind the global fetch: calling it via `this.fetchImpl(...)` unbound
    // throws "Illegal invocation" in browsers (fetch requires its Window this).
    this.fetchImpl = opts.fetchImpl ?? fetch.bind(globalThis);
  }

  async extract(
    input: FlyerExtractInput,
    opts: FlyerExtractOptions = {},
  ): Promise<Deal[]> {
    const { file, storeId, chain } = input;
    const emit = (e: FlyerExtractionEvent) => opts.onEvent?.(e);

    // Loud, immediate failure for a file we can't parse — before any network.
    if (!VALID_MIME_TYPES.has(file.mimeType)) {
      throw new FlyerExtractionError('unreadable_file', file.name);
    }
    // Oversized files would hang base64 encoding and be rejected server-side
    // anyway (413) — reject up front with the specific reason instead.
    if (file.size > MAX_FILE_BYTES) {
      throw new FlyerExtractionError('file_too_large', file.name);
    }

    emit({ type: 'status', message: 'Reading flyer…', progress: 0.1 });

    let fileBase64: string;
    try {
      fileBase64 = await this.readAsBase64(file.uri);
    } catch {
      throw new FlyerExtractionError('error', file.name);
    }

    // Slow ramp 0.2 -> 0.9 while we await the server, so the UI keeps moving.
    let progress = 0.2;
    emit({ type: 'status', message: EXTRACTING_MESSAGE, progress });
    const ticker = setInterval(() => {
      progress = Math.min(0.9, progress + 0.05);
      emit({ type: 'status', message: EXTRACTING_MESSAGE, progress });
    }, TICK_INTERVAL_MS);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let res: Response;
    try {
      try {
        res = await this.fetchImpl(
          `${this.url}/functions/v1/extract-flyer`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${this.anonKey}`,
              apikey: this.anonKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              fileBase64,
              mimeType: file.mimeType,
              fileName: file.name,
              chain,
              storeId,
            }),
            signal: controller.signal,
          },
        );
      } finally {
        // Always clear the ticker + timeout, success or failure.
        clearInterval(ticker);
        clearTimeout(timeout);
      }
    } catch {
      // Network failure, timeout/abort — surface as a loud, generic error.
      throw new FlyerExtractionError('error', file.name);
    }

    if (!res.ok) {
      throw new FlyerExtractionError(
        await this.readErrorReason(res),
        file.name,
      );
    }

    let body: { deals?: unknown };
    try {
      body = await res.json();
    } catch {
      throw new FlyerExtractionError('error', file.name);
    }

    const deals = Array.isArray(body?.deals) ? (body.deals as Deal[]) : [];
    // Never a silent empty success.
    if (deals.length === 0) {
      throw new FlyerExtractionError('no_deals_found', file.name);
    }

    emit({ type: 'status', message: 'Done', progress: 1 });
    return deals;
  }

  /** Map a non-2xx response to a known failure reason (defaults to 'error'). */
  private async readErrorReason(
    res: Response,
  ): Promise<FlyerExtractionFailure> {
    try {
      const body = (await res.json()) as { error?: unknown };
      const reason = body?.error;
      if (
        typeof reason === 'string' &&
        KNOWN_REASONS.has(reason as FlyerExtractionFailure)
      ) {
        return reason as FlyerExtractionFailure;
      }
    } catch {
      // fall through
    }
    return 'error';
  }

  /**
   * Read a (blob:) file URI into a base64 string. Prefers the browser FileReader
   * path; falls back to arrayBuffer + manual base64 where FileReader is absent.
   */
  private async readAsBase64(uri: string): Promise<string> {
    const res = await this.fetchImpl(uri);
    const blob = await res.blob();

    if (typeof FileReader !== 'undefined') {
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () =>
          reject(reader.error ?? new Error('FileReader failed'));
        reader.onload = () => {
          const result = String(reader.result ?? '');
          // Strip the "data:...;base64," prefix.
          const comma = result.indexOf(',');
          resolve(comma >= 0 ? result.slice(comma + 1) : result);
        };
        reader.readAsDataURL(blob);
      });
    }

    const buffer = await blob.arrayBuffer();
    return arrayBufferToBase64(buffer);
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  const g = globalThis as {
    btoa?: (s: string) => string;
    Buffer?: { from(s: string, enc: string): { toString(enc: string): string } };
  };
  if (typeof g.btoa === 'function') return g.btoa(binary);
  // Node fallback (tests / SSR).
  if (g.Buffer) return g.Buffer.from(binary, 'binary').toString('base64');
  throw new Error('No base64 encoder available in this environment');
}
