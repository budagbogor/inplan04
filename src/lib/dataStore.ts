import ExcelJS from 'exceljs';
import { parse, format, isValid } from 'date-fns';
import { SalesRecord, SOHRecord, SkuSummary, UploadedFile, HistoricalSnapshot } from './types';
import { supabase } from './supabase';
import {
  idbDeleteSOH,
  idbDeleteSales,
  idbDeleteUploadedFile,
  idbGetSales,
  idbGetSOH,
  idbGetUploadedFiles,
  idbReplaceUploadedFiles,
  idbSaveSOH,
  idbSaveSales,
} from './indexedDbStore';

type DataType = 'sales' | 'soh-jkt' | 'soh-sby';

// In-memory cache by period
const salesCacheMap = new Map<string, SalesRecord[]>();
const sohJktCacheMap = new Map<string, SOHRecord[]>();
const sohSbyCacheMap = new Map<string, SOHRecord[]>();
let uploadedFilesCache: UploadedFile[] | null = null;
let historicalSnapshotsCache: HistoricalSnapshot[] | null = null;

export function invalidateCache() {
  salesCacheMap.clear();
  sohJktCacheMap.clear();
  sohSbyCacheMap.clear();
  uploadedFilesCache = null;
  historicalSnapshotsCache = null;
}

type HeaderAliasMap<T extends string> = Record<T, string[]>;

const SALES_COLUMN_ALIASES: HeaderAliasMap<Exclude<keyof SalesRecord, 'period'>> = {
  tanggal: ['tanggal', 'date'],
  namaCabang: ['nama cabang', 'cabang', 'branch'],
  kodeToko: ['kode toko', 'kode_toko', 'store code'],
  namaToko: ['nama toko', 'nama_toko', 'store name'],
  nomorTransaksi: ['nomor transaksi', 'no transaksi', 'transaction number', 'transaction id'],
  brand: ['brand', 'merek'],
  jenis: ['jenis', 'type'],
  departement: ['departement', 'department', 'dept'],
  category: ['category', 'kategori', 'divisi', 'division'],
  skuLama: ['sku lama', 'old sku'],
  kodeProduk: ['kode produk', 'kode_produk', 'product code', 'sku'],
  namaPanjang: ['nama panjang', 'nama produk', 'product name'],
  qty: ['qty', 'quantity'],
  hpp: ['hpp', 'cogs', 'cost'],
  hargaJualNormal: ['harga jual normal', 'harga jual', 'selling price', 'normal price'],
  disc: ['disc', 'discount'],
  subtotal: ['subtotal', 'nett sales', 'net sales', 'amount'],
};

const SOH_COLUMN_ALIASES: HeaderAliasMap<Exclude<keyof SOHRecord, 'period' | 'region'>> = {
  kodeToko: ['kode toko', 'kode_toko', 'store code'],
  namaToko: ['nama toko', 'nama_toko', 'store name', 'nama toko / dc', 'nama toko dc'],
  namaCabang: ['nama cabang', 'cabang', 'branch'],
  kodeProduk: ['kode produk', 'kode_produk', 'product code', 'sku'],
  namaPanjang: ['nama panjang', 'nama produk', 'product name'],
  brand: ['brand', 'merek'],
  category: ['category', 'kategori', 'divisi', 'division'],
  tagProduk: ['tag produk', 'tag_produk', 'product tag'],
  supplier: ['supplier', 'vendor', 'pemasok'],
  soh: ['soh', 'stock on hand', 'stok', 'stock', 'qty soh', 'stk'],
  valueStock: ['value stock', 'nilai stok', 'stock value', 'value'],
  avgDailySales: ['avg daily sales', 'avg daily', 'daily sales', 'avg'],
  dsi: ['dsi', 'days of stock', 'days stock'],
  minStock: ['min stock', 'minimum stock', 'minimum', 'min'],
  maxStock: ['max stock', 'maximum stock', 'maximum', 'max'],
  avgSalesM3: ['avg sales m3', 'avg m3', 'm3', 'avg sales m 3', 'sales m3', 'average m3', 'sales m 3'],
  avgSalesM2: ['avg sales m2', 'avg m2', 'm2', 'avg sales m 2', 'sales m2', 'average m2', 'sales m 2'],
  avgSalesM1: ['avg sales m1', 'avg m1', 'm1', 'avg sales m 1', 'sales m1', 'average m1', 'sales m 1'],
  sales: ['sales', 'penjualan', 'total sales', 'jual'],
};

