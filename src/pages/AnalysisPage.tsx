import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Activity, AlertTriangle, TrendingDown, Package, BarChart3,
  ChevronDown, ChevronUp, Search, Gauge, ShieldCheck, PackageX,
  LayoutGrid, Calendar, TrendingUp, ShieldAlert, ChevronRight, Brain, Sparkles, Loader2, Send
} from 'lucide-react';
import { getInventoryAnalysis } from '@/lib/aiAgent';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { getSOHData, getSalesData, getSkuSummaries, formatCurrency, formatNumber, getUploadedFiles } from '@/lib/dataStore';
import { filterByActiveStores, getOrderSettings } from '@/lib/orderSettings';
import { calculateStoreOrders } from '@/lib/storeOrders';
import type { SOHRecord, StoreOrderSummary, SkuSummary, SalesRecord, UploadedFile } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/* ─── Types ─── */
interface StoreHealth {
  kodeToko: string;
  namaToko: string;
  namaCabang: string;
  totalSku: number;
  totalQty: number;
  totalValue: number;
  nonMovingCount: number;
  nonMovingQty: number;
  nonMovingValue: number;
  nonMovingPercent: number;
  overstockCount: number;
  overstockQty: number;
  overstockValue: number;
  stockEfficiency: number;
  avgDsi: number;
  tagBreakdown: { tag: string; count: number; qty: number; value: number }[];
}

interface NationalHealth {
  totalSku: number;
  totalQty: number;
  totalValue: number;
  nonMovingCount: number;
  nonMovingQty: number;
  nonMovingValue: number;
  nonMovingPercent: number;
  overstockCount: number;
  overstockQty: number;
  overstockValue: number;
  stockEfficiency: number;
  avgDsi: number;
  storeCount: number;
  criticalOrderItems: number;
  tagBreakdown: { tag: string; count: number; qty: number; value: number }[];
  stores: StoreHealth[];
}

