/**
 * Flyer-week helper for the discover-deals edge function.
 *
 * Dependency-free pure module (no Deno/Node globals) so it runs identically in
 * the Deno edge runtime and under Jest.
 *
 * Grocery circulaires in Quebec run Thursday–Wednesday, so the cache is keyed by
 * the Thursday that STARTS the current flyer week. This is deliberately
 * different from extract-flyer's `weekBounds` (Monday–Sunday ISO week) — do not
 * conflate the two.
 */

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function fmtISO(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * The Thursday (YYYY-MM-DD, UTC) that starts the Thu–Wed flyer week containing
 * `todayISO`. Falls back to the current date if `todayISO` is not a valid ISO
 * date. Sun=0 … Thu=4 … Sat=6; we walk back to the most recent Thursday.
 */
export function weekOf(todayISO: string): string {
  const base =
    ISO_DATE_RE.test(todayISO) && !Number.isNaN(Date.parse(`${todayISO}T00:00:00Z`))
      ? new Date(`${todayISO}T00:00:00Z`)
      : new Date();
  const day = base.getUTCDay(); // 0 = Sun … 6 = Sat
  const daysSinceThursday = (day - 4 + 7) % 7; // Thu = 0
  const thursday = new Date(base);
  thursday.setUTCDate(base.getUTCDate() - daysSinceThursday);
  thursday.setUTCHours(0, 0, 0, 0);
  return fmtISO(thursday);
}