function normalizeColumnName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_\\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findColumnIndex(headers: string[], possibleNames: string[]): number {
  const normalizedNames = possibleNames.map(normalizeColumnName);

  // 1) Exact match first
  for (const name of normalizedNames) {
    const idx = headers.indexOf(name);
    if (idx !== -1) return idx;
  }

  // 2) Header starts with alias (e.g. "nama toko / dc")
  for (const name of normalizedNames) {
    const idx = headers.findIndex((header) => header?.startsWith(name));
    if (idx !== -1) return idx;
  }

  // 3) Header contains alias (one-way only to avoid false positives)
  for (const name of normalizedNames) {
    const idx = headers.findIndex((header) => header?.includes(name));
    if (idx !== -1) return idx;
  }

  return -1;
}

function detectHeaderRowIndex(rows: unknown[][], aliasMap: HeaderAliasMap<string>): number {
  const aliasGroups = Object.values(aliasMap) as string[][];
  const scanLimit = Math.min(rows.length, 40);
  const minimumMatches = Math.max(6, Math.ceil(aliasGroups.length * 0.45));

  let bestIndex = -1;
  let bestScore = 0;

  for (let i = 0; i < scanLimit; i++) {
    const row = rows[i];
    if (!row || !Array.isArray(row)) continue;
    
    const headers = row.map((cell) => normalizeColumnName(String(cell ?? '')));
    const nonEmptyHeaders = headers.filter(Boolean);

    if (nonEmptyHeaders.length < 2) continue;

    let score = 0;
    for (const aliases of aliasGroups) {
      if (findColumnIndex(headers, aliases) !== -1) score++;
    }

    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  return bestScore >= minimumMatches ? bestIndex : -1;
}

function getColumnIndexes<T extends string>(headers: string[], aliasMap: HeaderAliasMap<T>): Record<T, number> {
  const indexes = {} as Record<T, number>;

  for (const key of Object.keys(aliasMap) as T[]) {
    indexes[key] = findColumnIndex(headers, aliasMap[key]);
  }

  return indexes;
}

function getSheetRows(sheet: ExcelJS.Worksheet): unknown[][] {
  const rows: unknown[][] = [];
  sheet.eachRow({ includeEmpty: true }, (row) => {
    // exceljs rows are 1-indexed. row.values starts with empty at 0 if we don't handle it
    const rowValues = (row.values as unknown[]);
    // If it's an array, first element is empty due to 1-indexing
    if (Array.isArray(rowValues)) {
      rows.push(rowValues.slice(1));
    }
  });
  return rows;
}

function isNonEmptyRow(row: unknown[]): boolean {
  return row.some((cell) => String(cell ?? '').trim() !== '');
}

function getCell(row: unknown[], index: number): unknown {
  if (index < 0) return '';
  return row[index];
}

function parseDateValue(value: unknown): string {
  if (!value) return '';

  if (typeof value === 'number' && value > 1 && value < 100000) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(excelEpoch.getTime() + value * 86400000);
    return format(date, 'yyyy-MM-dd');
  }

  if (value instanceof Date && isValid(value)) {
    return format(value, 'yyyy-MM-dd');
  }

  const text = String(value).trim();
  if (!text) return '';

  const formats = ['dd/MM/yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd', 'dd-MM-yyyy', 'MM-dd-yyyy', 'dd/MM/yy', 'MM/dd/yy'];
  for (const fmt of formats) {
    const parsed = parse(text, fmt, new Date());
    if (isValid(parsed) && parsed.getFullYear() > 1900) {
      return format(parsed, 'yyyy-MM-dd');
    }
  }

  const fallback = new Date(text);
  if (isValid(fallback)) return format(fallback, 'yyyy-MM-dd');

  return text;
}

export function normalizeProductCode(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(Math.trunc(value));
  }

  return String(value ?? '')
    .trim()
    .replace(/\.0+$/, '')
    .replace(/\s+/g, '')
    .toUpperCase();
}

