import type { SOHRecord, OrderSettings, StoreOrderSummary, StoreOrderItem } from './types';

export function calculateStoreOrders(soh: SOHRecord[], settings: OrderSettings): StoreOrderSummary[] {
  const supplierMap = new Map(settings.supplierLeadTimes.map(s => [s.supplier, s]));
  const storeMap = new Map<string, SOHRecord[]>();
  for (const r of soh) {
    if (!storeMap.has(r.kodeToko)) storeMap.set(r.kodeToko, []);
    storeMap.get(r.kodeToko)!.push(r);
  }

  const summaries: StoreOrderSummary[] = [];

  for (const [kodeToko, records] of storeMap) {
    const first = records[0];
    const items: StoreOrderItem[] = [];

    for (const r of records) {
      const avgMonthlyDemand = (r.avgSalesM3 + r.avgSalesM2 + r.avgSalesM1 + r.sales) / 4;
      const avgDailyDemand = avgMonthlyDemand / 30;
      if (avgDailyDemand <= 0 && r.soh <= 0) continue;

      const supplierEntry = supplierMap.get(r.supplier);
      const leadTimeDays = supplierEntry?.leadTimeDays ?? settings.defaultLeadTimeDays;
      const skuMoq = settings.skuMoqs?.[r.kodeProduk];
      const moq = skuMoq ?? supplierEntry?.moq ?? 1;

      const ssDemand = avgDailyDemand * Math.sqrt(leadTimeDays) * settings.safetyStockDemandFactor;
      const ssLeadTime = avgDailyDemand * settings.safetyStockLeadTimeFactor;
      const safetyStock = Math.ceil(ssDemand + ssLeadTime);
      const rop = Math.ceil(avgDailyDemand * leadTimeDays) + safetyStock;
      const orderUpTo = Math.ceil(avgDailyDemand * (leadTimeDays + settings.reviewPeriodDays)) + safetyStock;

      let suggestedQty = Math.max(0, orderUpTo - r.soh);
      if (moq > 1 && suggestedQty > 0) {
        suggestedQty = Math.ceil(suggestedQty / moq) * moq;
      }

      let priority: StoreOrderItem['priority'] = 'normal';
      if (r.soh <= 0 && avgDailyDemand > 0) priority = 'critical';
      else if (r.soh < rop * 0.5 && avgDailyDemand > 0) priority = 'critical';
      else if (r.soh < rop) priority = 'low';
      else if (r.soh > orderUpTo * 1.5 && orderUpTo > 0) priority = 'overstock';

      if (suggestedQty > 0 || priority === 'critical') {
        items.push({
          kodeProduk: r.kodeProduk, namaPanjang: r.namaPanjang, brand: r.brand,
          category: r.category, supplier: r.supplier, soh: r.soh,
          avgDailyDemand: Math.round(avgDailyDemand * 100) / 100,
          leadTimeDays, safetyStock, rop, maxStock: orderUpTo, suggestedQty, moq, priority,
        });
      }
    }

    items.sort((a, b) => {
      const pOrder = { critical: 0, low: 1, normal: 2, overstock: 3 };
      if (pOrder[a.priority] !== pOrder[b.priority]) return pOrder[a.priority] - pOrder[b.priority];
      return b.suggestedQty - a.suggestedQty;
    });

    if (items.length > 0) {
      summaries.push({
        kodeToko, namaToko: first.namaToko, namaCabang: first.namaCabang,
        totalSkuToOrder: items.length,
        totalOrderQty: items.reduce((s, i) => s + i.suggestedQty, 0),
        criticalCount: items.filter(i => i.priority === 'critical').length,
        items,
      });
    }
  }

  summaries.sort((a, b) => b.criticalCount - a.criticalCount || b.totalOrderQty - a.totalOrderQty);
  return summaries;
}
