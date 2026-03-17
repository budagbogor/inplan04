import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { filterByActiveStores, getOrderSettings } from '@/lib/orderSettings';
import { calculateStoreOrders } from '@/lib/storeOrders';
import { formatCurrency, formatNumber, getSOHData, getSalesData, getUploadedFiles } from '@/lib/dataStore';
import type { SalesRecord, SOHRecord } from '@/lib/types';
import { Bar, BarChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Search, PackageSearch, Store, TrendingUp, BadgeInfo } from 'lucide-react';

type MovingClass = 'very_fast' | 'fast' | 'medium' | 'slow' | 'dead';

type ProductRow = {
  kodeProduk: string;
  namaPanjang: string;
  brand: string;
  category: string;
  departement: string;
  tags: string[];
  suppliers: string[];
  skuLama: string[];
  stores: { kodeToko: string; namaToko: string; namaCabang: string }[];
  movingClass: MovingClass;
  totalQtySold: number;
  totalRevenue: number;
  totalSoh: number;
  totalStockValue: number;
  avgDailySales: number;
  avgMonthlySales: number;
};

type StoreBarDatum = {
  kodeToko: string;
  namaToko: string;
  soh: number;
  stockValue: number;
  salesQty: number;
  revenue: number;
};

type ParsedQuery = {
  raw: string;
  freeTokens: string[];
  filters: Partial<Record<'sku' | 'nama' | 'brand' | 'category' | 'supplier' | 'tag' | 'store' | 'cabang' | 'dept' | 'moving', string[]>>;
};

function norm(v: unknown): string {
  return String(v ?? '').toLowerCase().trim();
}

function tokenize(q: string): string[] {
  return q
    .trim()
    .split(/\s+/g)
    .map((t) => t.trim())
    .filter(Boolean);
}

function parseQuery(raw: string): ParsedQuery {
  const tokens = tokenize(raw);
  const filters: ParsedQuery['filters'] = {};
  const freeTokens: string[] = [];

  const normalizeKey = (k: string) => {
    const key = k.toLowerCase().trim();
    if (['sku', 'kode', 'kodeproduk', 'kode_produk', 'product', 'produk'].includes(key)) return 'sku';
    if (['nama', 'name', 'produkname'].includes(key)) return 'nama';
    if (['brand', 'merek'].includes(key)) return 'brand';
    if (['category', 'kategori', 'cat'].includes(key)) return 'category';
    if (['supplier', 'vendor'].includes(key)) return 'supplier';
    if (['tag', 'tagproduk', 'tag_produk'].includes(key)) return 'tag';
    if (['store', 'toko', 'kdtoko', 'kode_toko'].includes(key)) return 'store';
    if (['cabang', 'branch'].includes(key)) return 'cabang';
    if (['dept', 'departement', 'department'].includes(key)) return 'dept';
    if (['moving', 'mov', 'fsn', 'kelas'].includes(key)) return 'moving';
    return null;
  };

  for (const t of tokens) {
    const idx = t.indexOf(':');
    if (idx > 0) {
      const keyRaw = t.slice(0, idx);
      const valueRaw = t.slice(idx + 1);
      const key = normalizeKey(keyRaw);
      const value = valueRaw.trim();
      if (key && value) {
        if (!filters[key]) filters[key] = [];
        filters[key]!.push(value);
        continue;
      }
    }
    freeTokens.push(t);
  }

  return { raw, freeTokens, filters };
}

function isSubsequence(needle: string, hay: string): boolean {
  if (!needle) return true;
  let i = 0;
  for (let j = 0; j < hay.length && i < needle.length; j++) {
    if (needle[i] === hay[j]) i++;
  }
  return i === needle.length;
}

function scoreMatch(token: string, text: string, baseWeight: number): number {
  if (!token || !text) return 0;
  if (text === token) return baseWeight * 5;
  if (text.startsWith(token)) return baseWeight * 3;
  if (text.includes(token)) return baseWeight * 1.5;
  if (token.length >= 4 && isSubsequence(token, text)) return baseWeight * 0.8;
  return 0;
}

function movingLabel(m: MovingClass): string {
  if (m === 'very_fast') return 'Very Fast';
  if (m === 'fast') return 'Fast';
  if (m === 'medium') return 'Medium';
  if (m === 'slow') return 'Slow';
  return 'Dead';
}

function movingBadgeClass(m: MovingClass): string {
  if (m === 'very_fast') return 'bg-blue-500/10 text-blue-600 border-blue-600/30';
  if (m === 'fast') return 'bg-green-500/10 text-green-600 border-green-600/30';
  if (m === 'medium') return 'bg-yellow-500/10 text-yellow-700 border-yellow-700/30';
  if (m === 'slow') return 'bg-orange-500/10 text-orange-700 border-orange-700/30';
  return 'bg-red-500/10 text-red-600 border-red-600/30';
}

function toMovingClass(avgMonthly: number): MovingClass {
  if (avgMonthly >= 10) return 'very_fast';
  if (avgMonthly >= 4) return 'fast';
  if (avgMonthly >= 1) return 'medium';
  if (avgMonthly > 0) return 'slow';
  return 'dead';
}