// Parse sales Excel
export async function parseSalesExcel(file: File): Promise<SalesRecord[]> {
  const workbook = new ExcelJS.Workbook();
  const data = await file.arrayBuffer();
  await workbook.xlsx.load(data);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('File Excel tidak memiliki worksheet.');

  const rows = getSheetRows(sheet);
  const headerRowIndex = detectHeaderRowIndex(rows, SALES_COLUMN_ALIASES);

  if (headerRowIndex === -1) {
    throw new Error('Header kolom Sales tidak dikenali.');
  }

  const normalizedHeaders = rows[headerRowIndex].map((cell) => normalizeColumnName(String(cell ?? '')));
  const indexes = getColumnIndexes(normalizedHeaders, SALES_COLUMN_ALIASES);
  const dataRows = rows.slice(headerRowIndex + 1).filter(isNonEmptyRow);

  const records: SalesRecord[] = dataRows
    .map((row) => ({
      tanggal: parseDateValue(getCell(row, indexes.tanggal)),
      namaCabang: String(getCell(row, indexes.namaCabang) || '').trim(),
      kodeToko: normalizeProductCode(getCell(row, indexes.kodeToko)),
      namaToko: String(getCell(row, indexes.namaToko) || '').trim(),
      nomorTransaksi: String(getCell(row, indexes.nomorTransaksi) || '').trim(),
      brand: String(getCell(row, indexes.brand) || '').trim(),
      jenis: String(getCell(row, indexes.jenis) || '').trim(),
      departement: String(getCell(row, indexes.departement) || '').trim(),
      category: String(getCell(row, indexes.category) || '').trim(),
      skuLama: String(getCell(row, indexes.skuLama) || '').trim(),
      kodeProduk: normalizeProductCode(getCell(row, indexes.kodeProduk)),
      namaPanjang: String(getCell(row, indexes.namaPanjang) || '').trim(),
      qty: parseNum(getCell(row, indexes.qty)),
      hpp: parseNum(getCell(row, indexes.hpp)),
      hargaJualNormal: parseNum(getCell(row, indexes.hargaJualNormal)),
      disc: parseNum(getCell(row, indexes.disc)),
      subtotal: parseNum(getCell(row, indexes.subtotal)),
      period: '', // Will be set during save
    }))
    .filter((record) => record.kodeProduk && record.qty > 0);

  return records;
}

// Parse SOH Excel - robust header matching
export async function parseSOHExcel(file: File): Promise<SOHRecord[]> {
  const workbook = new ExcelJS.Workbook();
  const data = await file.arrayBuffer();
  await workbook.xlsx.load(data);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('File Excel tidak memiliki worksheet.');

  const rows = getSheetRows(sheet);
  const headerRowIndex = detectHeaderRowIndex(rows, SOH_COLUMN_ALIASES);

  if (headerRowIndex === -1) {
    throw new Error('Header kolom SOH tidak dikenali.');
  }

  const normalizedHeaders = rows[headerRowIndex].map((cell) => normalizeColumnName(String(cell ?? '')));
  const indexes = getColumnIndexes(normalizedHeaders, SOH_COLUMN_ALIASES);
  const dataRows = rows.slice(headerRowIndex + 1).filter(isNonEmptyRow);

  const records: SOHRecord[] = dataRows
    .map((row) => ({
      kodeToko: normalizeProductCode(getCell(row, indexes.kodeToko)),
      namaToko: String(getCell(row, indexes.namaToko) || '').trim(),
      namaCabang: String(getCell(row, indexes.namaCabang) || '').trim(),
      kodeProduk: normalizeProductCode(getCell(row, indexes.kodeProduk)),
      namaPanjang: String(getCell(row, indexes.namaPanjang) || '').trim(),
      brand: String(getCell(row, indexes.brand) || '').trim(),
      category: String(getCell(row, indexes.category) || '').trim(),
      tagProduk: String(getCell(row, indexes.tagProduk) || '').trim(),
      supplier: String(getCell(row, indexes.supplier) || '').trim(),
      soh: parseNum(getCell(row, indexes.soh)),
      valueStock: parseNum(getCell(row, indexes.valueStock)),
      avgDailySales: parseNum(getCell(row, indexes.avgDailySales)),
      dsi: parseNum(getCell(row, indexes.dsi)),
      minStock: parseNum(getCell(row, indexes.minStock)),
      maxStock: parseNum(getCell(row, indexes.maxStock)),
      avgSalesM3: parseNum(getCell(row, indexes.avgSalesM3)),
      avgSalesM2: parseNum(getCell(row, indexes.avgSalesM2)),
      avgSalesM1: parseNum(getCell(row, indexes.avgSalesM1)),
      sales: parseNum(getCell(row, indexes.sales)),
      period: '', // Will be set during save
      region: 'jkt' as 'jkt' | 'sby', // Will be set during save
    }))
    .filter((record) => record.kodeProduk);

  return records;
}

function parseNum(val: unknown): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (val === null || val === undefined || val === '') return 0;

  let str = String(val).trim();
  // Remove currency symbols and whitespace
  str = str.replace(/[¤$\u20AC£¥\s]/g, '');

  // Auto-detect locale: if last separator is comma → comma-decimal (e.g. 1.234,56)
  const lastComma = str.lastIndexOf(',');
  const lastDot = str.lastIndexOf('.');
  const isCommaDecimal = lastComma > lastDot;

  if (isCommaDecimal) {
    str = str.replace(/\./g, '');   // remove thousand dots
    str = str.replace(',', '.');    // convert decimal comma
  } else {
    str = str.replace(/,/g, '');    // remove thousand commas
  }

  str = str.replace(/[^\d.-]/g, '');
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
}

