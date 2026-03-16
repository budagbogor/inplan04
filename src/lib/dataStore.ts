import * as XLSX from 'xlsx';
import { parse, format, isValid } from 'date-fns';
import { openDB, type IDBPDatabase } from 'idb';
import type { SalesRecord, SOHRecord, UploadedFile } from './types';

const DB_NAME = 'mobeng_db';
const DB_VERSION = 1;
const SALES_STORE = 'sales';
const SOH_STORE = 'soh';
const FILES_STORE = 'files';

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(SALES_STORE)) db.createObjectStore(SALES_STORE);
        if (!db.objectStoreNames.contains(SOH_STORE)) db.createObjectStore(SOH_STORE);
        if (!db.objectStoreNames.contains(FILES_STORE)) db.createObjectStore(FILES_STORE);
      },
    });
  }
  return dbPromise;
}

type HeaderAliasMap<T extends string> = Record<T, string[]>;

const SALES_COLUMN_ALIASES: HeaderAliasMap<keyof SalesRecord> = {
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

const SOH_COLUMN_ALIASES: HeaderAliasMap<keyof SOHRecord> = {
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
    .replace(/[_\-]+/g, ' ')
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
    const idx = headers.findIndex((header) => header.startsWith(name));
    if (idx !== -1) return idx;
  }

  // 3) Header contains alias (one-way only to avoid false positives)
  for (const name of normalizedNames) {
    const idx = headers.findIndex((header) => header.includes(name));
    if (idx !== -1) return idx;
  }

  return -1;
}

function detectHeaderRowIndex<T extends string>(rows: unknown[][], aliasMap: HeaderAliasMap<T>): number {
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

    console.log(`[Header Scan] Row ${i}: matched ${score}/${aliasGroups.length} columns, headers:`, nonEmptyHeaders.slice(0, 8));

    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  console.log(`[Header Scan] Best row: ${bestIndex} with score ${bestScore}/${aliasGroups.length} (min: ${minimumMatches})`);
  return bestScore >= minimumMatches ? bestIndex : -1;
}

function getColumnIndexes<T extends string>(headers: string[], aliasMap: HeaderAliasMap<T>): Record<T, number> {
  const indexes = {} as Record<T, number>;

  for (const key of Object.keys(aliasMap) as T[]) {
    indexes[key] = findColumnIndex(headers, aliasMap[key]);
  }

  return indexes;
}

function getSheetRows(sheet: XLSX.WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: true,
  });
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
export function parseSalesExcel(file: File): Promise<SalesRecord[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
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
          }))
          .filter((record) => record.kodeProduk && record.qty > 0);

        resolve(records);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// Parse SOH Excel - robust header matching
export function parseSOHExcel(file: File): Promise<SOHRecord[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
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
          }))
          .filter((record) => record.kodeProduk);

        resolve(records);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
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

// In-memory cache + IndexedDB persistence
let salesCache: SalesRecord[] | null = null;
let sohJktCache: SOHRecord[] | null = null;
let sbySohCache: SOHRecord[] | null = null;
let filesCache: UploadedFile[] | null = null;

export async function saveSalesData(records: SalesRecord[]) {
  salesCache = records;
  const db = await getDB();
  await db.put(SALES_STORE, records, 'data');
}

export async function getSalesData(): Promise<SalesRecord[]> {
  if (salesCache) return salesCache;
  const db = await getDB();
  const data = await db.get(SALES_STORE, 'data');
  salesCache = data || [];
  return salesCache!;
}

export async function saveSOHDataByRegion(records: SOHRecord[], region: 'jkt' | 'sby') {
  const key = `data-${region}`;
  if (region === 'jkt') sohJktCache = records;
  else sbySohCache = records;
  const db = await getDB();
  await db.put(SOH_STORE, records, key);
}

/** @deprecated Use saveSOHDataByRegion instead */
export async function saveSOHData(records: SOHRecord[]) {
  await saveSOHDataByRegion(records, 'jkt');
}

export async function getSOHDataByRegion(region: 'jkt' | 'sby'): Promise<SOHRecord[]> {
  const cache = region === 'jkt' ? sohJktCache : sbySohCache;
  if (cache) return cache;
  const db = await getDB();
  const data = await db.get(SOH_STORE, `data-${region}`);
  const result = data || [];
  if (region === 'jkt') sohJktCache = result;
  else sbySohCache = result;
  return result;
}

/** Returns merged SOH data from both JKT and SBY */
export async function getSOHData(): Promise<SOHRecord[]> {
  const [jkt, sby] = await Promise.all([
    getSOHDataByRegion('jkt'),
    getSOHDataByRegion('sby'),
  ]);
  return [...jkt, ...sby];
}

export async function saveUploadedFiles(files: UploadedFile[]) {
  filesCache = files;
  const db = await getDB();
  await db.put(FILES_STORE, files, 'data');
}

export async function getUploadedFiles(): Promise<UploadedFile[]> {
  if (filesCache) return filesCache;
  const db = await getDB();
  const data = await db.get(FILES_STORE, 'data');
  filesCache = data || [];
  return filesCache!;
}

export async function clearDataByType(type: 'sales' | 'soh-jkt' | 'soh-sby') {
  if (type === 'sales') {
    salesCache = [];
    const db = await getDB();
    await db.put(SALES_STORE, [], 'data');
  } else if (type === 'soh-jkt') {
    sohJktCache = [];
    const db = await getDB();
    await db.put(SOH_STORE, [], 'data-jkt');
  } else {
    sbySohCache = [];
    const db = await getDB();
    await db.put(SOH_STORE, [], 'data-sby');
  }
  
  const files = (await getUploadedFiles()).filter(f => f.type !== type);
  await saveUploadedFiles(files);
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

  for (const s of sales) {
    if (!map.has(s.kodeProduk)) {
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
        movingClass: 'dead',
        stores: new Set(),
      });
    }
    const entry = map.get(s.kodeProduk)!;
    entry.totalQtySold += s.qty;
    entry.totalRevenue += s.subtotal;
    entry.stores.add(s.kodeToko);
  }

  return Array.from(map.values()).map(e => {
    const sohEntry = sohMap.get(e.kodeProduk);
    const avgMonthly = sohEntry
      ? Math.round(((sohEntry.totalM3 + sohEntry.totalM2 + sohEntry.totalM1) / 3) * 100) / 100
      : Math.round((e.totalQtySold / periodDays * 30) * 100) / 100;

    // Classification based on monthly avg movement
    let movingClass: 'fast' | 'medium' | 'slow' | 'dead' = 'dead';
    if (avgMonthly >= 30) movingClass = 'fast';
    else if (avgMonthly >= 10) movingClass = 'medium';
    else if (avgMonthly > 0) movingClass = 'slow';

    return {
      ...e,
      avgDailySales: Math.round((e.totalQtySold / periodDays) * 100) / 100,
      avgMonthlySales: avgMonthly,
      storeCount: e.stores.size,
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