/* ─── Analysis Logic ─── */
function analyzeHealth(soh: SOHRecord[], orderSummaries: StoreOrderSummary[]): NationalHealth {
  const storeMap = new Map<string, SOHRecord[]>();
  for (const r of soh) {
    if (!storeMap.has(r.kodeToko)) storeMap.set(r.kodeToko, []);
    storeMap.get(r.kodeToko)!.push(r);
  }

  const orderMap = new Map<string, StoreOrderSummary>();
  for (const o of orderSummaries) orderMap.set(o.kodeToko, o);

  const stores: StoreHealth[] = [];
  const nationalTagMap = new Map<string, { count: number; qty: number; value: number }>();

  let natTotalSku = 0, natTotalQty = 0, natTotalValue = 0;
  let natNmCount = 0, natNmQty = 0, natNmValue = 0;
  let natOsCount = 0, natOsQty = 0, natOsValue = 0;
  let natDsiSum = 0, natDsiCount = 0;
  let natCritical = 0;

  for (const [kodeToko, records] of storeMap) {
    const first = records[0];
    let totalQty = 0, totalValue = 0;
    let nmCount = 0, nmQty = 0, nmValue = 0;
    let osCount = 0, osQty = 0, osValue = 0;
    let dsiSum = 0, dsiCount = 0;
    const tagMap = new Map<string, { count: number; qty: number; value: number }>();

    for (const r of records) {
      totalQty += r.soh;
      totalValue += r.valueStock;

      // Non-moving: no sales across all periods
      const isNonMoving = r.avgSalesM3 === 0 && r.avgSalesM2 === 0 && r.avgSalesM1 === 0 && r.sales === 0 && r.avgDailySales === 0;

      // Overstock: SOH > maxStock (and maxStock defined)
      const isOverstock = r.maxStock > 0 && r.soh > r.maxStock;

      if (isNonMoving && r.soh > 0) {
        nmCount++;
        nmQty += r.soh;
        nmValue += r.valueStock;

        // Tag breakdown for non-moving
        const tag = r.tagProduk || 'Tanpa Tag';
        if (!tagMap.has(tag)) tagMap.set(tag, { count: 0, qty: 0, value: 0 });
        const t = tagMap.get(tag)!;
        t.count++;
        t.qty += r.soh;
        t.value += r.valueStock;

        if (!nationalTagMap.has(tag)) nationalTagMap.set(tag, { count: 0, qty: 0, value: 0 });
        const nt = nationalTagMap.get(tag)!;
        nt.count++;
        nt.qty += r.soh;
        nt.value += r.valueStock;
      }

      if (isOverstock) {
        osCount++;
        osQty += r.soh - r.maxStock;
        osValue += ((r.soh - r.maxStock) / Math.max(r.soh, 1)) * r.valueStock;
      }

      if (r.dsi > 0) {
        dsiSum += r.dsi;
        dsiCount++;
      }
    }

    const totalSku = records.length;
    // Stock Efficiency = (Total Stock - (Overstock + Non Moving Stock)) / Total Stock × 100
    const inefficientQty = osQty + nmQty;
    const stockEfficiency = totalQty > 0 ? ((totalQty - inefficientQty) / totalQty) * 100 : 0;

    const storeOrder = orderMap.get(kodeToko);

    stores.push({
      kodeToko,
      namaToko: first.namaToko,
      namaCabang: first.namaCabang,
      totalSku,
      totalQty,
      totalValue,
      nonMovingCount: nmCount,
      nonMovingQty: nmQty,
      nonMovingValue: nmValue,
      nonMovingPercent: totalSku > 0 ? (nmCount / totalSku) * 100 : 0,
      overstockCount: osCount,
      overstockQty: osQty,
      overstockValue: Math.round(osValue),
      stockEfficiency: Math.round(stockEfficiency * 10) / 10,
      avgDsi: dsiCount > 0 ? Math.round(dsiSum / dsiCount) : 0,
      tagBreakdown: Array.from(tagMap.entries())
        .map(([tag, v]) => ({ tag, ...v }))
        .sort((a, b) => b.value - a.value),
    });

    natTotalSku += totalSku;
    natTotalQty += totalQty;
    natTotalValue += totalValue;
    natNmCount += nmCount;
    natNmQty += nmQty;
    natNmValue += nmValue;
    natOsCount += osCount;
    natOsQty += osQty;
    natOsValue += Math.round(osValue);
    natDsiSum += dsiSum;
    natDsiCount += dsiCount;
    natCritical += storeOrder?.criticalCount ?? 0;
  }

  const natInefficient = natOsQty + natNmQty;
  const natEfficiency = natTotalQty > 0 ? ((natTotalQty - natInefficient) / natTotalQty) * 100 : 0;

  stores.sort((a, b) => a.stockEfficiency - b.stockEfficiency);

  return {
    totalSku: natTotalSku,
    totalQty: natTotalQty,
    totalValue: natTotalValue,
    nonMovingCount: natNmCount,
    nonMovingQty: natNmQty,
    nonMovingValue: natNmValue,
    nonMovingPercent: natTotalSku > 0 ? (natNmCount / natTotalSku) * 100 : 0,
    overstockCount: natOsCount,
    overstockQty: natOsQty,
    overstockValue: natOsValue,
    stockEfficiency: Math.round(natEfficiency * 10) / 10,
    avgDsi: natDsiCount > 0 ? Math.round(natDsiSum / natDsiCount) : 0,
    storeCount: stores.length,
    criticalOrderItems: natCritical,
    tagBreakdown: Array.from(nationalTagMap.entries())
      .map(([tag, v]) => ({ tag, ...v }))
      .sort((a, b) => b.value - a.value),
    stores,
  };
}

/* ─── Helpers ─── */
function efficiencyColor(val: number): string {
  if (val >= 80) return 'text-success';
  if (val >= 60) return 'text-warning';
  return 'text-destructive';
}

function efficiencyBg(val: number): string {
  if (val >= 80) return 'bg-success/10';
  if (val >= 60) return 'bg-warning/10';
  return 'bg-destructive/10';
}