// -------------------------------------------------------------------------
// Supabase Integration
// -------------------------------------------------------------------------

export async function saveSalesData(records: SalesRecord[], period: string) {
  const recordsWithPeriod = records.map(r => ({ ...r, period }));
  await idbSaveSales(period, recordsWithPeriod);

  invalidateCache();
}

export async function getSalesData(period?: string): Promise<SalesRecord[]> {
  // If period not provided, get the latest one from uploaded_files
  let targetPeriod = period;
  if (!targetPeriod) {
    const files = await getUploadedFiles();
    const salesFiles = files.filter(f => f.type === 'sales');
    if (salesFiles.length > 0) {
      targetPeriod = salesFiles[0].period;
    }
  }

  if (!targetPeriod) return [];
  
  // Cache check for specific period
  if (salesCacheMap.has(targetPeriod)) {
    return salesCacheMap.get(targetPeriod)!;
  }

  const records = (await idbGetSales(targetPeriod)) ?? [];

  salesCacheMap.set(targetPeriod, records);
  return records;
}

export async function saveSOHDataByRegion(records: SOHRecord[], region: 'jkt' | 'sby', period: string) {
  const recordsWithMeta = records.map(r => ({ ...r, period, region }));
  await idbSaveSOH(period, region, recordsWithMeta);

  invalidateCache();
}

export async function getSOHDataByRegion(region: 'jkt' | 'sby', period?: string): Promise<SOHRecord[]> {
  let targetPeriod = period;
  if (!targetPeriod) {
    const files = await getUploadedFiles();
    const sohFiles = files.filter(f => f.type === `soh-${region}`);
    if (sohFiles.length > 0) {
      targetPeriod = sohFiles[0].period;
    }
  }

  if (!targetPeriod) return [];

  const cacheMap = region === 'jkt' ? sohJktCacheMap : sohSbyCacheMap;
  if (cacheMap.has(targetPeriod)) {
    return cacheMap.get(targetPeriod)!;
  }

  const mapped = (await idbGetSOH(targetPeriod, region)) ?? [];

  if (region === 'jkt') {
    sohJktCacheMap.set(targetPeriod, mapped);
  } else {
    sohSbyCacheMap.set(targetPeriod, mapped);
  }

  return mapped;
}

/** @deprecated Use saveSOHDataByRegion with period instead */
export async function saveSOHData(records: SOHRecord[]) {
  await saveSOHDataByRegion(records, 'jkt', 'latest');
}

/** Returns merged SOH data from both JKT and SBY for a period */
export async function getSOHData(period?: string): Promise<SOHRecord[]> {
  const [jkt, sby] = await Promise.all([
    getSOHDataByRegion('jkt', period),
    getSOHDataByRegion('sby', period),
  ]);
  return [...jkt, ...sby];
}

export async function saveUploadedFiles(files: UploadedFile[]) {
  await idbReplaceUploadedFiles(files);
  invalidateCache();
}

export async function getUploadedFiles(): Promise<UploadedFile[]> {
  if (uploadedFilesCache) return uploadedFilesCache;

  const data = await idbGetUploadedFiles();
  uploadedFilesCache = [...(data || [])]
    .map(f => ({
      id: f.id,
      name: f.name,
      type: f.type as DataType,
      uploadedAt: f.uploadedAt,
      recordCount: Number(f.recordCount),
      period: f.period,
    }))
    .sort((a, b) => String(b.uploadedAt).localeCompare(String(a.uploadedAt)));

  return uploadedFilesCache;
}

export async function getSalesCount(period?: string): Promise<number> {
  if (period) {
    const sales = await idbGetSales(period);
    return sales?.length ?? 0;
  }

  const files = await getUploadedFiles();
  const periods = Array.from(new Set(files.filter(f => f.type === 'sales').map(f => f.period)));
  let total = 0;
  for (const p of periods) {
    const sales = await idbGetSales(p);
    total += sales?.length ?? 0;
  }
  return total;
}

export async function getSOHCountByRegion(region: 'jkt' | 'sby', period?: string): Promise<number> {
  if (period) {
    const soh = await idbGetSOH(period, region);
    return soh?.length ?? 0;
  }

  const files = await getUploadedFiles();
  const periods = Array.from(new Set(files.filter(f => f.type === `soh-${region}`).map(f => f.period)));
  let total = 0;
  for (const p of periods) {
    const soh = await idbGetSOH(p, region);
    total += soh?.length ?? 0;
  }
  return total;
}

