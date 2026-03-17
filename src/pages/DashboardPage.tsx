import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Package, TrendingUp, DollarSign, BarChart3, Boxes, Tags, CheckCircle, Warehouse } from 'lucide-react';
import { StatCard } from '@/components/StatCard';
import { PageHeader } from '@/components/PageHeader';
import { getSalesData, getSOHData, getSkuSummaries, formatCurrency, formatNumber, getUploadedFiles } from '@/lib/dataStore';
import { filterByActiveStores } from '@/lib/orderSettings';
import { useNavigate } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { SalesRecord, SOHRecord } from '@/lib/types';
import { DemandVsStockChart } from '@/components/DemandVsStockChart';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export default function DashboardPage() {
  const [sales, setSales] = useState<SalesRecord[]>([]);
  const [soh, setSoh] = useState<SOHRecord[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>('all');
  const [selectedVariantStore, setSelectedVariantStore] = useState<string>('all');
  const [variantMetric, setVariantMetric] = useState<'qty' | 'revenue'>('qty');
  const [selectedVariant, setSelectedVariant] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [availablePeriods, setAvailablePeriods] = useState<string[]>([]);
  const [currentPeriod, setCurrentPeriod] = useState<string>('');
  const navigate = useNavigate();

  useEffect(() => {
    // Load available periods first
    getUploadedFiles().then(files => {
      const periods = Array.from(new Set(files.map(f => f.period))).filter(Boolean).sort().reverse();
      setAvailablePeriods(periods);
      if (periods.length > 0 && !currentPeriod) {
        setCurrentPeriod(periods[0]);
      } else if (periods.length === 0) {
        setLoading(false);
      }
    });
  }, [currentPeriod]);

  useEffect(() => {
    if (!currentPeriod && availablePeriods.length > 0) return; // Wait for initial period setting
    
    setLoading(true);
    Promise.all([getSalesData(currentPeriod), getSOHData(currentPeriod)]).then(([s, h]) => {
      setSales(filterByActiveStores(s)); 
      setSoh(filterByActiveStores(h)); 
      setLoading(false);
    });
  }, [currentPeriod, availablePeriods.length]);

  const skuSummaries = useMemo(() => getSkuSummaries(sales, soh), [sales, soh]);

  const totalRevenue = sales.reduce((sum, s) => sum + s.subtotal, 0);
  const totalItems = sales.reduce((sum, s) => sum + s.qty, 0);
  const uniqueTransactions = new Set(sales.map(s => s.nomorTransaksi)).size;
  const uniqueStores = new Set(sales.map(s => s.kodeToko)).size;

  const totalInventoryValue = useMemo(() => soh.reduce((sum, r) => sum + r.valueStock, 0), [soh]);
  const totalUniqueSku = useMemo(() => new Set(soh.map(r => r.kodeProduk)).size, [soh]);
  const totalActiveSku = useMemo(() => {
    const activeSkus = new Set<string>();
    for (const r of soh) {
      if (r.soh > 0) activeSkus.add(r.kodeProduk);
    }
    return activeSkus.size;
  }, [soh]);
  const storeList = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of soh) map.set(r.kodeToko, r.namaToko);
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [soh]);
  const salesStoreList = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of sales) map.set(s.kodeToko, s.namaToko);
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [sales]);

  const variantSohBySku = useMemo(() => {
    const filtered = selectedVariantStore === 'all' ? soh : soh.filter(r => r.kodeToko === selectedVariantStore);
    const map = new Map<string, { soh: number; stockValue: number; suppliers: Set<string>; tags: Set<string> }>();
    for (const r of filtered) {
      if (!map.has(r.kodeProduk)) map.set(r.kodeProduk, { soh: 0, stockValue: 0, suppliers: new Set(), tags: new Set() });
      const e = map.get(r.kodeProduk)!;
      e.soh += r.soh;
      e.stockValue += r.valueStock;
      if (r.supplier) e.suppliers.add(r.supplier);
      if (r.tagProduk) e.tags.add(r.tagProduk);
    }
    return map;
  }, [soh, selectedVariantStore]);

  const topVariants = useMemo(() => {
    const filteredSales = selectedVariantStore === 'all' ? sales : sales.filter(s => s.kodeToko === selectedVariantStore);
    const variantMap = new Map<string, {
      variant: string;
      qty: number;
      revenue: number;
      txns: Set<string>;
      skus: Set<string>;
      brands: Set<string>;
      categories: Set<string>;
      depts: Set<string>;
      stores: Set<string>;
      skuAgg: Map<string, { kodeProduk: string; namaPanjang: string; brand: string; category: string; departement: string; qty: number; revenue: number; txns: Set<string> }>;
      storeAgg: Map<string, { kodeToko: string; namaToko: string; namaCabang: string; qty: number; revenue: number; txns: Set<string> }>;
    }>();

    for (const s of filteredSales) {
      const raw = (s.jenis || '').trim();
      const variant = raw || 'Tanpa Varian';
      if (!variantMap.has(variant)) {
        variantMap.set(variant, {
          variant,
          qty: 0,
          revenue: 0,
          txns: new Set(),
          skus: new Set(),
          brands: new Set(),
          categories: new Set(),
          depts: new Set(),
          stores: new Set(),
          skuAgg: new Map(),
          storeAgg: new Map(),
        });
      }
      const v = variantMap.get(variant)!;
      v.qty += s.qty;
      v.revenue += s.subtotal;
      if (s.nomorTransaksi) v.txns.add(s.nomorTransaksi);
      if (s.kodeProduk) v.skus.add(s.kodeProduk);
      if (s.brand) v.brands.add(s.brand);
      if (s.category) v.categories.add(s.category);
      if (s.departement) v.depts.add(s.departement);
      if (s.kodeToko) v.stores.add(s.kodeToko);

      if (!v.skuAgg.has(s.kodeProduk)) {
        v.skuAgg.set(s.kodeProduk, {
          kodeProduk: s.kodeProduk,
          namaPanjang: s.namaPanjang,
          brand: s.brand,
          category: s.category,
          departement: s.departement,
          qty: 0,
          revenue: 0,
          txns: new Set(),
        });
      }
      const skuEntry = v.skuAgg.get(s.kodeProduk)!;
      skuEntry.qty += s.qty;
      skuEntry.revenue += s.subtotal;
      if (s.nomorTransaksi) skuEntry.txns.add(s.nomorTransaksi);

      if (!v.storeAgg.has(s.kodeToko)) {
        v.storeAgg.set(s.kodeToko, {
          kodeToko: s.kodeToko,
          namaToko: s.namaToko,
          namaCabang: s.namaCabang,
          qty: 0,
          revenue: 0,
          txns: new Set(),
        });
      }
      const storeEntry = v.storeAgg.get(s.kodeToko)!;
      storeEntry.qty += s.qty;
      storeEntry.revenue += s.subtotal;
      if (s.nomorTransaksi) storeEntry.txns.add(s.nomorTransaksi);
    }

    const list = Array.from(variantMap.values())
      .map(v => ({
        variant: v.variant,
        shortVariant: v.variant.length > 24 ? v.variant.slice(0, 24) + '…' : v.variant,
        qty: Math.round(v.qty * 100) / 100,
        revenue: Math.round(v.revenue * 100) / 100,
        txCount: v.txns.size,
        skuCount: v.skus.size,
        brandCount: v.brands.size,
        categoryCount: v.categories.size,
        deptCount: v.depts.size,
        storeCount: v.stores.size,
        skuAgg: v.skuAgg,
        storeAgg: v.storeAgg,
      }))
      .sort((a, b) => b.qty - a.qty || b.revenue - a.revenue)
      .slice(0, 20);

    return list;
  }, [sales, selectedVariantStore]);

  useEffect(() => {
    if (!selectedVariant) {
      const first = topVariants[0]?.variant;
      if (first) setSelectedVariant(first);
      return;
    }
    const exists = topVariants.some(v => v.variant === selectedVariant);
    if (!exists) {
      const first = topVariants[0]?.variant;
      if (first) setSelectedVariant(first);
    }
  }, [topVariants, selectedVariant]);

  const selectedVariantDetail = useMemo(() => {
    const v = topVariants.find(x => x.variant === selectedVariant) ?? null;
    if (!v) return null;
    const skuRows = Array.from(v.skuAgg.values())
      .map(r => {
        const sohEntry = variantSohBySku.get(r.kodeProduk);
        return {
          ...r,
          txCount: r.txns.size,
          soh: sohEntry?.soh ?? 0,
          stockValue: sohEntry?.stockValue ?? 0,
          supplier: sohEntry ? Array.from(sohEntry.suppliers).sort()[0] ?? '' : '',
          tag: sohEntry ? Array.from(sohEntry.tags).sort()[0] ?? '' : '',
        };
      })
      .sort((a, b) => (variantMetric === 'qty' ? b.qty - a.qty : b.revenue - a.revenue) || b.txCount - a.txCount);

    const storeRows = Array.from(v.storeAgg.values())
      .map(r => ({ ...r, txCount: r.txns.size }))
      .sort((a, b) => (variantMetric === 'qty' ? b.qty - a.qty : b.revenue - a.revenue) || b.txCount - a.txCount);

    return { v, skuRows, storeRows };
  }, [topVariants, selectedVariant, variantMetric, variantSohBySku]);

  const skuPerTag = useMemo(() => {
    const filtered = selectedStore === 'all' ? soh : soh.filter(r => r.kodeToko === selectedStore);
    const tagMap = new Map<string, Set<string>>();
    for (const r of filtered) {
      const tag = r.tagProduk || 'Tanpa Tag';
      if (!tagMap.has(tag)) tagMap.set(tag, new Set());
      tagMap.get(tag)!.add(r.kodeProduk);
    }
    const totalTagCount = Array.from(tagMap.values()).reduce((sum, set) => sum + set.size, 0);
    return Array.from(tagMap.entries())
      .map(([tag, skus]) => ({ 
        tag, 
        count: skus.size,
        percentage: totalTagCount > 0 ? (skus.size / totalTagCount) * 100 : 0
      }))
      .sort((a, b) => b.count - a.count);
  }, [soh, selectedStore]);

  const currentPeriodName = useMemo(() => {
    const p = sales[0]?.period || soh[0]?.period;
    if (!p) return 'Semua Periode';
    const [year, month] = p.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];
    return `${months[parseInt(month) - 1]} ${year}`;
  }, [sales, soh]);

  if (loading) return <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground text-sm">Memuat data...</div>;

  if (sales.length === 0 && soh.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="p-4 rounded-2xl bg-accent/10 mb-4">
          <Package className="w-10 h-10 text-accent" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Belum Ada Data</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm">
          Upload file Excel penjualan dan stok untuk melihat dashboard inventori
        </p>
        <button
          onClick={() => navigate('/upload')}
          className="mt-4 px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors"
        >
          Upload Data
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Ringkasan penjualan dan inventori nasional">
        {availablePeriods.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Periode:</span>
            <Select value={currentPeriod} onValueChange={setCurrentPeriod}>
              <SelectTrigger className="w-[140px] bg-card h-8 text-xs border-muted-foreground/20">
                <SelectValue placeholder="Pilih Periode" />
              </SelectTrigger>
              <SelectContent>
                {availablePeriods.map(p => {
                  const [year, month] = p.split('-');
                  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];
                  return (
                    <SelectItem key={p} value={p}>
                      {months[parseInt(month) - 1]} {year}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        )}
      </PageHeader>

      {/* Sales Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <StatCard title="Total Revenue" value={formatCurrency(totalRevenue)} subtitle={`Periode: ${currentPeriodName}`} icon={DollarSign} variant="accent" />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <StatCard title="Item Terjual" value={formatNumber(totalItems)} subtitle={`Periode: ${currentPeriodName}`} icon={TrendingUp} variant="success" />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <StatCard title="Transaksi" value={formatNumber(uniqueTransactions)} subtitle={`Periode: ${currentPeriodName}`} icon={BarChart3} />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <StatCard title="Toko Aktif" value={formatNumber(uniqueStores)} subtitle={`Periode: ${currentPeriodName} • nasional`} icon={Package} />
        </motion.div>
      </div>

      {/* Inventory Stats */}
      {soh.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <StatCard title="Nilai Inventory (HPP)" value={formatCurrency(totalInventoryValue)} subtitle={`Periode: ${currentPeriodName}`} icon={Warehouse} variant="warning" />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <StatCard title="Total SKU" value={formatNumber(totalUniqueSku)} subtitle={`Periode: ${currentPeriodName} • unik`} icon={Boxes} />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <StatCard title="SKU Aktif (Good Stock)" value={formatNumber(totalActiveSku)} subtitle={`Periode: ${currentPeriodName} • ${totalUniqueSku > 0 ? Math.round((totalActiveSku / totalUniqueSku) * 100) : 0}% dari total`} icon={CheckCircle} variant="success" />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
            <StatCard title="Kategori Tag" value={formatNumber(skuPerTag.length)} subtitle={`Periode: ${currentPeriodName} • tag produk aktif`} icon={Tags} />
          </motion.div>
        </div>
      )}

      {/* SKU per Tag breakdown */}
      {skuPerTag.length > 0 && (
        <div className="bg-card rounded-xl border shadow-card">
          <div className="px-4 sm:px-5 py-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Distribusi SKU per Tag Produk</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Jumlah SKU unik untuk setiap tag produk (kolom Tag Produk pada file SOH)</p>
            </div>
            <Select value={selectedStore} onValueChange={setSelectedStore}>
              <SelectTrigger className="w-full sm:w-[220px] h-8 text-xs">
                <SelectValue placeholder="Semua Toko" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Toko</SelectItem>
                {storeList.map(([kode, nama]) => (
                  <SelectItem key={kode} value={kode}>
                    <span className="truncate">{nama}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="p-4 sm:p-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 sm:gap-3">
            {skuPerTag.map((item, i) => (
              <motion.div
                key={item.tag}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: Math.min(i * 0.03, 0.5) }}
                className="relative rounded-lg border bg-muted/30 px-3 sm:px-4 py-2.5 sm:py-3 text-center overflow-hidden"
              >
                <div className="absolute top-0 right-0 px-1.5 py-0.5 bg-accent/10 border-l border-b border-accent/20 rounded-bl-lg text-[9px] font-bold text-accent">
                  {item.percentage.toFixed(1)}%
                </div>
                <p className="text-base sm:text-lg font-bold text-foreground">{formatNumber(item.count)} <span className="text-[10px] sm:text-xs font-normal text-muted-foreground">SKU</span></p>
                <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 truncate font-medium" title={item.tag}>Tag {item.tag}</p>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Demand vs SOH Chart */}
      {soh.length > 0 && <DemandVsStockChart soh={soh} />}

      {/* Top SKU */}
      <div className="bg-card rounded-xl border shadow-card">
        <div className="px-4 sm:px-5 py-4 border-b">
          <h2 className="text-sm font-semibold text-foreground">Top SKU by Revenue</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 sm:px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Produk</th>
                <th className="text-left px-4 sm:px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Brand</th>
                <th className="text-right px-4 sm:px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Qty Sold</th>
                <th className="text-right px-4 sm:px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Revenue</th>
                <th className="text-right px-4 sm:px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Avg/Hari</th>
                <th className="text-right px-4 sm:px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Toko</th>
              </tr>
            </thead>
            <tbody>
              {skuSummaries.slice(0, 15).map((sku, i) => (
                <motion.tr
                  key={sku.kodeProduk}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 sm:px-5 py-3">
                    <p className="font-medium text-foreground text-xs">{sku.namaPanjang}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{sku.kodeProduk}</p>
                  </td>
                  <td className="px-4 sm:px-5 py-3 text-xs text-muted-foreground">{sku.brand}</td>
                  <td className="px-4 sm:px-5 py-3 text-right font-mono text-xs">{formatNumber(sku.totalQtySold)}</td>
                  <td className="px-4 sm:px-5 py-3 text-right font-mono text-xs font-medium">{formatCurrency(sku.totalRevenue)}</td>
                  <td className="px-4 sm:px-5 py-3 text-right font-mono text-xs">{sku.avgDailySales}</td>
                  <td className="px-4 sm:px-5 py-3 text-right font-mono text-xs">{sku.storeCount}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-card rounded-xl border shadow-card">
        <div className="px-4 sm:px-5 py-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Top 20 Varian Mobil Terbanyak</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Berdasarkan kolom Jenis pada data Sales, dilengkapi agregasi SKU, transaksi, dan stok (jika ada SOH)</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={selectedVariantStore} onValueChange={setSelectedVariantStore}>
              <SelectTrigger className="w-full sm:w-[240px] h-8 text-xs">
                <SelectValue placeholder="Semua Toko" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Toko</SelectItem>
                {salesStoreList.map(([kode, nama]) => (
                  <SelectItem key={kode} value={kode}>
                    <span className="truncate">{nama}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={variantMetric} onValueChange={(v) => setVariantMetric(v as 'qty' | 'revenue')}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue placeholder="Metric" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="qty">Qty</SelectItem>
                <SelectItem value="revenue">Revenue</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3">
            <div className="w-full" style={{ height: Math.max(420, topVariants.length * 22 + 110) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topVariants}
                  layout="vertical"
                  margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                  <XAxis type="number" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                  <YAxis
                    type="category"
                    dataKey="shortVariant"
                    width={140}
                    tick={{ fontSize: 10 }}
                    className="fill-muted-foreground"
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0]?.payload as typeof topVariants[number] | undefined;
                      if (!d) return null;
                      return (
                        <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-xl">
                          <div className="font-semibold text-foreground">{d.variant}</div>
                          <div className="mt-2 space-y-1">
                            <div>Qty: <span className="font-mono font-semibold">{formatNumber(d.qty)}</span></div>
                            <div>Revenue: <span className="font-mono font-semibold">{formatCurrency(d.revenue)}</span></div>
                            <div>Transaksi: <span className="font-mono font-semibold">{formatNumber(d.txCount)}</span></div>
                            <div>SKU: <span className="font-mono font-semibold">{formatNumber(d.skuCount)}</span></div>
                            <div>Toko: <span className="font-mono font-semibold">{formatNumber(d.storeCount)}</span></div>
                            <div>Brand: <span className="font-mono font-semibold">{formatNumber(d.brandCount)}</span></div>
                            <div>Category: <span className="font-mono font-semibold">{formatNumber(d.categoryCount)}</span></div>
                          </div>
                          <div className="mt-2 text-[10px] text-muted-foreground">Klik bar untuk lihat detail.</div>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey={variantMetric === 'qty' ? 'qty' : 'revenue'}
                    name={variantMetric === 'qty' ? 'Qty' : 'Revenue'}
                    fill="hsl(var(--chart-1))"
                    barSize={10}
                    radius={[0, 4, 4, 0]}
                    onClick={(data) => {
                      const d = data as unknown;
                      if (!d || typeof d !== 'object' || !('payload' in d)) return;
                      const p = (d as { payload?: unknown }).payload;
                      if (!p || typeof p !== 'object' || !('variant' in p)) return;
                      const v = (p as { variant?: unknown }).variant;
                      if (typeof v === 'string' && v) setSelectedVariant(v);
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {topVariants.length === 0 && (
              <div className="text-xs text-muted-foreground mt-2">Tidak ada data varian (kolom Jenis) untuk periode ini.</div>
            )}
          </div>

          <div className="lg:col-span-2 space-y-3">
            <div className="rounded-xl border bg-muted/20 p-4">
              <div className="text-xs text-muted-foreground">Varian terpilih</div>
              <div className="text-sm font-semibold text-foreground mt-1">{selectedVariantDetail?.v.variant ?? '-'}</div>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <div className="rounded-lg border bg-background/60 px-3 py-2">
                  <div className="text-[10px] text-muted-foreground">Qty</div>
                  <div className="text-xs font-semibold font-mono">{formatNumber(selectedVariantDetail?.v.qty ?? 0)}</div>
                </div>
                <div className="rounded-lg border bg-background/60 px-3 py-2">
                  <div className="text-[10px] text-muted-foreground">Revenue</div>
                  <div className="text-xs font-semibold">{formatCurrency(selectedVariantDetail?.v.revenue ?? 0)}</div>
                </div>
                <div className="rounded-lg border bg-background/60 px-3 py-2">
                  <div className="text-[10px] text-muted-foreground">Transaksi</div>
                  <div className="text-xs font-semibold font-mono">{formatNumber(selectedVariantDetail?.v.txCount ?? 0)}</div>
                </div>
                <div className="rounded-lg border bg-background/60 px-3 py-2">
                  <div className="text-[10px] text-muted-foreground">SKU</div>
                  <div className="text-xs font-semibold font-mono">{formatNumber(selectedVariantDetail?.v.skuCount ?? 0)}</div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border overflow-hidden">
              <div className="px-4 py-3 border-b bg-muted/30">
                <div className="text-sm font-semibold text-foreground">Detail SKU (Top)</div>
                <div className="text-xs text-muted-foreground mt-0.5">Agregasi dari Sales + join SOH per SKU (jika tersedia)</div>
              </div>
              <div className="overflow-x-auto max-h-[420px]">
                <table className="w-full text-sm min-w-[980px]">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">SKU</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Produk</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Brand</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Category</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Dept</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Qty</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Revenue</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Transaksi</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">SOH</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Nilai Stok</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Supplier</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Tag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedVariantDetail?.skuRows ?? []).slice(0, 20).map((r) => (
                      <tr key={r.kodeProduk} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r.kodeProduk}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground text-xs truncate max-w-[320px]" title={r.namaPanjang}>{r.namaPanjang}</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{r.brand}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{r.category}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{r.departement}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs">{formatNumber(r.qty)}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs">{formatCurrency(r.revenue)}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs">{formatNumber(r.txCount)}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs">{formatNumber(r.soh)}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs">{formatCurrency(r.stockValue)}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground truncate max-w-[200px]" title={r.supplier}>{r.supplier}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground truncate max-w-[180px]" title={r.tag}>{r.tag}</td>
                      </tr>
                    ))}
                    {(selectedVariantDetail?.skuRows ?? []).length === 0 && (
                      <tr>
                        <td colSpan={12} className="px-4 py-4 text-xs text-muted-foreground">Pilih varian untuk melihat detail SKU.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-xl border overflow-hidden">
              <div className="px-4 py-3 border-b bg-muted/30">
                <div className="text-sm font-semibold text-foreground">Kontribusi Toko (Top)</div>
                <div className="text-xs text-muted-foreground mt-0.5">Agregasi dari Sales untuk varian terpilih</div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[680px]">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Toko</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Qty</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Revenue</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Transaksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedVariantDetail?.storeRows ?? []).slice(0, 8).map((r) => (
                      <tr key={r.kodeToko} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground text-xs truncate max-w-[280px]" title={r.namaToko}>{r.namaToko}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{r.kodeToko} • {r.namaCabang}</p>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs">{formatNumber(r.qty)}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs">{formatCurrency(r.revenue)}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs">{formatNumber(r.txCount)}</td>
                      </tr>
                    ))}
                    {(selectedVariantDetail?.storeRows ?? []).length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-4 text-xs text-muted-foreground">Pilih varian untuk melihat kontribusi toko.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
