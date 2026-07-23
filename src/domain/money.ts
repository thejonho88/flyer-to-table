/**
 * Canonical CAD money formatting. All user-facing dollar amounts in the app go
 * through formatMoney so currency presentation is consistent (en-CA, "$X.XX").
 *
 * Intl is available in modern Hermes/Web, but we guard it with a try/catch and
 * a manual fallback so a stripped Intl build can never crash the price UI.
 */
export function formatMoney(n: number): string {
  try {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
    }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}