export async function getSOHCount(period?: string): Promise<number> {
  const [jkt, sby] = await Promise.all([
    getSOHCountByRegion('jkt', period),
    getSOHCountByRegion('sby', period),
  ]);
  return jkt + sby;
}

export async function deleteUploadedFile(fileId: string, type: string, period: string) {
  await idbDeleteUploadedFile(fileId);

  if (type === 'sales') {
    await idbDeleteSales(period);
  } else if (type === 'soh-jkt') {
    await idbDeleteSOH(period, 'jkt');
  } else if (type === 'soh-sby') {
    await idbDeleteSOH(period, 'sby');
  }

  invalidateCache();
}

export async function clearDataByType(type: 'sales' | 'soh-jkt' | 'soh-sby') {
  const allFiles = await idbGetUploadedFiles();
  const toDelete = allFiles.filter(f => f.type === type);
  const remaining = allFiles.filter(f => f.type !== type);

  await idbReplaceUploadedFiles(remaining);

  if (type === 'sales') {
    const periods = Array.from(new Set(toDelete.map(f => f.period)));
    for (const p of periods) await idbDeleteSales(p);
  } else if (type === 'soh-jkt') {
    const periods = Array.from(new Set(toDelete.map(f => f.period)));
    for (const p of periods) await idbDeleteSOH(p, 'jkt');
  } else {
    const periods = Array.from(new Set(toDelete.map(f => f.period)));
    for (const p of periods) await idbDeleteSOH(p, 'sby');
  }

  invalidateCache();
}

// Analytics helpers
export function calculateSuggestedOrders(sales: SalesRecord[], soh: SOHRecord[], leadTimeDays = 14): import('./types').SuggestedOrder[] {
  // Calculate avg daily sales per SKU per store from sales data
  const salesMap = new Map<string, { totalQty: number; days: Set<string> }>();
  
  for (const s of sales) {
    const key = `${s.kodeProduk}__${s.kodeToko}`;
    if (!salesMap.has(key)) salesMap.set(key, { totalQty: 0, days: new Set() });
    const entry = salesMap.get(key)!;
    entry.totalQty += s.qty;
    entry.days.add(s.tanggal);
  }

  // Get unique dates for period calculation
  const allDates = new Set(sales.map(s => s.tanggal));
  const periodDays = Math.max(allDates.size, 1);

  // If we have SOH data, use it; otherwise estimate from sales
  if (soh.length > 0) {
    return soh.map(item => {
      const salesKey = `${item.kodeProduk}__${item.kodeToko}`;
      const salesEntry = salesMap.get(salesKey);
      const avgDaily = salesEntry ? salesEntry.totalQty / periodDays : item.avgDailySales;
      const neededStock = Math.ceil(avgDaily * leadTimeDays);
      const suggestedQty = Math.max(0, (item.maxStock || neededStock) - item.soh);
      
      let priority: 'critical' | 'low' | 'normal' | 'overstock' = 'normal';
      if (item.soh <= 0 && avgDaily > 0) priority = 'critical';
      else if (item.dsi > 0 && item.dsi < 7) priority = 'critical';
      else if (item.dsi > 0 && item.dsi < 14) priority = 'low';
      else if (item.soh > item.maxStock && item.maxStock > 0) priority = 'overstock';

      return {
        kodeProduk: item.kodeProduk,
        namaPanjang: item.namaPanjang,
        brand: item.brand,
        category: item.category,
        kodeToko: item.kodeToko,
        namaToko: item.namaToko,
        currentStock: item.soh,
        avgDailySales: Math.round(avgDaily * 100) / 100,
        dsi: item.dsi,
        minStock: item.minStock,
        maxStock: item.maxStock,
        suggestedQty,
        priority,
      };
    }).filter(o => o.suggestedQty > 0 || o.priority === 'critical');
  }

  // No SOH data - generate from sales only
  const orders: import('./types').SuggestedOrder[] = [];
  const storeInfo = new Map<string, { namaToko: string }>();
  for (const s of sales) {
    storeInfo.set(s.kodeToko, { namaToko: s.namaToko });
  }

  for (const [key, entry] of salesMap.entries()) {
    const [kodeProduk, kodeToko] = key.split('__');
    const avgDaily = entry.totalQty / periodDays;
    const sample = sales.find(s => s.kodeProduk === kodeProduk);
    const neededStock = Math.ceil(avgDaily * leadTimeDays);
    
    orders.push({
      kodeProduk,
      namaPanjang: sample?.namaPanjang || '',
      brand: sample?.brand || '',
      category: sample?.category || '',
      kodeToko,
      namaToko: storeInfo.get(kodeToko)?.namaToko || '',
      currentStock: 0,
      avgDailySales: Math.round(avgDaily * 100) / 100,
      dsi: 0,
      minStock: 0,
      maxStock: neededStock,
      suggestedQty: neededStock,
      priority: 'normal',
    });
  }

  return orders.sort((a, b) => b.avgDailySales - a.avgDailySales);
}

