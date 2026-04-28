import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, ChevronDown, ChevronUp, Package } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { getSalesData, getSOHData, formatCurrency, formatNumber } from '@/lib/dataStore';
import { filterByActiveStores } from '@/lib/orderSettings';
import type { SalesRecord, SOHRecord } from '@/lib/types';

interface AbcItem {
  kodeProduk: string;
  namaPanjang: string;
  brand: string;
  category: string;
  soh: number;
  hpp: number;
  totalHppValue: number; // soh * hpp
  cumulativePercent: number;
  abcClass: 'A' | 'B' | 'C';
}

interface StoreAbc {
  kodeToko: string;
  namaToko: string;
  namaCabang: string;
  items: AbcItem[];
  countA: number;
  countB: number;
  countC: number;
  valueA: number;
  valueB: number;
  valueC: number;
  totalValue: number;
}

function classifyAbc(soh: SOHRecord[], sales: SalesRecord[]): StoreAbc[] {
  // Build HPP map from sales: kodeProduk -> avg HPP
  const hppMap = new Map<string, { total: number; count: number }>();
  for (const s of sales) {
    if (s.hpp <= 0) continue;
    if (!hppMap.has(s.kodeProduk)) hppMap.set(s.kodeProduk, { total: 0, count: 0 });
    const e = hppMap.get(s.kodeProduk)!;
    e.total += s.hpp;
    e.count++;
  }

  // Group SOH by store
  const storeMap = new Map<string, SOHRecord[]>();
  for (const r of soh) {
    if (!storeMap.has(r.kodeToko)) storeMap.set(r.kodeToko, []);
    storeMap.get(r.kodeToko)!.push(r);
  }

  const results: StoreAbc[] = [];

  for (const [kodeToko, records] of storeMap) {
    const first = records[0];

    const skuMap = new Map<string, { kodeProduk: string; namaPanjang: string; brand: string; category: string; soh: number }>();
    for (const r of records) {
      const key = String(r.kodeProduk ?? '').trim();
      if (!key) continue;
      const existing = skuMap.get(key);
      if (!existing) {
        skuMap.set(key, {
          kodeProduk: key,
          namaPanjang: r.namaPanjang,
          brand: r.brand,
          category: r.category,
          soh: r.soh,
        });
      } else {
        existing.soh += r.soh;
        if (!existing.namaPanjang && r.namaPanjang) existing.namaPanjang = r.namaPanjang;
        if (!existing.brand && r.brand) existing.brand = r.brand;
        if (!existing.category && r.category) existing.category = r.category;
      }
    }

    // Calculate total HPP value per unique SKU in this store
    const items: AbcItem[] = Array.from(skuMap.values())
      .map((r) => {
        const hppEntry = hppMap.get(r.kodeProduk);
        const hpp = hppEntry ? Math.round(hppEntry.total / hppEntry.count) : 0;
        const totalHppValue = r.soh * hpp;
        return {
          kodeProduk: r.kodeProduk,
          namaPanjang: r.namaPanjang,
          brand: r.brand,
          category: r.category,
          soh: r.soh,
          hpp,
          totalHppValue,
          cumulativePercent: 0,
          abcClass: 'C' as const,
        };
      })
      .filter(i => i.totalHppValue > 0)
      .sort((a, b) => b.totalHppValue - a.totalHppValue);

    // Calculate cumulative percentage and classify
    const totalValue = items.reduce((s, i) => s + i.totalHppValue, 0);
    if (totalValue <= 0) continue;

    let cumulative = 0;
    for (const item of items) {
      cumulative += item.totalHppValue;
      item.cumulativePercent = (cumulative / totalValue) * 100;
      if (item.cumulativePercent <= 80) item.abcClass = 'A';
      else if (item.cumulativePercent <= 95) item.abcClass = 'B';
      else item.abcClass = 'C';
    }

    const countA = items.filter(i => i.abcClass === 'A').length;
    const countB = items.filter(i => i.abcClass === 'B').length;
    const countC = items.filter(i => i.abcClass === 'C').length;
    const valueA = items.filter(i => i.abcClass === 'A').reduce((s, i) => s + i.totalHppValue, 0);
    const valueB = items.filter(i => i.abcClass === 'B').reduce((s, i) => s + i.totalHppValue, 0);
    const valueC = items.filter(i => i.abcClass === 'C').reduce((s, i) => s + i.totalHppValue, 0);

    results.push({
      kodeToko,
      namaToko: first.namaToko,
      namaCabang: first.namaCabang,
      items,
      countA, countB, countC,
      valueA, valueB, valueC,
      totalValue,
    });
  }

  results.sort((a, b) => b.totalValue - a.totalValue);
  return results;
}

