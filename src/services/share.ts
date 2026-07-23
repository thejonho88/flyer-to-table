import { Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import type { ShoppingList } from '@/domain/types';
import { CHAIN_LABELS } from '@/domain/types';
import { formatUnitPrice } from '@/domain/format';

function formatQty(quantity: number, unit: string): string {
  const q = Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(2);
  return `${q} ${unit}`;
}

/** Renders a shopping list as shareable plain text. */
export function shoppingListToText(list: ShoppingList): string {
  const lines: string[] = ['Flyer to Table — Shopping List', ''];
  for (const group of list.storeGroups) {
    lines.push(
      `${group.store.name} (${CHAIN_LABELS[group.store.chain]}) — $${group.subtotal.toFixed(2)}`,
    );
    for (const item of group.items) {
      const sale = item.onSale ? ' [SALE]' : '';
      lines.push(
        `  - ${item.label} · ${formatQty(item.quantity, item.unit)} × ${formatUnitPrice(item.unitPrice, item.unit)} · $${item.lineTotal.toFixed(2)}${sale}`,
      );
    }
    lines.push('');
  }
  lines.push(`Estimated total: $${list.totals.estimated.toFixed(2)}`);
  lines.push(`You save $${list.totals.savings.toFixed(2)} vs. regular prices`);
  return lines.join('\n');
}

export type ShareResult = 'shared' | 'copied' | 'failed';

/**
 * Shares text via the Web Share API when available, otherwise copies to the
 * clipboard. Guarded so it stays RN-portable (no bare web APIs on native).
 */
export async function shareText(text: string): Promise<ShareResult> {
  if (Platform.OS === 'web') {
    const nav = typeof navigator !== 'undefined' ? (navigator as Navigator) : undefined;
    if (nav && typeof nav.share === 'function') {
      try {
        await nav.share({ text });
        return 'shared';
      } catch {
        // user cancelled or unsupported -> fall through to clipboard
      }
    }
  }
  try {
    await Clipboard.setStringAsync(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}