export function getSkuSummaries(sales: SalesRecord[], soh?: SOHRecord[]): import('./types').SkuSummary[] {
  const map = new Map<string, import('./types').SkuSummary & { stores: Set<string> }>();
  const allDates = new Set(sales.map(s => s.tanggal));
  const periodDays = Math.max(allDates.size, 1);

  // Build SOH monthly avg map: kodeProduk -> { m3, m2, m1 totals and count }
  const sohMap = new Map<string, { totalM3: number; totalM2: number; totalM1: number; count: number }>();
  if (soh) {
    for (const s of soh) {
      if (!sohMap.has(s.kodeProduk)) {
        sohMap.set(s.kodeProduk, { totalM3: 0, totalM2: 0, totalM1: 0, count: 0 });
      }
      const entry = sohMap.get(s.kodeProduk)!;
      entry.totalM3 += s.avgSalesM3;
      entry.totalM2 += s.avgSalesM2;
      entry.totalM1 += s.avgSalesM1;
      entry.count++;
    }
  }

  // Build a store info map and sales/soh lookups
  const storeInfoMap = new Map<string, string>();
  const salesLookup = new Map<string, number>(); // key: sku__store
  const sohLookup = new Map<string, { 
    soh: number; 
    value: number; 
    tag: string;
    avgM3: number;
    avgM2: number;
    avgM1: number;
  }>();

  for (const s of sales) {
    if (!storeInfoMap.has(s.kodeToko)) storeInfoMap.set(s.kodeToko, s.namaToko);
    const key = `${s.kodeProduk}__${s.kodeToko}`;
    salesLookup.set(key, (salesLookup.get(key) || 0) + s.qty);
  }

  if (soh) {
    for (const s of soh) {
      if (!storeInfoMap.has(s.kodeToko)) storeInfoMap.set(s.kodeToko, s.namaToko);
      const key = `${s.kodeProduk}__${s.kodeToko}`;
      sohLookup.set(key, { 
        soh: s.soh, 
        value: s.valueStock, 
        tag: s.tagProduk,
        avgM3: s.avgSalesM3,
        avgM2: s.avgSalesM2,
        avgM1: s.avgSalesM1
      });
    }
  }

  const allStoreCodes = Array.from(storeInfoMap.keys());

  for (const s of sales) {
    if (!map.has(s.kodeProduk)) {
      // Find tag from any store for this SKU
      const sampleSohKey = Array.from(sohLookup.keys()).find(k => k.startsWith(`${s.kodeProduk}__`));
      const tag = sampleSohKey ? sohLookup.get(sampleSohKey)?.tag : '';

      map.set(s.kodeProduk, {
        kodeProduk: s.kodeProduk,
        namaPanjang: s.namaPanjang,
        brand: s.brand,
        category: s.category,
        departement: s.departement,
        totalQtySold: 0,
        totalRevenue: 0,
        avgDailySales: 0,
        avgMonthlySales: 0,
        storeCount: 0,
        tagProduk: tag || '',
        storeDetails: [],
        movingClass: 'dead',
        totalSoh: 0,
        stores: new Set(),
        period: sales[0]?.period || '',
      });
    }
    const entry = map.get(s.kodeProduk)!;
    entry.totalQtySold += s.qty;
    entry.totalRevenue += s.subtotal;
    entry.stores.add(s.kodeToko);
  }

  return Array.from(map.values()).map(e => {
    // Generate store-level details for ALL stores
    const storeDetails = allStoreCodes.map(kodeToko => {
      const key = `${e.kodeProduk}__${kodeToko}`;
      const sDetail = sohLookup.get(key);
      const storeAvgMonthly = sDetail 
        ? (sDetail.avgM3 + sDetail.avgM2 + sDetail.avgM1) / 3 
        : (salesLookup.get(key) || 0) / periodDays * 30;

      let storeMoving: 'very_fast' | 'fast' | 'medium' | 'slow' | 'dead' = 'dead';
      if (storeAvgMonthly >= 10) storeMoving = 'very_fast';
      else if (storeAvgMonthly >= 4) storeMoving = 'fast';
      else if (storeAvgMonthly >= 1) storeMoving = 'medium';
      else if (storeAvgMonthly > 0) storeMoving = 'slow';

      return {
        kodeToko,
        namaToko: storeInfoMap.get(kodeToko) || '',
        soh: sDetail?.soh || 0,
        salesQty: salesLookup.get(key) || 0,
        stockValue: sDetail?.value || 0,
        movingClass: storeMoving,
      };
    });

    const sohEntry = sohMap.get(e.kodeProduk);
    const avgMonthly = sohEntry
      ? Math.round(((sohEntry.totalM3 + sohEntry.totalM2 + sohEntry.totalM1) / 3) * 100) / 100
      : Math.round((e.totalQtySold / periodDays * 30) * 100) / 100;

    let movingClass: 'very_fast' | 'fast' | 'medium' | 'slow' | 'dead' = 'dead';
    if (avgMonthly >= 10) movingClass = 'very_fast';
    else if (avgMonthly >= 4) movingClass = 'fast';
    else if (avgMonthly >= 1) movingClass = 'medium';
    else if (avgMonthly > 0) movingClass = 'slow';

    return {
      ...e,
      avgDailySales: Math.round((e.totalQtySold / periodDays) * 100) / 100,
      avgMonthlySales: avgMonthly,
      storeCount: e.stores.size,
      storeDetails,
      movingClass,
    };
  }).sort((a, b) => b.totalRevenue - a.totalRevenue);
}

