import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Zap, 
  TrendingUp, 
  Minus, 
  AlertTriangle, 
  Skull, 
  Search, 
  ArrowRight,
  ChevronDown,
  Box,
  BarChart3,
  Calendar,
  Store
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { getSOHData, getSalesData, getSkuSummaries, formatCurrency } from '@/lib/dataStore';
import type { SkuSummary } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function MovingStockPage() {
  const [skuSummaries, setSkuSummaries] = useState<SkuSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSku, setSelectedSku] = useState<SkuSummary | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [soh, sales] = await Promise.all([getSOHData(), getSalesData()]);
        const summaries = await getSkuSummaries(sales, soh);
        setSkuSummaries(summaries);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const filteredData = useMemo(() => {
    return skuSummaries.filter(s => 
      s.kodeProduk.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.namaPanjang.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [skuSummaries, searchTerm]);

  const stats = useMemo(() => {
    const total = skuSummaries.length;
    const getPercent = (count: number) => total > 0 ? (count / total) * 100 : 0;

    const data = {
      very_fast: { count: 0, value: 0 },
      fast: { count: 0, value: 0 },
      medium: { count: 0, value: 0 },
      slow: { count: 0, value: 0 },
      dead: { count: 0, value: 0 },
    };

    skuSummaries.forEach(s => {
      if (data[s.movingClass]) {
        data[s.movingClass].count++;
        // Sum total stock value across all stores for this SKU
        const skuValue = s.storeDetails.reduce((acc, d) => acc + d.stockValue, 0);
        data[s.movingClass].value += skuValue;
      }
    });

    const totalValue = Object.values(data).reduce((acc, curr) => acc + curr.value, 0);

    return {
      total,
      totalValue,
      veryFast: data.very_fast.count,
      veryFastValue: data.very_fast.value,
      fast: data.fast.count,
      fastValue: data.fast.value,
      medium: data.medium.count,
      mediumValue: data.medium.value,
      slow: data.slow.count,
      slowValue: data.slow.value,
      dead: data.dead.count,
      deadValue: data.dead.value,
      percents: {
        veryFast: getPercent(data.very_fast.count),
        fast: getPercent(data.fast.count),
        medium: getPercent(data.medium.count),
        slow: getPercent(data.slow.count),
        dead: getPercent(data.dead.count),
      },
      valuePercents: {
        veryFast: totalValue > 0 ? (data.very_fast.value / totalValue) * 100 : 0,
        fast: totalValue > 0 ? (data.fast.value / totalValue) * 100 : 0,
        medium: totalValue > 0 ? (data.medium.value / totalValue) * 100 : 0,
        slow: totalValue > 0 ? (data.slow.value / totalValue) * 100 : 0,
        dead: totalValue > 0 ? (data.dead.value / totalValue) * 100 : 0,
      }
    };
  }, [skuSummaries]);

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin" />
        <p className="text-muted-foreground animate-pulse">Menganalisa pergerakan stok...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-10">
      <PageHeader 
        title="Moving Stock Analysis" 
        description="Klasifikasi SKU berdasarkan tingkat pergerakan bulanan (Industry Standard)" 
      />

      {/* Stats Overview */}
      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4"
      >
        <StatCard 
          title="Very Fast" 
          count={stats.veryFast} 
          percent={stats.percents.veryFast}
          value={stats.veryFastValue}
          valuePercent={stats.valuePercents.veryFast}
          icon={Zap} 
          color="bg-blue-500" 
          description="> 10 unit / bln"
          variant="very_fast"
        />
        <StatCard 
          title="Fast Moving" 
          count={stats.fast} 
          percent={stats.percents.fast}
          value={stats.fastValue}
          valuePercent={stats.valuePercents.fast}
          icon={TrendingUp} 
          color="bg-green-500" 
          description="4 - 10 unit / bln"
          variant="fast"
        />
        <StatCard 
          title="Medium" 
          count={stats.medium} 
          percent={stats.percents.medium}
          value={stats.mediumValue}
          valuePercent={stats.valuePercents.medium}
          icon={Minus} 
          color="bg-yellow-500" 
          description="1 - 4 unit / bln"
          variant="medium"
        />
        <StatCard 
          title="Slow Moving" 
          count={stats.slow} 
          percent={stats.percents.slow}
          value={stats.slowValue}
          valuePercent={stats.valuePercents.slow}
          icon={AlertTriangle} 
          color="bg-orange-500" 
          description="0.1 - 1 unit / bln"
          variant="slow"
        />
        <StatCard 
          title="Dead Stock" 
          count={stats.dead} 
          percent={stats.percents.dead}
          value={stats.deadValue}
          valuePercent={stats.valuePercents.dead}
          icon={Skull} 
          color="bg-red-500" 
          description="0 sales / bln"
          variant="dead"
        />
      </motion.div>

      {/* Main Content */}
      <Card className="border-border/40 shadow-xl glass-morphism overflow-hidden">
        <CardHeader className="pb-0 border-b border-border/10 bg-muted/30">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-2">
            <div>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-accent" />
                Daftar SKU per Kriteria
              </CardTitle>
              <CardDescription>Pilih tab untuk melihat detail SKU masing-masing kriteria</CardDescription>
            </div>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Cari SKU atau Nama Barang..." 
                className="pl-9 bg-background/50 border-border/50 focus:ring-accent/20"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Tabs defaultValue="very_fast" className="w-full">
            <div className="px-6 py-2 bg-muted/10 border-b border-border/10">
              <TabsList className="bg-transparent gap-2 h-auto p-0 border-none">
                <MovingTabTrigger value="very_fast" label="Very Fast" count={stats.veryFast} color="text-blue-500" />
                <MovingTabTrigger value="fast" label="Fast" count={stats.fast} color="text-green-500" />
                <MovingTabTrigger value="medium" label="Medium" count={stats.medium} color="text-yellow-500" />
                <MovingTabTrigger value="slow" label="Slow" count={stats.slow} color="text-orange-500" />
                <MovingTabTrigger value="dead" label="Dead Stock" count={stats.dead} color="text-red-500" />
              </TabsList>
            </div>

            {(['very_fast', 'fast', 'medium', 'slow', 'dead'] as const).map(type => (
              <TabsContent key={type} value={type} className="m-0">
                <StockTable 
                  skus={filteredData.filter(s => s.movingClass === type)} 
                  onRowClick={setSelectedSku}
                />
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Store List Dialog */}
      <Dialog open={!!selectedSku} onOpenChange={(open) => !open && setSelectedSku(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Store className="w-5 h-5 text-accent" />
              Detail Stok & Penjualan per Toko
            </DialogTitle>
            <DialogDescription className="text-foreground/80 font-medium">
              {selectedSku?.kodeProduk} - {selectedSku?.namaPanjang}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 border rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-xs sm:text-sm text-left border-collapse">
              <thead>
                <tr className="bg-muted text-muted-foreground border-b uppercase tracking-wider text-[10px] font-bold">
                  <th className="px-4 py-3">Kode / Nama Toko</th>
                  <th className="px-4 py-3 text-center">Status di Toko</th>
                  <th className="px-4 py-3 text-right">Stok (SOH)</th>
                  <th className="px-4 py-3 text-right">Penjualan Qty</th>
                  <th className="px-4 py-3 text-right">Nilai Stok (HPP)</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {selectedSku?.storeDetails.map((store) => (
                  <tr 
                    key={store.kodeToko} 
                    className={cn(
                      "hover:bg-muted/30 transition-colors",
                      (store.soh === 0 && store.salesQty === 0) ? "opacity-40 grayscale" : ""
                    )}
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold">{store.namaToko}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{store.kodeToko}</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <MovingStatusBadge variant={store.movingClass} />
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold">
                      {store.soh.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-accent font-semibold">
                      {store.salesQty.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {formatCurrency(store.stockValue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ title, count, percent, value, valuePercent, icon: Icon, color, description, variant }: { 
  title: string; 
  count: number; 
  percent: number;
  value: number;
  valuePercent: number;
  icon: any; 
  color: string;
  description: string;
  variant: string;
}) {
  const gradientClass = {
    very_fast: "from-blue-500/20 to-blue-600/5 border-blue-500/30",
    fast: "from-green-500/20 to-green-600/5 border-green-500/30",
    medium: "from-yellow-500/20 to-yellow-600/5 border-yellow-500/30",
    slow: "from-orange-500/20 to-orange-600/5 border-orange-500/30",
    dead: "from-red-500/20 to-red-600/5 border-red-500/30",
  }[variant as 'very_fast'] || "from-accent/20 to-accent/5";

  const iconColor = {
    very_fast: "text-blue-500",
    fast: "text-green-500",
    medium: "text-yellow-500",
    slow: "text-orange-500",
    dead: "text-red-500",
  }[variant as 'very_fast'] || "text-accent";

  return (
    <motion.div
      variants={{ hidden: { opacity: 0, scale: 0.95 }, show: { opacity: 1, scale: 1 } }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className={cn(
        "relative rounded-2xl border p-5 bg-gradient-to-br shadow-lg overflow-hidden group",
        gradientClass
      )}
    >
      <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity rotate-12">
        <Icon size={120} />
      </div>
      <div className="flex items-start justify-between">
        <div className={cn("p-2.5 rounded-xl bg-background/50 shadow-sm", iconColor)}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="mt-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
          <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full bg-background/50 shadow-sm", iconColor)}>
            {percent.toFixed(1)}%
          </span>
        </div>
        <div className="flex items-baseline gap-2 mt-1">
          <span className="text-2xl font-bold tracking-tight">{count.toLocaleString()}</span>
          <span className="text-xs font-medium text-muted-foreground">SKUs</span>
        </div>
        <div className="mt-2 space-y-0.5">
          <p className="text-[10px] uppercase tracking-wider font-semibold opacity-60">{description}</p>
          <p className={cn("text-xs font-bold font-mono", iconColor)}>
            {formatCurrency(value)}
            <span className="ml-1 opacity-70">({valuePercent.toFixed(1)}%)</span>
          </p>
        </div>
      </div>
    </motion.div>
  );
}

function MovingTabTrigger({ value, label, count, color }: { value: string; label: string; count: number; color: string }) {
  return (
    <TabsTrigger 
      value={value} 
      className="data-[state=active]:bg-background/80 data-[state=active]:shadow-sm px-4 py-2 rounded-lg transition-all group border border-transparent data-[state=active]:border-border/50"
    >
      <div className="flex items-center gap-2">
        <span className={cn("text-sm font-semibold", color)}>{label}</span>
        <Badge variant="secondary" className="px-1.5 h-5 min-w-[1.25rem] flex items-center justify-center text-[10px] font-bold">
          {count}
        </Badge>
      </div>
    </TabsTrigger>
  );
}

function StockTable({ skus, onRowClick }: { skus: SkuSummary[]; onRowClick: (sku: SkuSummary) => void }) {
  if (skus.length === 0) {
    return (
      <div className="py-20 text-center flex flex-col items-center gap-3">
        <div className="p-4 bg-muted/20 rounded-full">
          <Box className="w-10 h-10 text-muted-foreground/30" />
        </div>
        <p className="text-muted-foreground">Tidak ada SKU di kriteria ini.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-muted/30 border-b border-border/10">
            <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Detail Barang</th>
            <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Brand / Kategori</th>
            <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-center">Toko Menyediakan</th>
            <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">Avg Monthly Sales</th>
            <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">Total SOH</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/10">
          {skus.map((s, idx) => (
            <tr 
              key={s.kodeProduk} 
              className="hover:bg-muted/20 transition-colors group cursor-pointer"
              onClick={() => onRowClick(s)}
            >
              <td className="px-6 py-4">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm group-hover:text-accent transition-colors">{s.kodeProduk}</span>
                    <MovingStatusBadge variant={s.movingClass} />
                  </div>
                  <span className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{s.namaPanjang}</span>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex flex-col gap-1">
                  <Badge variant="outline" className="w-fit text-[10px] py-0 px-1 bg-muted/30 border-border/40 uppercase">
                    {s.brand}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground/80">{s.category}</span>
                </div>
              </td>
              <td className="px-6 py-4 text-center">
                <div className="flex flex-col items-center justify-center gap-1">
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-bold">{s.storeCount}</span>
                    <span className="text-[10px] text-muted-foreground">toko</span>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 text-right">
                <div className="flex items-center justify-end gap-2">
                  <span className="text-sm font-bold text-accent">{s.avgMonthlySales.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
                  <ArrowRight className="w-3 h-3 text-muted-foreground/30" />
                </div>
              </td>
              <td className="px-6 py-4 text-right font-mono font-medium text-sm">
                {s.totalSoh.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MovingStatusBadge({ variant }: { variant: 'very_fast' | 'fast' | 'medium' | 'slow' | 'dead' }) {
  const configs = {
    very_fast: { label: 'Very Fast', color: 'bg-blue-500/10 text-blue-600 border-blue-200' },
    fast: { label: 'Fast', color: 'bg-green-500/10 text-green-600 border-green-200' },
    medium: { label: 'Medium', color: 'bg-yellow-500/10 text-yellow-600 border-yellow-200' },
    slow: { label: 'Slow', color: 'bg-orange-500/10 text-orange-600 border-orange-200' },
    dead: { label: 'Dead', color: 'bg-red-500/10 text-red-600 border-red-200' },
  };

  const config = configs[variant];
  return (
    <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 h-5 font-bold uppercase whitespace-nowrap", config.color)}>
      {config.label}
    </Badge>
  );
}
