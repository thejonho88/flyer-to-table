/**
 * Canadian postal-code helpers. Format: A1A 1A1 (letter-digit-letter,
 * optional space, digit-letter-digit). Certain letters are never used in
 * Canadian postal codes (D, F, I, O, Q, U; W and Z not used as first letter).
 */
const POSTAL_RE = /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ -]?\d[ABCEGHJ-NPRSTV-Z]\d$/i;

export function isValidPostalCode(input: string): boolean {
  return POSTAL_RE.test(input.trim());
}

/** Normalize to canonical "A1A 1A1" (upper-case, single space). */
export function normalizePostalCode(input: string): string {
  const cleaned = input.trim().toUpperCase().replace(/[ -]/g, '');
  if (cleaned.length !== 6) return input.trim().toUpperCase();
  return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
}

/** Forward Sortation Area — the first three characters (e.g. "H2X"). */
export function fsaOf(input: string): string {
  return input.trim().toUpperCase().replace(/[ -]/g, '').slice(0, 3);
}