export function getStoreSummaries(sales: SalesRecord[]): import('./types').StoreSummary[] {
  const map = new Map<string, import('./types').StoreSummary & { skus: Set<string>; txns: Set<string> }>();

  for (const s of sales) {
    if (!map.has(s.kodeToko)) {
      map.set(s.kodeToko, {
        kodeToko: s.kodeToko,
        namaToko: s.namaToko,
        namaCabang: s.namaCabang,
        totalRevenue: 0,
        totalTransactions: 0,
        totalItemsSold: 0,
        skuCount: 0,
        skus: new Set(),
        txns: new Set(),
      });
    }
    const entry = map.get(s.kodeToko)!;
    entry.totalRevenue += s.subtotal;
    entry.totalItemsSold += s.qty;
    entry.skus.add(s.kodeProduk);
    entry.txns.add(s.nomorTransaksi);
  }

  return Array.from(map.values()).map(e => ({
    ...e,
    skuCount: e.skus.size,
    totalTransactions: e.txns.size,
  })).sort((a, b) => b.totalRevenue - a.totalRevenue);
}

export function formatCurrency(val: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
}

export function formatNumber(val: number): string {
  return new Intl.NumberFormat('id-ID').format(val);
}

// Historical Snapshot Functions
export async function getHistoricalSnapshots(): Promise<HistoricalSnapshot[]> {
  if (historicalSnapshotsCache) return historicalSnapshotsCache;

  const { data, error } = await supabase
    .from('historical_snapshots')
    .select('*')
    .order('period', { ascending: true });

  if (error) {
    console.error('Error fetching snapshots:', error);
    return [];
  }

  historicalSnapshotsCache = (data || []).map(s => ({
    id: s.id,
    period: s.period,
    totalRevenue: Number(s.total_revenue),
    totalStockValue: Number(s.total_stock_value),
    stockEfficiency: Number(s.stock_efficiency),
    ito: Number(s.ito),
    movingCounts: s.moving_counts,
    storeData: s.store_data || {},
    createdAt: s.created_at,
  }));

  return historicalSnapshotsCache;
}

export async function saveHistoricalSnapshot(snapshot: Omit<HistoricalSnapshot, 'id' | 'createdAt'>) {
  const { error } = await supabase
    .from('historical_snapshots')
    .upsert({
      period: snapshot.period,
      total_revenue: snapshot.totalRevenue,
      total_stock_value: snapshot.totalStockValue,
      stock_efficiency: snapshot.stockEfficiency,
      ito: snapshot.ito,
      moving_counts: snapshot.movingCounts,
      store_data: snapshot.storeData || {},
    }, { onConflict: 'period' });

  if (error) throw error;

  historicalSnapshotsCache = null;
}