/* ─── Component ─── */
export default function AnalysisPage() {
  const [salesData, setSalesData] = useState<SalesRecord[]>([]);
  const [sohData, setSohData] = useState<SOHRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedStore, setExpandedStore] = useState<string | null>(null);
  const [selectedSku, setSelectedSku] = useState<SkuSummary | null>(null);
  const [isWsExpanded, setIsWsExpanded] = useState(false);
  
  // AI Analysis States
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedAiStore, setSelectedAiStore] = useState<string>('all');
  const [availablePeriods, setAvailablePeriods] = useState<string[]>([]);
  const [currentPeriod, setCurrentPeriod] = useState<string>('');

  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

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
    Promise.all([getSalesData(currentPeriod), getSOHData(currentPeriod)]).then(([sales, soh]) => {
      setSalesData(sales);
      setSohData(soh);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, [currentPeriod, availablePeriods.length]);

  const settings = useMemo(() => getOrderSettings(), []);
  
  const filteredSoh = useMemo(() => 
    filterByActiveStores(sohData), 
  [sohData]);

  const orderSummaries = useMemo(() => 
    calculateStoreOrders(filteredSoh, settings),
  [filteredSoh, settings]);

  const skuSummaries = useMemo(() => 
    getSkuSummaries(salesData, filteredSoh),
  [salesData, filteredSoh]);

  const health = useMemo(() => 
    analyzeHealth(filteredSoh, orderSummaries),
  [filteredSoh, orderSummaries]);

  const filteredStores = useMemo(() => {
    if (!searchTerm) return health.stores;
    const q = searchTerm.toLowerCase();
    return health.stores.filter(s =>
      s.namaToko.toLowerCase().includes(q) || s.kodeToko.toLowerCase().includes(q)
    );
  }, [health.stores, searchTerm]);

  const wsSkus = useMemo(() => {
    return skuSummaries.filter(s => {
      const tag = s.tagProduk?.toUpperCase();
      return tag === 'W' || tag === 'S';
    });
  }, [skuSummaries]);

  const isDataEmpty = sohData.length === 0;

  if (loading) return <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground text-sm">Memuat data...</div>;

  if (sohData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="p-4 rounded-2xl bg-accent/10 mb-4"><Activity className="w-10 h-10 text-accent" /></div>
        <h2 className="text-xl font-bold text-foreground">Belum Ada Data</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm">Upload data SOH untuk melihat analisa kesehatan inventory</p>
      </div>
    );
  }

  const handleRunAiAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const result = await getInventoryAnalysis({
        kodeToko: selectedAiStore === 'all' ? undefined : selectedAiStore,
        period: currentPeriod
      });
      setAiAnalysis(result);
      toast.success('Analisa Strategis Berhasil Dibuat');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal membuat analisa');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Simple Markdown-ish renderer for Analysis Page
  const renderAiContent = (content: string) => {
    return content.split('\n').map((line, i) => {
      if (line.startsWith('### ')) {
        return <h3 key={i} className="text-lg font-bold text-foreground mt-6 mb-3 flex items-center gap-2 border-b pb-2">
          {line.replace('### ', '')}
        </h3>;
      }
      if (line.startsWith('## ')) {
        return <h2 key={i} className="text-xl font-extrabold text-primary mt-8 mb-4">
          {line.replace('## ', '')}
        </h2>;
      }
      if (line.startsWith('* ') || line.startsWith('- ')) {
        return <li key={i} className="ml-5 text-sm text-muted-foreground list-disc my-1.5">{line.substring(2)}</li>;
      }
      if (line.match(/^\d+\./)) {
        return <div key={i} className="ml-2 font-semibold text-sm text-foreground my-2">{line}</div>;
      }
      if (line.trim() === '') return <div key={i} className="h-2" />;
      return <p key={i} className="text-sm text-muted-foreground leading-relaxed mb-2">{line}</p>;
    });
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader title="Analisa Inventory" description="Kesehatan inventory nasional & per toko">
        <div className="flex items-center gap-2">
          {availablePeriods.length > 0 && (
            <div className="flex items-center gap-2 mr-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <Select value={currentPeriod} onValueChange={setCurrentPeriod}>
                <SelectTrigger className="w-[120px] sm:w-[140px] bg-card h-8 text-xs border-muted-foreground/20">
                  <SelectValue placeholder="Pilih Periode" />
                </SelectTrigger>
                <SelectContent>
                  {availablePeriods.map(p => {
                    const [year, month] = p.split('-');
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
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Cari SKU atau Nama Produk..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-64 h-9 text-sm"
            />
          </div>
        </div>
      </PageHeader>

      {/* ─── AI Strategic Insight Section (Full Width) ─── */}
      <section className="bg-card rounded-2xl border-2 border-primary/20 shadow-xl overflow-hidden futuristic-surface relative">
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
          <Brain className="w-32 h-32 text-primary" />
        </div>
        
        <div className="p-5 sm:p-7 border-b bg-primary/5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/20">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground leading-none">AI Strategic Insight</h2>
              <p className="text-xs text-muted-foreground mt-1 tracking-wide">Analisa kritis mendalam berdasarkan praktik terbaik retail</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Filter Toko:</span>
              <Select value={selectedAiStore} onValueChange={setSelectedAiStore}>
                <SelectTrigger className="w-full sm:w-[180px] h-9 text-xs bg-background">
                  <SelectValue placeholder="Pilih Toko" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">🌐 Seluruh Nasional</SelectItem>
                  {health.stores.map(s => (
                    <SelectItem key={s.kodeToko} value={s.kodeToko}>
                      🏠 {s.namaToko}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button 
              onClick={handleRunAiAnalysis} 
              disabled={isAnalyzing}
              className="gap-2 h-9 px-5 bg-primary hover:bg-primary/90 shadow-md shadow-primary/10"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Menganalisa...
                </>
              ) : (
                <>
                  <Brain className="w-4 h-4" />
                  Generate Analisa Kritis
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="p-6 sm:p-8 min-h-[200px] relative">
          {!aiAnalysis && !isAnalyzing ? (
            <div className="flex flex-col items-center justify-center text-center py-12 space-y-4">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-muted-foreground/40">
                <Brain className="w-8 h-8" />
              </div>
              <div className="space-y-1 max-w-sm">
                <p className="text-sm font-semibold text-foreground">Analisa Strategis Siap Dibuat</p>
                <p className="text-xs text-muted-foreground">Klik tombol di atas untuk memulai analisa kritis terhadap data {selectedAiStore === 'all' ? 'Nasional' : health.stores.find(s => s.kodeToko === selectedAiStore)?.namaToko} periode {currentPeriod}.</p>
              </div>
            </div>
          ) : isAnalyzing ? (
            <div className="flex flex-col items-center justify-center py-20 animate-in fade-in duration-500">
              <div className="relative">
                <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                <Brain className="w-6 h-6 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
              </div>
              <p className="mt-4 text-sm font-medium text-primary animate-pulse">Menghubungkan ke SumoPod AI...</p>
              <p className="mt-1 text-xs text-muted-foreground">Mengevaluasi variabel modal kerja dan inefisiensi stok...</p>
            </div>
          ) : (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="prose prose-sm max-w-none text-foreground dark:prose-invert"
            >
              <div className="bg-muted/30 rounded-2xl p-6 sm:p-8 border border-muted/50 shadow-inner">
                {renderAiContent(aiAnalysis || '')}
              </div>
              
              <div className="mt-6 flex justify-end">
                <Button variant="ghost" size="sm" className="text-[10px] gap-1.5 text-muted-foreground uppercase tracking-widest" onClick={() => window.print()}>
                  <Send className="w-3 h-3" /> Cetak Laporan Strategis
                </Button>
              </div>
            </motion.div>
          )}
        </div>
      </section>

      {/* ─── National Summary Cards ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard title="Stock Efficiency" value={`${health.stockEfficiency}%`} icon={Gauge} variant={health.stockEfficiency >= 80 ? 'success' : health.stockEfficiency >= 60 ? 'warning' : 'destructive'} />
        <StatCard title="Non-Moving SKU" value={`${health.nonMovingPercent.toFixed(1)}%`} subtitle={`${formatNumber(health.nonMovingCount)} item`} icon={PackageX} variant="warning" />
        <StatCard title="Nilai Non-Moving" value={formatCurrency(health.nonMovingValue)} subtitle={`${formatNumber(health.nonMovingQty)} pcs`} icon={TrendingDown} variant="destructive" />
        <StatCard title="Overstock SKU" value={formatNumber(health.overstockCount)} subtitle={formatCurrency(health.overstockValue)} icon={AlertTriangle} variant="warning" />
        <StatCard title="Avg DSI" value={`${health.avgDsi} hari`} icon={BarChart3} variant="accent" />
        <StatCard title="Critical Order" value={formatNumber(health.criticalOrderItems)} subtitle={`${health.storeCount} toko`} icon={ShieldCheck} variant="destructive" />
      </div>


      {/* ─── Non-Moving by Tag ─── */}
      {health.tagBreakdown.length > 0 && (
        <div className="bg-card rounded-xl border shadow-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <PackageX className="w-4 h-4 text-warning" />
            <h3 className="text-sm font-semibold text-foreground">Non-Moving per Tag Produk</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Tag Produk</th>
                  <th className="text-right px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Jumlah SKU</th>
                  <th className="text-right px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Qty</th>
                  <th className="text-right px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Nilai Inventory</th>
                  <th className="text-right px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">% dari Total NM</th>
                </tr>
              </thead>
              <tbody>
                {health.tagBreakdown.map((t, i) => (
                  <tr key={t.tag} className={`border-t hover:bg-muted/20 transition-colors ${i % 2 === 0 ? '' : 'bg-muted/10'}`}>
                    <td className="px-3 py-2 font-medium text-foreground text-xs">{t.tag}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{formatNumber(t.count)}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{formatNumber(t.qty)}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{formatCurrency(t.value)}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{health.nonMovingValue > 0 ? ((t.value / health.nonMovingValue) * 100).toFixed(1) : 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── W/S Tag SKU Analysis ─── */}
      {wsSkus.length > 0 && (
        <Collapsible open={isWsExpanded} onOpenChange={setIsWsExpanded} className="bg-card rounded-xl border shadow-card overflow-hidden">
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors text-left">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Penjualan SKU Tag W/S</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  {wsSkus.length} SKU Tag W/S Terdeteksi
                </span>
                <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform duration-200", isWsExpanded && "rotate-180")} />
              </div>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="p-4 pt-0">
              <div className="overflow-x-auto border rounded-xl overflow-hidden mt-2">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">SKU / Nama Produk</th>
                      <th className="text-center px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Tag</th>
                      <th className="text-right px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Toko Penjualan</th>
                      <th className="text-right px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Total Qty Sold</th>
                      <th className="text-right px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Total Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wsSkus.map((sku, i) => (
                      <tr 
                        key={sku.kodeProduk} 
                        className={`border-t hover:bg-muted/20 cursor-pointer transition-colors ${i % 2 === 0 ? '' : 'bg-muted/10'}`}
                        onClick={() => setSelectedSku(sku)}
                      >
                        <td className="px-3 py-2">
                          <p className="font-semibold text-foreground text-xs">{sku.namaPanjang}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{sku.kodeProduk}</p>
                        </td>
                        <td className="px-3 py-2 text-center text-xs font-bold text-primary">{sku.tagProduk}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs">{sku.storeCount} toko</td>
                        <td className="px-3 py-2 text-right font-mono text-xs">{formatNumber(sku.totalQtySold)}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs">{formatCurrency(sku.totalRevenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* ─── Stock Efficiency Formula ─── */}
      <div className="bg-card rounded-xl border shadow-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Gauge className="w-4 h-4 text-accent" />
          <h3 className="text-sm font-semibold text-foreground">Rumus Stock Efficiency</h3>
        </div>
        <div className="bg-muted/30 rounded-lg p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">S/E = (Total Stock − (Overstock + Non Moving Stock)) / Total Stock × 100%</p>
          <p className="text-lg font-bold font-mono">
            S/E = ({formatNumber(health.totalQty)} − ({formatNumber(health.overstockQty)} + {formatNumber(health.nonMovingQty)})) / {formatNumber(health.totalQty)} × 100% = <span className={efficiencyColor(health.stockEfficiency)}>{health.stockEfficiency}%</span>
          </p>
        </div>
      </div>

      {/* ─── Store List Dialog ─── */}
      <Dialog open={!!selectedSku} onOpenChange={(open) => !open && setSelectedSku(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex flex-col gap-1">
              <span>Detail Stok & Penjualan per Toko</span>
              <span className="text-xs font-normal text-muted-foreground">{selectedSku?.namaPanjang} ({selectedSku?.kodeProduk})</span>
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4 max-h-[60vh] overflow-y-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card z-10">
                <tr className="bg-muted shadow-sm">
                  <th className="text-left px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase">Kode</th>
                  <th className="text-left px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase">Nama Toko</th>
                  <th className="text-right px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase">Stok (SOH)</th>
                  <th className="text-right px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase">Penjualan</th>
                  <th className="text-right px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase">Nilai Stok</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {selectedSku?.storeDetails.map((store) => (
                  <tr key={store.kodeToko} className="hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2 text-[10px] font-mono whitespace-nowrap">{store.kodeToko}</td>
                    <td className="px-3 py-2 text-xs font-medium">{store.namaToko}</td>
                    <td className={`px-3 py-2 text-right font-mono text-xs ${store.soh > 0 ? 'text-foreground' : 'text-muted-foreground/50'}`}>
                      {formatNumber(store.soh)}
                    </td>
                    <td className={`px-3 py-2 text-right font-mono text-xs ${store.salesQty > 0 ? 'text-primary font-bold' : 'text-muted-foreground/50'}`}>
                      {formatNumber(store.salesQty)}
                    </td>
                    <td className={`px-3 py-2 text-right font-mono text-xs ${store.stockValue > 0 ? 'text-foreground' : 'text-muted-foreground/50'}`}>
                      {formatCurrency(store.stockValue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Per-Store Health ─── */}
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-sm font-semibold text-foreground">Kesehatan per Toko</h3>
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Cari toko..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
        </div>
      </div>

      <div className="space-y-3">
        {filteredStores.map((store, i) => {
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
                  <div className={`p-2 rounded-lg shrink-0 ${efficiencyBg(store.stockEfficiency)}`}>
                    <Gauge className={`w-4 sm:w-5 h-4 sm:h-5 ${efficiencyColor(store.stockEfficiency)}`} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs sm:text-sm font-semibold text-foreground truncate">{store.namaToko}</h3>
                    <p className="text-[10px] text-muted-foreground font-mono">{store.kodeToko} • {store.namaCabang}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 sm:gap-5 shrink-0 pl-11 sm:pl-0">
                  <div className="text-left sm:text-right">
                    <p className="text-[10px] text-muted-foreground">Efisiensi</p>
                    <p className={`text-xs font-bold font-mono ${efficiencyColor(store.stockEfficiency)}`}>{store.stockEfficiency}%</p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-[10px] text-muted-foreground">Non-Moving</p>
                    <p className="text-xs font-bold font-mono text-warning">{store.nonMovingPercent.toFixed(1)}%</p>
                    <p className="text-[10px] font-mono text-muted-foreground">{store.nonMovingCount} SKU</p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-[10px] text-muted-foreground">Overstock</p>
                    <p className="text-xs font-bold font-mono text-destructive">{store.overstockCount} SKU</p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-[10px] text-muted-foreground">DSI</p>
                    <p className="text-xs font-bold font-mono">{store.avgDsi} hari</p>
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
              </button>

              {isExpanded && (
                <div className="border-t p-3 sm:p-4 space-y-3">
                  {/* Store summary stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="bg-muted/30 rounded-lg p-2.5">
                      <p className="text-[10px] text-muted-foreground">Total SKU</p>
                      <p className="text-sm font-bold font-mono">{formatNumber(store.totalSku)}</p>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-2.5">
                      <p className="text-[10px] text-muted-foreground">Total Qty</p>
                      <p className="text-sm font-bold font-mono">{formatNumber(store.totalQty)}</p>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-2.5">
                      <p className="text-[10px] text-muted-foreground">Nilai Inventory</p>
                      <p className="text-sm font-bold font-mono">{formatCurrency(store.totalValue)}</p>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-2.5">
                      <p className="text-[10px] text-muted-foreground">Nilai Non-Moving</p>
                      <p className="text-sm font-bold font-mono text-warning">{formatCurrency(store.nonMovingValue)}</p>
                    </div>
                  </div>

                  {/* Stock Efficiency detail */}
                  <div className="bg-muted/20 rounded-lg p-2.5 text-center">
                    <p className="text-[10px] text-muted-foreground">S/E = ({formatNumber(store.totalQty)} − ({formatNumber(store.overstockQty)} + {formatNumber(store.nonMovingQty)})) / {formatNumber(store.totalQty)} × 100%</p>
                    <p className={`text-sm font-bold font-mono ${efficiencyColor(store.stockEfficiency)}`}>= {store.stockEfficiency}%</p>
                  </div>

                  {/* Tag breakdown */}
                  {store.tagBreakdown.length > 0 && (
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Non-Moving per Tag</p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-muted/50">
                              <th className="text-left px-2 py-1.5 text-[10px] font-medium text-muted-foreground">Tag</th>
                              <th className="text-right px-2 py-1.5 text-[10px] font-medium text-muted-foreground">SKU</th>
                              <th className="text-right px-2 py-1.5 text-[10px] font-medium text-muted-foreground">Qty</th>
                              <th className="text-right px-2 py-1.5 text-[10px] font-medium text-muted-foreground">Nilai</th>
                            </tr>
                          </thead>
                          <tbody>
                            {store.tagBreakdown.map(t => (
                              <tr key={t.tag} className="border-t hover:bg-muted/20">
                                <td className="px-2 py-1.5 font-medium">{t.tag}</td>
                                <td className="px-2 py-1.5 text-right font-mono">{t.count}</td>
                                <td className="px-2 py-1.5 text-right font-mono">{formatNumber(t.qty)}</td>
                                <td className="px-2 py-1.5 text-right font-mono">{formatCurrency(t.value)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
