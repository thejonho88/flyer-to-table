import { Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import type { ShoppingList } from '@/domain/types';
import { CHAIN_LABELS } from '@/domain/types';
import { formatQty, formatUnitPrice } from '@/domain/format';
import { formatMoney } from '@/domain/money';

/** Renders a shopping list as shareable plain text. */
export function shoppingListToText(list: ShoppingList): string {
  const lines: string[] = ['Flyer to Table — Shopping List', ''];
  for (const group of list.storeGroups) {
    lines.push(
      `${group.store.name} (${CHAIN_LABELS[group.store.chain]}) — ${formatMoney(group.subtotal)}`,
    );
    for (const item of group.items) {
      const sale = item.onSale ? ' [SALE]' : '';
      lines.push(
        `  - ${item.label} · ${formatQty(item.quantity, item.unit)} × ${formatUnitPrice(item.unitPrice, item.unit)} · ${formatMoney(item.lineTotal)}${sale}`,
      );
    }
    lines.push('');
  }
  lines.push(`Estimated total: ${formatMoney(list.totals.estimated)}`);
  lines.push(`You save ${formatMoney(list.totals.savings)} vs. regular prices`);
  lines.push('All prices in CAD');
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
