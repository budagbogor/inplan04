import type { OrderSettings } from './types';

const SETTINGS_KEY = 'mobeng_order_settings';

export const DEFAULT_ORDER_SETTINGS: OrderSettings = {
  defaultLeadTimeDays: 14,
  safetyStockLeadTimeFactor: 1.5,
  safetyStockDemandFactor: 1.3,
  reviewPeriodDays: 7,
  targetServiceLevel: 0.95,
  supplierLeadTimes: [],
  excludedStores: [],
  excludedSuppliers: [
    'Alpha Omega motor',
    'General Partshop Jakarta',
    'General Partshop Surabaya',
    'Mitra Serpong',
    'TB. Lancar Motor',
    'New Cahaya Motor',
    'Jasutra Motor',
    'Gemilang jaya Motor',
    'Liberty Motor',
    'Sumber Media',
    '8 Malang',
    '8 MOTOR MALANG',
    'tokopedia',
    'PT CIPTA GEMILANG BERSAMA'
  ],
  excludedCategories: [],
  excludedBrands: [],
  skuMoqs: {},
};

/** Filter records based on excluded stores, suppliers, and categories in settings */
export function filterByActiveStores<T extends { kodeToko: string }>(records: T[], settings?: OrderSettings): T[] {
  const s = settings ?? getOrderSettings();
  let filtered = records;

  if (s.excludedStores.length > 0) {
    const excluded = new Set(s.excludedStores);
    filtered = filtered.filter(r => !excluded.has(r.kodeToko));
  }

  if (s.excludedSuppliers.length > 0) {
    const excluded = new Set(s.excludedSuppliers);
    filtered = filtered.filter(r => {
      const supplier = (r as Record<string, unknown>).supplier;
      if (typeof supplier !== 'string') return true; // record has no supplier field, keep it
      return !excluded.has(supplier);
    });
  }

  if (s.excludedCategories.length > 0) {
    const excluded = new Set(s.excludedCategories);
    filtered = filtered.filter(r => {
      const category = (r as Record<string, unknown>).category;
      if (typeof category !== 'string') return true;
      return !excluded.has(category);
    });
  }

  if (s.excludedBrands && s.excludedBrands.length > 0) {
    const excluded = new Set(s.excludedBrands);
    filtered = filtered.filter(r => {
      const brand = (r as Record<string, unknown>).brand;
      if (typeof brand !== 'string') return true;
      return !excluded.has(brand);
    });
  }

  return filtered;
}

export function getOrderSettings(): OrderSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      return { ...DEFAULT_ORDER_SETTINGS, ...JSON.parse(stored) };
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_ORDER_SETTINGS };
}

export function saveOrderSettings(settings: OrderSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
