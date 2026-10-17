/**
 * DUKAAN PRO - ORDER ID GENERATOR & FORMATTER
 * Format: [SequentialNumberToday]-[YYYY]-[MM]-[DD]
 * Example: 01-2026-10-18 (First order of that date)
 */

export function generateDailyOrderId(date: Date | string = new Date(), orderIndexToday: number = 1): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const indexStr = String(Math.max(1, orderIndexToday)).padStart(2, '0');
  return `${indexStr}-${yyyy}-${mm}-${dd}`;
}

export function formatExistingSaleId(sale: { id: string; created_at?: string; order_number?: string }, indexForDay?: number): string {
  if (sale.order_number && sale.order_number.trim().length > 0) {
    return sale.order_number;
  }
  return generateDailyOrderId(sale.created_at || new Date(), indexForDay || 1);
}

/**
 * Maps an array of sales to consistent sequential daily order IDs.
 * Groups by date (YYYY-MM-DD) and counts sequentially 01, 02, 03...
 */
export function mapSalesWithOrderIds<T extends { id: string; created_at: string; order_number?: string }>(
  sales: T[]
): (T & { formatted_order_id: string })[] {
  // Sort chronologically ascending to assign 01, 02, 03...
  const sorted = [...sales].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const dateCounters: Record<string, number> = {};
  const orderIdMap = new Map<string, string>();

  sorted.forEach(sale => {
    if (sale.order_number && sale.order_number.trim().length > 0) {
      orderIdMap.set(sale.id, sale.order_number);
      return;
    }

    const d = new Date(sale.created_at);
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    dateCounters[dateKey] = (dateCounters[dateKey] || 0) + 1;
    const indexStr = String(dateCounters[dateKey]).padStart(2, '0');
    orderIdMap.set(sale.id, `${indexStr}-${dateKey}`);
  });

  return sales.map(sale => ({
    ...sale,
    formatted_order_id: orderIdMap.get(sale.id) || generateDailyOrderId(sale.created_at, 1)
  }));
}
