// Types for Mobeng Inventory Management System

export interface SalesRecord {
  tanggal: string;
  namaCabang: string;
  kodeToko: string;
  namaToko: string;
  nomorTransaksi: string;
  brand: string;
  jenis: string;
  departement: string;
  category: string;
  skuLama: string;
  kodeProduk: string;
  namaPanjang: string;
  qty: number;
  hpp: number;
  hargaJualNormal: number;
  disc: number;
  subtotal: number;
  period: string; // YYYY-MM
}

export interface SOHRecord {
  kodeToko: string;
  namaToko: string;
  namaCabang: string;
  kodeProduk: string;
  namaPanjang: string;
  brand: string;
  category: string;
  tagProduk: string;
  supplier: string;
  soh: number; // Stock on Hand
  valueStock: number;
  avgDailySales: number;
  dsi: number; // Days of Stock Inventory
  minStock: number;
  maxStock: number;
  avgSalesM3: number; // Avg sales 3 months ago
  avgSalesM2: number; // Avg sales 2 months ago
  avgSalesM1: number; // Avg sales last month
  sales: number; // Current sales (column V)
  period: string; // YYYY-MM
  region: 'jkt' | 'sby';
}

export interface SkuSummary {
  kodeProduk: string;
  namaPanjang: string;
  brand: string;
  category: string;
  departement: string;
  totalQtySold: number;
  totalRevenue: number;
  avgDailySales: number;
  avgMonthlySales: number; // Average of M3, M2, M1
  storeCount: number;
  tagProduk: string;
  storeDetails: SkuStoreDetail[];
  movingClass: 'very_fast' | 'fast' | 'medium' | 'slow' | 'dead'; // Stock classification
  totalSoh: number;
  period: string;
}

export interface SkuStoreDetail {
  kodeToko: string;
  namaToko: string;
  soh: number;
  salesQty: number;
  stockValue: number;
  movingClass: 'very_fast' | 'fast' | 'medium' | 'slow' | 'dead';
}

export interface StoreSummary {
  kodeToko: string;
  namaToko: string;
  namaCabang: string;
  totalRevenue: number;
  totalTransactions: number;
  totalItemsSold: number;
  skuCount: number;
}

export interface SuggestedOrder {
  kodeProduk: string;
  namaPanjang: string;
  brand: string;
  category: string;
  kodeToko: string;
  namaToko: string;
  currentStock: number;
  avgDailySales: number;
  dsi: number;
  minStock: number;
  maxStock: number;
  suggestedQty: number;
  priority: 'critical' | 'low' | 'normal' | 'overstock';
}

export interface UploadedFile {
  id: string;
  name: string;
  type: 'sales' | 'soh-jkt' | 'soh-sby';
  uploadedAt: string;
  recordCount: number;
  period: string; // YYYY-MM
}

export interface HistoricalSnapshot {
  id: string;
  period: string; // YYYY-MM
  totalRevenue: number;
  totalStockValue: number;
  stockEfficiency: number;
  ito: number; // Inventory Turnover
  movingCounts: {
    veryFast: number;
    fast: number;
    medium: number;
    slow: number;
    dead: number;
  };
  createdAt: string;
}

export interface SupplierLeadTime {
  supplier: string;
  leadTimeDays: number;
  moq: number; // Minimum Order Quantity
}

export interface OrderSettings {
  defaultLeadTimeDays: number;
  safetyStockLeadTimeFactor: number;
  safetyStockDemandFactor: number;
  reviewPeriodDays: number;
  targetServiceLevel: number;
  supplierLeadTimes: SupplierLeadTime[];
  excludedStores: string[];
  excludedSuppliers: string[];
  excludedCategories: string[];
  excludedBrands: string[];
  skuMoqs: Record<string, number>; // kodeProduk -> MOQ override
}

export interface StoreOrderSummary {
  kodeToko: string;
  namaToko: string;
  namaCabang: string;
  totalSkuToOrder: number;
  totalOrderQty: number;
  criticalCount: number;
  items: StoreOrderItem[];
}

export interface StoreOrderItem {
  kodeProduk: string;
  namaPanjang: string;
  brand: string;
  category: string;
  supplier: string;
  soh: number;
  avgDailyDemand: number;
  leadTimeDays: number;
  safetyStock: number;
  rop: number; // Reorder Point
  maxStock: number;
  suggestedQty: number;
  moq: number;
  priority: 'critical' | 'low' | 'normal' | 'overstock';
}