const abcColors = {
  A: 'bg-destructive/10 text-destructive border-destructive/30',
  B: 'bg-warning/10 text-warning border-warning/30',
  C: 'bg-info/10 text-info border-info/30',
};

export default function InventoryPage() {
  const [sales, setSales] = useState<SalesRecord[]>([]);
  const [soh, setSoh] = useState<SOHRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getSalesData(), getSOHData()]).then(([s, h]) => {
      setSales(filterByActiveStores(s)); setSoh(filterByActiveStores(h)); setLoading(false);
    });
  }, []);

  const storeAbcData = useMemo(() => classifyAbc(soh, sales), [soh, sales]);

  const [search, setSearch] = useState('');
  const [expandedStore, setExpandedStore] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!search) return storeAbcData;
    const q = search.toLowerCase();
    return storeAbcData.filter(s =>
      s.namaToko.toLowerCase().includes(q) ||
      s.kodeToko.toLowerCase().includes(q)
    );
  }, [storeAbcData, search]);

  // Global totals
  const totals = useMemo(() => {
    let countA = 0, countB = 0, countC = 0;
    let valueA = 0, valueB = 0, valueC = 0;
    
    storeAbcData.forEach(st => {
      countA += st.countA;
      countB += st.countB;
      countC += st.countC;
      valueA += st.valueA;
      valueB += st.valueB;
      valueC += st.valueC;
    });
    
    return { countA, countB, countC, valueA, valueB, valueC };
  }, [storeAbcData]);

  const nationalTotals = useMemo(() => {
    const skuMap = new Map<string, { kodeProduk: string; namaPanjang: string; brand: string; category: string; totalHppValue: number }>();

    for (const st of storeAbcData) {
      for (const it of st.items) {
        const key = String(it.kodeProduk ?? '').trim();
        if (!key) continue;
        const existing = skuMap.get(key);
        if (!existing) {
          skuMap.set(key, {
            kodeProduk: key,
            namaPanjang: it.namaPanjang,
            brand: it.brand,
            category: it.category,
            totalHppValue: it.totalHppValue,
          });
        } else {
          existing.totalHppValue += it.totalHppValue;
          if (!existing.namaPanjang && it.namaPanjang) existing.namaPanjang = it.namaPanjang;
          if (!existing.brand && it.brand) existing.brand = it.brand;
          if (!existing.category && it.category) existing.category = it.category;
        }
      }
    }

    const items = Array.from(skuMap.values()).filter((i) => i.totalHppValue > 0).sort((a, b) => b.totalHppValue - a.totalHppValue);
    const totalValue = items.reduce((s, i) => s + i.totalHppValue, 0);
    if (totalValue <= 0) return { countA: 0, countB: 0, countC: 0, valueA: 0, valueB: 0, valueC: 0 };

    let cumulative = 0;
    let countA = 0, countB = 0, countC = 0;
    let valueA = 0, valueB = 0, valueC = 0;

    for (const item of items) {
      cumulative += item.totalHppValue;
      const cumulativePercent = (cumulative / totalValue) * 100;
      if (cumulativePercent <= 80) {
        countA += 1;
        valueA += item.totalHppValue;
      } else if (cumulativePercent <= 95) {
        countB += 1;
        valueB += item.totalHppValue;
      } else {
        countC += 1;
        valueC += item.totalHppValue;
      }
    }

    return { countA, countB, countC, valueA, valueB, valueC };
  }, [storeAbcData]);

  if (loading) return <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground text-sm">Memuat data...</div>;

  if (storeAbcData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="p-4 rounded-2xl bg-accent/10 mb-4">
          <Package className="w-10 h-10 text-accent" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Belum Ada Data</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm">Upload data SOH dan Sales untuk melihat klasifikasi ABC per toko</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader title="Klasifikasi ABC" description="Klasifikasi ABC berdasarkan nilai HPP per toko" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <StatCard 
          title="Total Kelas A" 
          value={`${formatNumber(totals.countA)} SKU-per-toko`} 
          subtitle={
            <div className="space-y-0.5">
              <div>HPP (SKU-per-toko): {formatCurrency(totals.valueA)}</div>
              <div>Unik nasional: {formatNumber(nationalTotals.countA)} SKU • HPP: {formatCurrency(nationalTotals.valueA)}</div>
            </div>
          }
          icon={Package} 
          variant="destructive" 
        />
        <StatCard 
          title="Total Kelas B" 
          value={`${formatNumber(totals.countB)} SKU-per-toko`} 
          subtitle={
            <div className="space-y-0.5">
              <div>HPP (SKU-per-toko): {formatCurrency(totals.valueB)}</div>
              <div>Unik nasional: {formatNumber(nationalTotals.countB)} SKU • HPP: {formatCurrency(nationalTotals.valueB)}</div>
            </div>
          }
          icon={Package} 
          variant="warning" 
        />
        <StatCard 
          title="Total Kelas C" 
          value={`${formatNumber(totals.countC)} SKU-per-toko`} 
          subtitle={
            <div className="space-y-0.5">
              <div>HPP (SKU-per-toko): {formatCurrency(totals.valueC)}</div>
              <div>Unik nasional: {formatNumber(nationalTotals.countC)} SKU • HPP: {formatCurrency(nationalTotals.valueC)}</div>
            </div>
          }
          icon={Package} 
          variant="accent" 
        />
      </div>
      
      <div className="rounded-xl border bg-muted/20 p-3 text-[10px] sm:text-xs text-muted-foreground leading-relaxed">
        <span className="font-semibold text-foreground">Catatan:</span> “SKU-per-toko” menghitung kombinasi (toko, SKU) sehingga SKU yang sama bisa muncul di banyak toko. “Unik nasional” menghitung kodeProduk unik secara nasional (satu SKU hanya dihitung sekali) dan kelas ABC dihitung dari akumulasi nilai HPP semua toko.
      </div>

      <div className="relative max-w-full sm:max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Cari toko..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="space-y-3">
        {filtered.map((store, i) => {
          const isExpanded = expandedStore === store.kodeToko;
          return (
            <motion.div
              key={store.kodeToko}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.02, 0.3) }}
              className="bg-card rounded-xl border shadow-card overflow-hidden"
            >
              <button
                onClick={() => setExpandedStore(isExpanded ? null : store.kodeToko)}
                className="w-full flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 hover:bg-muted/30 transition-colors text-left gap-2 sm:gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-accent/10 text-accent shrink-0">
                    <Package className="w-4 sm:w-5 h-4 sm:h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs sm:text-sm font-semibold text-foreground truncate">{store.namaToko}</h3>
                    <p className="text-[10px] text-muted-foreground font-mono">{store.kodeToko} • {store.namaCabang}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 sm:gap-5 shrink-0 pl-11 sm:pl-0">
                  {/* Class A */}
                  <div className="text-left sm:text-right">
                    <p className="text-[10px] text-muted-foreground">A</p>
                    <p className="text-xs font-bold font-mono text-destructive">{store.countA} SKU</p>
                    <p className="text-[10px] font-mono text-muted-foreground">{formatCurrency(store.valueA)}</p>
                  </div>
                  {/* Class B */}
                  <div className="text-left sm:text-right">
                    <p className="text-[10px] text-muted-foreground">B</p>
                    <p className="text-xs font-bold font-mono text-warning">{store.countB} SKU</p>
                    <p className="text-[10px] font-mono text-muted-foreground">{formatCurrency(store.valueB)}</p>
                  </div>
                  {/* Class C */}
                  <div className="text-left sm:text-right">
                    <p className="text-[10px] text-muted-foreground">C</p>
                    <p className="text-xs font-bold font-mono text-info">{store.countC} SKU</p>
                    <p className="text-[10px] font-mono text-muted-foreground">{formatCurrency(store.valueC)}</p>
                  </div>

                  {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
              </button>

              {isExpanded && (
                <div className="border-t overflow-x-auto">
                  <table className="w-full text-sm min-w-[600px]">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="text-left px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Kelas</th>
                        <th className="text-left px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Produk</th>
                        <th className="text-right px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">SOH</th>
                        <th className="text-right px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">HPP</th>
                        <th className="text-right px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Nilai HPP</th>
                        <th className="text-right px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Kum %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {store.items.map((item) => (
                        <tr key={item.kodeProduk} className="border-t hover:bg-muted/20 transition-colors">
                          <td className="px-3 py-2">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${abcColors[item.abcClass]}`}>
                              {item.abcClass}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <p className="font-medium text-foreground text-xs truncate max-w-[200px]">{item.namaPanjang}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{item.kodeProduk} • {item.brand}</p>
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs">{formatNumber(item.soh)}</td>
                          <td className="px-3 py-2 text-right font-mono text-xs">{formatCurrency(item.hpp)}</td>
                          <td className="px-3 py-2 text-right font-mono text-xs font-medium">{formatCurrency(item.totalHppValue)}</td>
                          <td className="px-3 py-2 text-right font-mono text-xs">{item.cumulativePercent.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