export default function ProductSearchPage() {
  const [availablePeriods, setAvailablePeriods] = useState<string[]>([]);
  const [currentPeriod, setCurrentPeriod] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<SalesRecord[]>([]);
  const [soh, setSoh] = useState<SOHRecord[]>([]);

  const [query, setQuery] = useState('');
  const [selectedSku, setSelectedSku] = useState<string>('');
  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');
  const [movingFilter, setMovingFilter] = useState<string>('all');
  const [storeFilter, setStoreFilter] = useState<string>('all');

  useEffect(() => {
    getUploadedFiles().then((files) => {
      const periods = Array.from(new Set(files.map((f) => f.period))).filter(Boolean).sort().reverse();
      setAvailablePeriods(periods);
      if (periods.length > 0 && !currentPeriod) {
        setCurrentPeriod(periods[0]);
      } else if (periods.length === 0) {
        setLoading(false);
      }
    });
  }, [currentPeriod]);

  useEffect(() => {
    if (!currentPeriod && availablePeriods.length > 0) return;
    setLoading(true);
    Promise.all([getSalesData(currentPeriod), getSOHData(currentPeriod)])
      .then(([s, h]) => {
        setSales(filterByActiveStores(s));
        setSoh(filterByActiveStores(h));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [currentPeriod, availablePeriods.length]);

  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const { products, salesBySku, sohBySku, storeNameMap, brands, categories, suppliers, stores } = useMemo(() => {
    const salesMap = new Map<string, SalesRecord[]>();
    const sohMap = new Map<string, SOHRecord[]>();
    const storeMap = new Map<string, { namaToko: string; namaCabang: string }>();

    for (const s of sales) {
      if (!salesMap.has(s.kodeProduk)) salesMap.set(s.kodeProduk, []);
      salesMap.get(s.kodeProduk)!.push(s);
      if (!storeMap.has(s.kodeToko)) storeMap.set(s.kodeToko, { namaToko: s.namaToko, namaCabang: s.namaCabang });
    }
    for (const r of soh) {
      if (!sohMap.has(r.kodeProduk)) sohMap.set(r.kodeProduk, []);
      sohMap.get(r.kodeProduk)!.push(r);
      if (!storeMap.has(r.kodeToko)) storeMap.set(r.kodeToko, { namaToko: r.namaToko, namaCabang: r.namaCabang });
    }

    const allSku = new Set<string>([...salesMap.keys(), ...sohMap.keys()]);
    const allDates = new Set(sales.map((s) => s.tanggal));
    const periodDays = Math.max(allDates.size, 1);

    const rows: ProductRow[] = [];
    const brandSet = new Set<string>();
    const catSet = new Set<string>();
    const supplierSet = new Set<string>();

    for (const kodeProduk of allSku) {
      const sRows = salesMap.get(kodeProduk) ?? [];
      const hRows = sohMap.get(kodeProduk) ?? [];

      let namaPanjang = '';
      let brand = '';
      let category = '';
      let departement = '';
      const skuLamaSet = new Set<string>();
      let totalQtySold = 0;
      let totalRevenue = 0;

      for (const s of sRows) {
        namaPanjang = namaPanjang || s.namaPanjang;
        brand = brand || s.brand;
        category = category || s.category;
        departement = departement || s.departement;
        if (s.skuLama) skuLamaSet.add(String(s.skuLama).trim());
        totalQtySold += s.qty;
        totalRevenue += s.subtotal;
      }

      let totalSoh = 0;
      let totalStockValue = 0;
      const supplierCounts = new Map<string, number>();
      const tagSet = new Set<string>();
      let totalM3 = 0;
      let totalM2 = 0;
      let totalM1 = 0;
      let sohCount = 0;

      const skuStoreSet = new Set<string>();
      for (const r of hRows) {
        namaPanjang = namaPanjang || r.namaPanjang;
        brand = brand || r.brand;
        category = category || r.category;
        if (r.tagProduk) tagSet.add(String(r.tagProduk).trim());
        if (r.supplier) supplierCounts.set(r.supplier, (supplierCounts.get(r.supplier) ?? 0) + 1);
        totalSoh += r.soh;
        totalStockValue += r.valueStock;
        totalM3 += r.avgSalesM3;
        totalM2 += r.avgSalesM2;
        totalM1 += r.avgSalesM1;
        sohCount++;
        skuStoreSet.add(r.kodeToko);
      }

      for (const s of sRows) skuStoreSet.add(s.kodeToko);

      const suppliersArr = Array.from(supplierCounts.entries())
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([v]) => v)
        .filter(Boolean);
      const tagsArr = Array.from(tagSet).filter(Boolean);

      const avgMonthlyFromSoh = sohCount > 0 ? (totalM3 + totalM2 + totalM1) / 3 : 0;
      const avgMonthlyFromSales = totalQtySold > 0 ? (totalQtySold / periodDays) * 30 : 0;
      const avgMonthlySales = Math.round(((avgMonthlyFromSoh > 0 ? avgMonthlyFromSoh : avgMonthlyFromSales) * 100)) / 100;
      const avgDailySales = Math.round(((totalQtySold / periodDays) * 100)) / 100;
      const movingClass = toMovingClass(avgMonthlySales);

      const storesArr = Array.from(skuStoreSet)
        .map((kodeToko) => ({
          kodeToko,
          namaToko: storeMap.get(kodeToko)?.namaToko ?? '',
          namaCabang: storeMap.get(kodeToko)?.namaCabang ?? '',
        }))
        .sort((a, b) => a.namaToko.localeCompare(b.namaToko));

      if (brand) brandSet.add(brand);
      if (category) catSet.add(category);
      for (const s of suppliersArr) supplierSet.add(s);

      rows.push({
        kodeProduk,
        namaPanjang,
        brand,
        category,
        departement,
        tags: tagsArr,
        suppliers: suppliersArr,
        skuLama: Array.from(skuLamaSet).filter(Boolean),
        stores: storesArr,
        movingClass,
        totalQtySold,
        totalRevenue,
        totalSoh,
        totalStockValue,
        avgDailySales,
        avgMonthlySales,
      });
    }

    rows.sort((a, b) => b.totalRevenue - a.totalRevenue || b.totalQtySold - a.totalQtySold);
    const storeOptions = Array.from(storeMap.entries())
      .map(([kodeToko, v]) => ({ kodeToko, namaToko: v.namaToko, namaCabang: v.namaCabang }))
      .sort((a, b) => a.namaToko.localeCompare(b.namaToko));

    return {
      products: rows,
      salesBySku: salesMap,
      sohBySku: sohMap,
      storeNameMap: storeMap,
      brands: Array.from(brandSet).sort((a, b) => a.localeCompare(b)),
      categories: Array.from(catSet).sort((a, b) => a.localeCompare(b)),
      suppliers: Array.from(supplierSet).sort((a, b) => a.localeCompare(b)),
      stores: storeOptions,
    };
  }, [sales, soh]);

  const parsed = useMemo(() => parseQuery(query), [query]);

  const filteredProducts = useMemo(() => {
    const free = parsed.freeTokens.map(norm).filter(Boolean);
    const f = parsed.filters;

    const filterList = (arr: string[], values?: string[]) => {
      if (!values || values.length === 0) return true;
      const lower = arr.map(norm);
      return values.every((v) => lower.some((x) => x.includes(norm(v))));
    };

    const filterText = (text: string, values?: string[]) => {
      if (!values || values.length === 0) return true;
      const t = norm(text);
      return values.every((v) => t.includes(norm(v)));
    };

    const uiBrand = brandFilter !== 'all' ? [brandFilter] : undefined;
    const uiCat = categoryFilter !== 'all' ? [categoryFilter] : undefined;
    const uiSupp = supplierFilter !== 'all' ? [supplierFilter] : undefined;
    const uiMoving = movingFilter !== 'all' ? [movingFilter] : undefined;
    const uiStore = storeFilter !== 'all' ? [storeFilter] : undefined;

    const matchScore = (p: ProductRow) => {
      if (free.length === 0) return 0;

      const kode = norm(p.kodeProduk);
      const nama = norm(p.namaPanjang);
      const brand = norm(p.brand);
      const cat = norm(p.category);
      const dept = norm(p.departement);
      const suppliers = p.suppliers.map(norm);
      const tags = p.tags.map(norm);
      const stores = p.stores.flatMap((s) => [norm(s.kodeToko), norm(s.namaToko), norm(s.namaCabang)]);
      const skuLama = p.skuLama.map(norm);

      let score = 0;
      for (const t of free) {
        score += scoreMatch(t, kode, 40);
        score += scoreMatch(t, nama, 16);
        score += scoreMatch(t, brand, 12);
        score += scoreMatch(t, cat, 10);
        score += scoreMatch(t, dept, 8);
        score += skuLama.some((x) => x === t || x.includes(t)) ? 14 : 0;
        score += suppliers.some((x) => x.includes(t)) ? 10 : 0;
        score += tags.some((x) => x.includes(t)) ? 8 : 0;
        score += stores.some((x) => x.includes(t)) ? 6 : 0;
      }
      return score;
    };

    const out = products
      .filter((p) => {
        if (uiBrand && !filterText(p.brand, uiBrand)) return false;
        if (uiCat && !filterText(p.category, uiCat)) return false;
        if (uiSupp && !filterList(p.suppliers, uiSupp)) return false;
        if (uiMoving && !filterText(p.movingClass, uiMoving)) return false;
        if (uiStore && !p.stores.some((s) => norm(s.kodeToko) === norm(uiStore[0]) || norm(s.namaToko).includes(norm(uiStore[0])))) return false;

        if (!filterText(p.kodeProduk, f.sku)) return false;
        if (!filterText(p.namaPanjang, f.nama)) return false;
        if (!filterText(p.brand, f.brand)) return false;
        if (!filterText(p.category, f.category)) return false;
        if (!filterText(p.departement, f.dept)) return false;
        if (!filterList(p.suppliers, f.supplier)) return false;
        if (!filterList(p.tags, f.tag)) return false;
        if (!filterList(p.stores.map((s) => s.kodeToko), f.store) && !filterList(p.stores.map((s) => s.namaToko), f.store)) return false;
        if (!filterList(p.stores.map((s) => s.namaCabang), f.cabang)) return false;
        if (f.moving && f.moving.length > 0 && !filterText(p.movingClass, f.moving)) return false;

        if (free.length === 0) return true;

        const blob = norm(
          [
            p.kodeProduk,
            p.namaPanjang,
            p.brand,
            p.category,
            p.departement,
            p.skuLama.join(' '),
            p.suppliers.join(' '),
            p.tags.join(' '),
            p.stores.map((s) => `${s.kodeToko} ${s.namaToko} ${s.namaCabang}`).join(' '),
            p.movingClass,
          ].join(' ')
        );
        return free.every((t) => blob.includes(t) || (t.length >= 4 && isSubsequence(t, blob)));
      })
      .map((p) => ({ p, score: matchScore(p) }))
      .sort((a, b) => b.score - a.score || b.p.totalRevenue - a.p.totalRevenue || b.p.totalQtySold - a.p.totalQtySold)
      .slice(0, 250);

    return out;
  }, [products, parsed, brandFilter, categoryFilter, supplierFilter, movingFilter, storeFilter]);

  useEffect(() => {
    if (selectedSku) return;
    const top = filteredProducts[0]?.p.kodeProduk;
    if (top) setSelectedSku(top);
  }, [filteredProducts, selectedSku]);

  const selected = useMemo(() => products.find((p) => p.kodeProduk === selectedSku) ?? null, [products, selectedSku]);
  const selectedSales = useMemo(() => (selectedSku ? salesBySku.get(selectedSku) ?? [] : []), [selectedSku, salesBySku]);
  const selectedSoh = useMemo(() => (selectedSku ? sohBySku.get(selectedSku) ?? [] : []), [selectedSku, sohBySku]);

  const detail = useMemo(() => {
    const sRows = selectedSales;
    const hRows = selectedSoh;

    const txns = new Set<string>();
    const dateQty = new Map<string, { tanggal: string; qty: number; revenue: number }>();
    const storeSales = new Map<string, { kodeToko: string; namaToko: string; namaCabang: string; qty: number; revenue: number }>();

    for (const r of sRows) {
      if (r.nomorTransaksi) txns.add(r.nomorTransaksi);
      const d = dateQty.get(r.tanggal) ?? { tanggal: r.tanggal, qty: 0, revenue: 0 };
      d.qty += r.qty;
      d.revenue += r.subtotal;
      dateQty.set(r.tanggal, d);

      const st = storeSales.get(r.kodeToko) ?? {
        kodeToko: r.kodeToko,
        namaToko: r.namaToko,
        namaCabang: r.namaCabang,
        qty: 0,
        revenue: 0,
      };
      st.qty += r.qty;
      st.revenue += r.subtotal;
      storeSales.set(r.kodeToko, st);
    }

    const series = Array.from(dateQty.values()).sort((a, b) => a.tanggal.localeCompare(b.tanggal));
    const storeSalesArr = Array.from(storeSales.values()).sort((a, b) => b.revenue - a.revenue);

    const storeSoh = new Map<string, { kodeToko: string; namaToko: string; namaCabang: string; soh: number; stockValue: number; m3: number; m2: number; m1: number; sales: number; dsi: number; minStock: number; maxStock: number; avgDailySales: number; supplier: string }>();
    for (const r of hRows) {
      const st = storeSoh.get(r.kodeToko) ?? {
        kodeToko: r.kodeToko,
        namaToko: r.namaToko,
        namaCabang: r.namaCabang,
        soh: 0,
        stockValue: 0,
        m3: 0,
        m2: 0,
        m1: 0,
        sales: 0,
        dsi: 0,
        minStock: 0,
        maxStock: 0,
        avgDailySales: 0,
        supplier: '',
      };
      st.soh += r.soh;
      st.stockValue += r.valueStock;
      st.m3 += r.avgSalesM3;
      st.m2 += r.avgSalesM2;
      st.m1 += r.avgSalesM1;
      st.sales += r.sales;
      st.dsi += r.dsi;
      st.minStock += r.minStock;
      st.maxStock += r.maxStock;
      st.avgDailySales += r.avgDailySales;
      st.supplier = st.supplier || r.supplier;
      storeSoh.set(r.kodeToko, st);
    }
    const storeSohArr = Array.from(storeSoh.values()).sort((a, b) => b.stockValue - a.stockValue || b.soh - a.soh);

    const settings = getOrderSettings();
    const orderSummaries = calculateStoreOrders(hRows, settings);
    const orderItems = orderSummaries
      .flatMap((st) => st.items.map((it) => ({ ...it, kodeToko: st.kodeToko, namaToko: st.namaToko, namaCabang: st.namaCabang })))
      .sort((a, b) => {
        const pOrder: Record<'critical' | 'low' | 'normal' | 'overstock', number> = { critical: 0, low: 1, normal: 2, overstock: 3 };
        return (pOrder[a.priority] - pOrder[b.priority]) || b.suggestedQty - a.suggestedQty;
      });

    const totalAvgDemand = storeSohArr.reduce((acc, st) => acc + (st.m3 + st.m2 + st.m1 + st.sales) / 4, 0);
    const avgDailyDemand = totalAvgDemand / 30;
    const totalSohQty = storeSohArr.reduce((acc, st) => acc + st.soh, 0);
    const daysCover = avgDailyDemand > 0 ? totalSohQty / avgDailyDemand : 0;

    const storeBarData = selected
      ? selected.stores.map((s) => {
          const so = storeSoh.get(s.kodeToko);
          const sl = storeSales.get(s.kodeToko);
          return {
            kodeToko: s.kodeToko,
            namaToko: s.namaToko || storeNameMap.get(s.kodeToko)?.namaToko || s.kodeToko,
            soh: Math.round((so?.soh ?? 0) * 100) / 100,
            stockValue: Math.round((so?.stockValue ?? 0) * 100) / 100,
            salesQty: Math.round((sl?.qty ?? 0) * 100) / 100,
            revenue: Math.round((sl?.revenue ?? 0) * 100) / 100,
          };
        })
      : [];

    return {
      txCount: txns.size,
      series,
      storeSalesArr,
      storeSohArr,
      orderItems,
      avgDailyDemand: Math.round(avgDailyDemand * 100) / 100,
      avgMonthlyDemand: Math.round(totalAvgDemand * 100) / 100,
      estDaysCover: Math.round(daysCover * 10) / 10,
      storeBarData,
    };
  }, [selectedSales, selectedSoh, selected, storeNameMap]);

  const resultCountLabel = useMemo(() => {
    if (!query && brandFilter === 'all' && categoryFilter === 'all' && supplierFilter === 'all' && movingFilter === 'all' && storeFilter === 'all') {
      return `${formatNumber(products.length)} produk`;
    }
    return `${formatNumber(filteredProducts.length)} hasil`;
  }, [query, brandFilter, categoryFilter, supplierFilter, movingFilter, storeFilter, products.length, filteredProducts.length]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin" />
        <p className="text-muted-foreground animate-pulse">Menyiapkan index pencarian produk...</p>
      </div>
    );
  }

  if (!currentPeriod) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="p-4 rounded-2xl bg-accent/10 mb-4">
          <PackageSearch className="w-10 h-10 text-accent" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Belum Ada Data</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm">Upload data Sales dan SOH dulu untuk menggunakan pencarian produk.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 max-w-[1600px] mx-auto">
      <PageHeader
        title="Product Search"
        description="Pencarian produk lintas field (SKU, nama, brand, kategori, supplier, tag, toko, cabang, departement) + detail & grafik"
      >
        {availablePeriods.length > 0 && (
          <Select value={currentPeriod} onValueChange={setCurrentPeriod}>
            <SelectTrigger className="w-[140px] sm:w-[160px] bg-card h-8 text-xs border-muted-foreground/20">
              <SelectValue placeholder="Pilih Periode" />
            </SelectTrigger>
            <SelectContent>
              {availablePeriods.map((p) => {
                const [year, month] = p.split('-');
                return (
                  <SelectItem key={p} value={p}>
                    {months[parseInt(month) - 1]} {year}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        )}
      </PageHeader>

      <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cari apa saja… contoh: brio, brand:yokohama, supplier:abc, store:SBY, moving:fast"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="text-xs">
            {resultCountLabel}
          </Badge>
          {parsed.filters && Object.keys(parsed.filters).length > 0 && (
            <Badge variant="outline" className="text-xs">
              Mode filter: {Object.keys(parsed.filters).length}
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
        <Card className="shadow-card border-border/40 xl:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <BadgeInfo className="w-4 h-4 text-accent" />
              Filter Cepat
            </CardTitle>
            <CardDescription className="text-xs">Opsional. Bisa juga pakai query field:value.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select value={brandFilter} onValueChange={setBrandFilter}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Brand" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Brand</SelectItem>
                {brands.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Category</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={supplierFilter} onValueChange={setSupplierFilter}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Supplier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Supplier</SelectItem>
                {suppliers.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={movingFilter} onValueChange={setMovingFilter}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Moving Class" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Moving</SelectItem>
                <SelectItem value="very_fast">Very Fast</SelectItem>
                <SelectItem value="fast">Fast</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="slow">Slow</SelectItem>
                <SelectItem value="dead">Dead</SelectItem>
              </SelectContent>
            </Select>

            <div className="sm:col-span-2">
              <Select value={storeFilter} onValueChange={setStoreFilter}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Toko" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Toko</SelectItem>
                  {stores.map((st) => (
                    <SelectItem key={st.kodeToko} value={st.kodeToko}>
                      <span className="truncate">{st.namaToko} ({st.kodeToko})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card border-border/40 xl:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <PackageSearch className="w-4 h-4 text-accent" />
              Hasil Search
            </CardTitle>
            <CardDescription className="text-xs">Klik item untuk lihat detail lengkap + grafik.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[360px] overflow-y-auto">
              {filteredProducts.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">Tidak ada hasil untuk query ini.</div>
              ) : (
                <div className="divide-y">
                  {filteredProducts.map(({ p, score }) => {
                    const isActive = selectedSku === p.kodeProduk;
                    return (
                      <button
                        key={p.kodeProduk}
                        onClick={() => setSelectedSku(p.kodeProduk)}
                        className={cn(
                          "w-full text-left px-4 py-3 hover:bg-muted/30 transition-colors",
                          isActive && "bg-muted/40"
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs text-muted-foreground">{p.kodeProduk}</span>
                              <Badge variant="outline" className={cn("text-[10px] border", movingBadgeClass(p.movingClass))}>
                                {movingLabel(p.movingClass)}
                              </Badge>
                              {score > 0 && (
                                <span className="text-[10px] text-muted-foreground">score {Math.round(score)}</span>
                              )}
                            </div>
                            <div className="text-sm font-semibold text-foreground truncate mt-0.5">{p.namaPanjang || '-'}</div>
                            <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                              {(p.brand || '-')}{p.category ? ` • ${p.category}` : ''}{p.departement ? ` • ${p.departement}` : ''}
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="text-xs font-semibold text-foreground">{formatCurrency(p.totalRevenue)}</div>
                            <div className="text-[11px] text-muted-foreground font-mono">{formatNumber(p.totalQtySold)} unit</div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-card border-border/40">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-accent" />
            Detail Produk
          </CardTitle>
          <CardDescription className="text-xs">
            Ringkasan, metrik turunan, rekomendasi reorder per toko (jika SOH tersedia), dan grafik.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!selected ? (
            <div className="text-sm text-muted-foreground">Pilih produk dari daftar hasil.</div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm text-muted-foreground">{selected.kodeProduk}</span>
                    <Badge variant="outline" className={cn("text-[10px] border", movingBadgeClass(selected.movingClass))}>
                      {movingLabel(selected.movingClass)}
                    </Badge>
                    {selected.tags.map((t) => (
                      <Badge key={t} variant="secondary" className="text-[10px]">
                        {t}
                      </Badge>
                    ))}
                  </div>
                  <div className="text-lg font-bold text-foreground mt-1 leading-snug">{selected.namaPanjang || '-'}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {(selected.brand || '-')}{selected.category ? ` • ${selected.category}` : ''}{selected.departement ? ` • ${selected.departement}` : ''}
                  </div>
                  {selected.suppliers.length > 0 && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Supplier: <span className="font-medium text-foreground/90">{selected.suppliers.slice(0, 3).join(', ')}</span>
                      {selected.suppliers.length > 3 ? ` (+${selected.suppliers.length - 3})` : ''}
                    </div>
                  )}
                  {selected.skuLama.length > 0 && (
                    <div className="text-xs text-muted-foreground mt-1">
                      SKU Lama: <span className="font-mono">{selected.skuLama.slice(0, 3).join(', ')}</span>
                      {selected.skuLama.length > 3 ? ` (+${selected.skuLama.length - 3})` : ''}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full md:w-auto">
                  <div className="rounded-lg border bg-muted/20 px-3 py-2">
                    <div className="text-[10px] text-muted-foreground">Revenue</div>
                    <div className="text-xs font-semibold">{formatCurrency(selected.totalRevenue)}</div>
                  </div>
                  <div className="rounded-lg border bg-muted/20 px-3 py-2">
                    <div className="text-[10px] text-muted-foreground">Sales Qty</div>
                    <div className="text-xs font-semibold font-mono">{formatNumber(selected.totalQtySold)}</div>
                  </div>
                  <div className="rounded-lg border bg-muted/20 px-3 py-2">
                    <div className="text-[10px] text-muted-foreground">Avg / Hari</div>
                    <div className="text-xs font-semibold font-mono">{formatNumber(selected.avgDailySales)}</div>
                  </div>
                  <div className="rounded-lg border bg-muted/20 px-3 py-2">
                    <div className="text-[10px] text-muted-foreground">Avg / Bulan</div>
                    <div className="text-xs font-semibold font-mono">{formatNumber(selected.avgMonthlySales)}</div>
                  </div>
                  <div className="rounded-lg border bg-muted/20 px-3 py-2">
                    <div className="text-[10px] text-muted-foreground">Total SOH</div>
                    <div className="text-xs font-semibold font-mono">{formatNumber(selected.totalSoh)}</div>
                  </div>
                  <div className="rounded-lg border bg-muted/20 px-3 py-2">
                    <div className="text-[10px] text-muted-foreground">Nilai Stok</div>
                    <div className="text-xs font-semibold">{formatCurrency(selected.totalStockValue)}</div>
                  </div>
                  <div className="rounded-lg border bg-muted/20 px-3 py-2">
                    <div className="text-[10px] text-muted-foreground">Transaksi</div>
                    <div className="text-xs font-semibold font-mono">{formatNumber(detail.txCount)}</div>
                  </div>
                  <div className="rounded-lg border bg-muted/20 px-3 py-2">
                    <div className="text-[10px] text-muted-foreground">Est. Cover</div>
                    <div className="text-xs font-semibold font-mono">{detail.estDaysCover > 0 ? `${formatNumber(detail.estDaysCover)} hari` : '-'}</div>
                  </div>
                </div>
              </div>

              <Tabs defaultValue="overview">
                <TabsList className="grid grid-cols-1 sm:grid-cols-4">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="sales">Grafik Sales</TabsTrigger>
                  <TabsTrigger value="stores">Toko</TabsTrigger>
                  <TabsTrigger value="reorder">Reorder</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-3">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <Card className="border-border/40">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Formula Ringkas</CardTitle>
                        <CardDescription className="text-xs">Ringkasan metrik yang dipakai/diturunkan.</CardDescription>
                      </CardHeader>
                      <CardContent className="text-xs text-muted-foreground space-y-2">
                        <div>
                          <span className="font-semibold text-foreground">Moving Class</span>{' '}
                          berdasarkan <span className="font-mono">Avg / Bulan</span> dengan batas: 10+, 4–10, 1–4, 0–1, 0.
                        </div>
                        <div>
                          <span className="font-semibold text-foreground">Avg / Bulan</span>{' '}
                          pakai data SOH (M3+M2+M1)/3 jika tersedia, kalau tidak fallback dari Sales periode: (TotalQty / jumlahHari) * 30.
                        </div>
                        <div>
                          <span className="font-semibold text-foreground">Est. Cover (hari)</span>{' '}
                          = Total SOH / AvgDailyDemand, dengan AvgDailyDemand = (Σ((M3+M2+M1+Sales)/4)) / 30.
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-border/40">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Top Toko (Revenue)</CardTitle>
                        <CardDescription className="text-xs">Dari data Sales periode terpilih.</CardDescription>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/50">
                                <TableHead className="text-[10px]">Toko</TableHead>
                                <TableHead className="text-right text-[10px]">Revenue</TableHead>
                                <TableHead className="text-right text-[10px]">Qty</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {detail.storeSalesArr.slice(0, 8).map((st) => (
                                <TableRow key={st.kodeToko}>
                                  <TableCell className="text-xs">
                                    <div className="font-medium truncate max-w-[220px]">{st.namaToko}</div>
                                    <div className="text-[10px] text-muted-foreground font-mono">{st.kodeToko} • {st.namaCabang}</div>
                                  </TableCell>
                                  <TableCell className="text-right text-xs font-mono">{formatCurrency(st.revenue)}</TableCell>
                                  <TableCell className="text-right text-xs font-mono">{formatNumber(st.qty)}</TableCell>
                                </TableRow>
                              ))}
                              {detail.storeSalesArr.length === 0 && (
                                <TableRow>
                                  <TableCell colSpan={3} className="text-xs text-muted-foreground">
                                    Tidak ada sales untuk periode ini.
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="sales" className="mt-3">
                  <Card className="border-border/40">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Tren Harian Sales & Revenue</CardTitle>
                      <CardDescription className="text-xs">Sumber: file Sales periode terpilih.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="w-full h-[320px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={detail.series} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                            <XAxis dataKey="tanggal" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                            <YAxis yAxisId="left" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                            <Tooltip
                              content={({ active, payload, label }) => {
                                if (!active || !payload?.length) return null;
                                const qty = payload.find((p) => p.dataKey === 'qty')?.value as number | undefined;
                                const rev = payload.find((p) => p.dataKey === 'revenue')?.value as number | undefined;
                                return (
                                  <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-xl">
                                    <div className="font-semibold text-foreground">{label}</div>
                                    <div className="mt-2 space-y-1">
                                      <div>Qty: <span className="font-mono font-semibold">{formatNumber(qty ?? 0)}</span></div>
                                      <div>Revenue: <span className="font-mono font-semibold">{formatCurrency(rev ?? 0)}</span></div>
                                    </div>
                                  </div>
                                );
                              }}
                            />
                            <Bar yAxisId="left" dataKey="qty" name="Qty" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                            <Line yAxisId="right" type="monotone" dataKey="revenue" name="Revenue" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      {detail.series.length === 0 && (
                        <div className="text-xs text-muted-foreground mt-3">Tidak ada data sales harian.</div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="stores" className="mt-3">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <Card className="border-border/40">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Store className="w-4 h-4 text-accent" />
                          Distribusi SOH & Sales per Toko
                        </CardTitle>
                        <CardDescription className="text-xs">Sumber: SOH + Sales periode terpilih.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="w-full h-[320px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={detail.storeBarData} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
                              <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                              <XAxis dataKey="kodeToko" tick={{ fontSize: 10 }} className="fill-muted-foreground" angle={-30} textAnchor="end" interval={0} height={60} />
                              <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                              <Tooltip
                                content={({ active, payload }) => {
                                  if (!active || !payload?.length) return null;
                                  const d = payload[0]?.payload as StoreBarDatum | undefined;
                                  return (
                                    <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-xl">
                                      <div className="font-semibold text-foreground">{d?.namaToko}</div>
                                      <div className="text-[10px] text-muted-foreground font-mono">{d?.kodeToko}</div>
                                      <div className="mt-2 space-y-1">
                                        <div>SOH: <span className="font-mono font-semibold">{formatNumber(d?.soh ?? 0)}</span></div>
                                        <div>Sales Qty: <span className="font-mono font-semibold">{formatNumber(d?.salesQty ?? 0)}</span></div>
                                        <div>Stock Value: <span className="font-mono font-semibold">{formatCurrency(d?.stockValue ?? 0)}</span></div>
                                        <div>Revenue: <span className="font-mono font-semibold">{formatCurrency(d?.revenue ?? 0)}</span></div>
                                      </div>
                                    </div>
                                  );
                                }}
                              />
                              <Bar dataKey="soh" name="SOH" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="salesQty" name="Sales Qty" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-border/40">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Detail SOH per Toko</CardTitle>
                        <CardDescription className="text-xs">Menampilkan kolom penting SOH (jika tersedia).</CardDescription>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="overflow-x-auto max-h-[360px]">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/50">
                                <TableHead className="text-[10px]">Toko</TableHead>
                                <TableHead className="text-right text-[10px]">SOH</TableHead>
                                <TableHead className="text-right text-[10px]">DSI</TableHead>
                                <TableHead className="text-right text-[10px]">Min</TableHead>
                                <TableHead className="text-right text-[10px]">Max</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {detail.storeSohArr.map((st) => (
                                <TableRow key={st.kodeToko}>
                                  <TableCell className="text-xs">
                                    <div className="font-medium truncate max-w-[220px]">{st.namaToko}</div>
                                    <div className="text-[10px] text-muted-foreground font-mono">{st.kodeToko} • {st.namaCabang}</div>
                                    {st.supplier && (
                                      <div className="text-[10px] text-muted-foreground truncate">Supplier: {st.supplier}</div>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right text-xs font-mono">{formatNumber(st.soh)}</TableCell>
                                  <TableCell className="text-right text-xs font-mono">{formatNumber(Math.round(st.dsi * 10) / 10)}</TableCell>
                                  <TableCell className="text-right text-xs font-mono">{formatNumber(Math.round(st.minStock))}</TableCell>
                                  <TableCell className="text-right text-xs font-mono">{formatNumber(Math.round(st.maxStock))}</TableCell>
                                </TableRow>
                              ))}
                              {detail.storeSohArr.length === 0 && (
                                <TableRow>
                                  <TableCell colSpan={5} className="text-xs text-muted-foreground">
                                    Tidak ada data SOH untuk produk ini.
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="reorder" className="mt-3">
                  <Card className="border-border/40">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Reorder Suggestion per Toko</CardTitle>
                      <CardDescription className="text-xs">
                        Menggunakan formulasi yang sama seperti modul Suggest Order: AvgDemand=(M3+M2+M1+Sales)/4, SafetyStock, ROP, Order-up-to, MOQ.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto max-h-[420px]">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/50">
                              <TableHead className="text-[10px]">Toko</TableHead>
                              <TableHead className="text-right text-[10px]">SOH</TableHead>
                              <TableHead className="text-right text-[10px]">Avg/Hari</TableHead>
                              <TableHead className="text-right text-[10px]">LT</TableHead>
                              <TableHead className="text-right text-[10px]">SS</TableHead>
                              <TableHead className="text-right text-[10px]">ROP</TableHead>
                              <TableHead className="text-right text-[10px]">Max</TableHead>
                              <TableHead className="text-right text-[10px] font-bold">Suggest</TableHead>
                              <TableHead className="text-center text-[10px]">Prioritas</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {detail.orderItems.map((it) => (
                              <TableRow key={`${it.kodeToko}__${it.kodeProduk}`}>
                                <TableCell className="text-xs">
                                  <div className="font-medium truncate max-w-[220px]">{it.namaToko}</div>
                                  <div className="text-[10px] text-muted-foreground font-mono">{it.kodeToko} • {it.namaCabang}</div>
                                </TableCell>
                                <TableCell className="text-right text-xs font-mono">{formatNumber(it.soh)}</TableCell>
                                <TableCell className="text-right text-xs font-mono">{formatNumber(it.avgDailyDemand)}</TableCell>
                                <TableCell className="text-right text-xs font-mono">{formatNumber(it.leadTimeDays)}</TableCell>
                                <TableCell className="text-right text-xs font-mono">{formatNumber(it.safetyStock)}</TableCell>
                                <TableCell className="text-right text-xs font-mono">{formatNumber(it.rop)}</TableCell>
                                <TableCell className="text-right text-xs font-mono">{formatNumber(it.maxStock)}</TableCell>
                                <TableCell className="text-right text-xs font-mono font-bold text-primary">{formatNumber(it.suggestedQty)}</TableCell>
                                <TableCell className="text-center">
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "text-[10px]",
                                      it.priority === 'critical' && "bg-destructive/10 text-destructive border-destructive/30",
                                      it.priority === 'low' && "bg-warning/10 text-warning border-warning/30",
                                      it.priority === 'normal' && "bg-info/10 text-info border-info/30",
                                      it.priority === 'overstock' && "bg-muted text-muted-foreground border-border/50"
                                    )}
                                  >
                                    {it.priority}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                            {detail.orderItems.length === 0 && (
                              <TableRow>
                                <TableCell colSpan={9} className="text-xs text-muted-foreground">
                                  Tidak ada rekomendasi reorder (butuh data SOH untuk SKU ini).
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