export async function generateMonthlySnapshot(period: string): Promise<Omit<HistoricalSnapshot, 'id' | 'createdAt'>> {
  const [sales, soh] = await Promise.all([
    getSalesData(period),
    getSOHData(period)
  ]);

  if (sales.length === 0 || soh.length === 0) {
    throw new Error(`Data tidak lengkap untuk periode ${period}`);
  }

  // Find previous period for ITO calculation
  const [year, month] = period.split('-').map(Number);
  const prevDate = new Date(year, month - 2, 1);
  const prevPeriod = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
  
  // Try to get previous SOH for Average Inventory
  const prevSoh = await getSOHData(prevPeriod).catch(() => [] as SOHRecord[]);

  // 1. Total COGS (HPP * Qty)
  const totalCogs = sales.reduce((sum, r) => sum + (r.qty * (r.hpp || 0)), 0);
  const totalRevenue = sales.reduce((sum, r) => sum + r.subtotal, 0);

  // 2. Average Inventory Value
  const endingStockValue = soh.reduce((sum, r) => sum + (r.valueStock || 0), 0);
  const beginningStockValue = prevSoh.length > 0 
    ? prevSoh.reduce((sum, r) => sum + (r.valueStock || 0), 0)
    : endingStockValue; 

  const avgStockValue = (beginningStockValue + endingStockValue) / 2;

  // 3. ITO = COGS / Avg Stock
  const ito = avgStockValue > 0 ? totalCogs / avgStockValue : 0;

  // 4. Moving Counts
  const summaries = getSkuSummaries(sales, soh);
  const movingCounts = {
    veryFast: summaries.filter(s => s.movingClass === 'very_fast').length,
    fast: summaries.filter(s => s.movingClass === 'fast').length,
    medium: summaries.filter(s => s.movingClass === 'medium').length,
    slow: summaries.filter(s => s.movingClass === 'slow').length,
    dead: summaries.filter(s => s.movingClass === 'dead').length,
  };

  // 5. Stock Efficiency
  const totalSkus = summaries.length;
  const overstockCount = summaries.filter(s => s.movingClass === 'dead' || s.movingClass === 'slow').length;
  const stockEfficiency = totalSkus > 0 ? ((totalSkus - overstockCount) / totalSkus) * 100 : 0;

  // 6. Calculate Per-Store Metrics (using namaToko as key for readable dropdown)
  const storeData: Omit<HistoricalSnapshot, 'id' | 'createdAt' | 'period'>['storeData'] = {};
  
  // Build kode -> nama mapping from SOH data
  const kodeToNama = new Map<string, string>();
  soh.forEach(s => kodeToNama.set(s.kodeToko, s.namaToko));
  // Fallback for sales if not in SOH
  sales.forEach(s => { if (!kodeToNama.has(s.kodeToko)) kodeToNama.set(s.kodeToko, s.namaToko || s.kodeToko); });

  // Get all unique store codes
  const storeCodes = Array.from(new Set([...sales.map(s => s.kodeToko), ...soh.map(s => s.kodeToko)]));
  
  for (const storeCode of storeCodes) {
    const storeName = kodeToNama.get(storeCode) || storeCode;
    const storeSales = sales.filter(s => s.kodeToko === storeCode);
    const storeSoh = soh.filter(s => s.kodeToko === storeCode);
    const storePrevSoh = prevSoh.filter(s => s.kodeToko === storeCode);

    const sTotalCogs = storeSales.reduce((sum, r) => sum + (r.qty * (r.hpp || 0)), 0);
    const sTotalRev = storeSales.reduce((sum, r) => sum + r.subtotal, 0);
    
    const sEndingValue = storeSoh.reduce((sum, r) => sum + (r.valueStock || 0), 0);
    const sBeginningValue = storePrevSoh.length > 0
      ? storePrevSoh.reduce((sum, r) => sum + (r.valueStock || 0), 0)
      : sEndingValue;
      
    const sAvgStock = (sBeginningValue + sEndingValue) / 2;
    const sIto = sAvgStock > 0 ? sTotalCogs / sAvgStock : 0;

    const sSummaries = getSkuSummaries(storeSales, storeSoh);
    const sMovingCounts = {
      veryFast: sSummaries.filter(s => s.movingClass === 'very_fast').length,
      fast: sSummaries.filter(s => s.movingClass === 'fast').length,
      medium: sSummaries.filter(s => s.movingClass === 'medium').length,
      slow: sSummaries.filter(s => s.movingClass === 'slow').length,
      dead: sSummaries.filter(s => s.movingClass === 'dead').length,
    };

    const sTotalSkus = sSummaries.length;
    const sOverstock = sSummaries.filter(s => s.movingClass === 'dead' || s.movingClass === 'slow').length;
    const sEfficiency = sTotalSkus > 0 ? ((sTotalSkus - sOverstock) / sTotalSkus) * 100 : 0;

    storeData[storeName] = {
      totalRevenue: sTotalRev,
      totalStockValue: sEndingValue,
      stockEfficiency: sEfficiency,
      ito: sIto,
      movingCounts: sMovingCounts,
    };
  }

  return {
    period,
    totalRevenue,
    totalStockValue: endingStockValue,
    stockEfficiency,
    ito,
    movingCounts,
    storeData,
  };
}
