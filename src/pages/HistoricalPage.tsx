import { useState, useEffect, useMemo } from 'react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, AreaChart, Area 
} from 'recharts';
import { 
  TrendingUp, History, Calendar, Download, RefreshCcw, 
  ArrowUpRight, ArrowDownRight, Package, Gauge, Activity, Info
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatCard } from '@/components/StatCard';
import { 
  getHistoricalSnapshots, 
  generateMonthlySnapshot, 
  saveHistoricalSnapshot,
  getUploadedFiles,
  getSOHData,
  formatCurrency,
  formatNumber
} from '@/lib/dataStore';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { HistoricalSnapshot } from '@/lib/types';

export default function HistoricalPage() {
  const [snapshots, setSnapshots] = useState<HistoricalSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [availablePeriods, setAvailablePeriods] = useState<string[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>('all');
  const [storeNameMap, setStoreNameMap] = useState<Record<string, string>>({});

  const months = useMemo(() => [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'
  ], []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [data, files] = await Promise.all([
        getHistoricalSnapshots(),
        getUploadedFiles()
      ]);
      setSnapshots(data);
      console.log("Loaded snapshots:", data);
      console.log("Available files:", files);
      
      const periods = Array.from(new Set(files.map(f => f.period))).sort();
      setAvailablePeriods(periods);

      // Build store name mapping from SOH/Sales data for older snapshots
      const soh = await getSOHData();
      const mapping: Record<string, string> = {};
      soh.forEach(s => { if (s.kodeToko && s.namaToko) mapping[s.kodeToko] = s.namaToko; });
      setStoreNameMap(mapping);
    } catch (err) {
      console.error(err);
      toast.error('Gagal memuat data histori');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleGenerateSnapshot = async (period: string) => {
    setGenerating(true);
    try {
      const snapshot = await generateMonthlySnapshot(period);
      await saveHistoricalSnapshot(snapshot);
      toast.success(`Snapshot untuk ${period} berhasil dibuat`);
      loadData();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Gagal membuat snapshot');
    } finally {
      setGenerating(false);
    }
  };

  const availableStores = useMemo(() => {
    const stores = new Set<string>();
    snapshots.forEach(s => {
      if (s.storeData) {
        Object.keys(s.storeData).forEach(k => stores.add(k));
      }
    });
    return Array.from(stores).sort();
  }, [snapshots]);

  const chartData = useMemo(() => {
    return snapshots.map(s => {
      const [year, month] = s.period.split('-');
      
      const metrics = selectedStore !== 'all' && s.storeData && s.storeData[selectedStore] 
        ? s.storeData[selectedStore] 
        : {
            totalRevenue: s.totalRevenue,
            totalStockValue: s.totalStockValue,
            ito: s.ito,
            stockEfficiency: s.stockEfficiency,
            movingCounts: s.movingCounts
          };

      return {
        ...s,
        name: `${months[parseInt(month) - 1]} ${year.slice(2)}`,
        revenue: metrics.totalRevenue,
        stockValue: metrics.totalStockValue,
        ito: Math.round(metrics.ito * 100) / 100,
        efficiency: Math.round(metrics.stockEfficiency * 10) / 10,
        veryFast: metrics.movingCounts.veryFast,
        fast: metrics.movingCounts.fast,
        medium: metrics.movingCounts.medium,
        slow: metrics.movingCounts.slow,
        dead: metrics.movingCounts.dead,
        rawMetrics: metrics, // Store raw metrics for Key Metrics calculation
      };
    });
  }, [snapshots, months, selectedStore]);

  const latest = chartData[chartData.length - 1]?.rawMetrics;
  const previous = chartData[chartData.length - 2]?.rawMetrics;

  const getTrend = (curr: number, prev: number) => {
    if (!prev) return 0;
    return ((curr - prev) / prev) * 100;
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground text-sm">Memuat tren...</div>;

  return (
    <div className="space-y-6">
      <PageHeader title="Tren Historis" description="Analisis perkembangan performa stok dari waktu ke waktu">
        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
          <Select value={selectedStore} onValueChange={setSelectedStore}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue placeholder="Semua Toko" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Toko</SelectItem>
              {availableStores.map(store => (
                <SelectItem key={store} value={store}>
                  {storeNameMap[store] || store}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {availablePeriods.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Buat Snapshot:</span>
              <select 
                className="text-xs bg-background border rounded-lg px-2 py-1 outline-none"
                onChange={(e) => e.target.value && handleGenerateSnapshot(e.target.value)}
                defaultValue=""
              >
                <option value="" disabled>Pilih Periode...</option>
                {availablePeriods.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          )}
          <Button variant="outline" size="sm" onClick={loadData} disabled={generating}>
            <RefreshCcw className={cn("w-3.5 h-3.5 mr-1.5", generating && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </PageHeader>

      {snapshots.length === 0 ? (
        <Card className="p-12 text-center border-dashed bg-muted/20">
          <History className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Belum ada data histori</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">
            Silakan upload data di halaman Upload, lalu klik tombol "Buat Snapshot" untuk merekam performa bulan tersebut.
          </p>
        </Card>
      ) : (
        <>
          {/* Key Metrics Trend */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <TrendStat 
              title="Inventory Turnover (ITO)" 
              value={latest.ito.toFixed(2)} 
              trend={getTrend(latest.ito, previous?.ito)} 
              icon={<TrendingUp className="w-4 h-4" />}
              suffix="x"
            />
            <TrendStat 
              title="Stock Efficiency" 
              value={latest.stockEfficiency.toFixed(1)} 
              trend={getTrend(latest.stockEfficiency, previous?.stockEfficiency)} 
              icon={<Gauge className="w-4 h-4" />}
              suffix="%"
            />
            <TrendStat 
              title="Total Revenue" 
              value={formatCurrency(latest.totalRevenue)} 
              trend={getTrend(latest.totalRevenue, previous?.totalRevenue)} 
              icon={<Activity className="w-4 h-4" />}
            />
            <TrendStat 
              title="Inventory Value" 
              value={formatCurrency(latest.totalStockValue)} 
              trend={getTrend(latest.totalStockValue, previous?.totalStockValue)} 
              icon={<Package className="w-4 h-4" />}
              inverseTrendColor
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ITO & Efficiency Chart */}
            <Card className="p-6 shadow-card border-none bg-card/50 backdrop-blur-sm group relative">
              <h3 className="text-sm font-semibold mb-6 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Tren Finansial & Perputaran (ITO)
                <div className="group/tooltip relative ml-auto">
                  <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                  <div className="absolute right-0 bottom-full mb-2 w-64 p-3 bg-popover text-popover-foreground text-xs rounded-lg shadow-xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-50">
                    <p className="font-semibold mb-1">Inventory Turnover (ITO)</p>
                    <p className="text-muted-foreground">Mengukur rasio HPP Penjualan dibagi rata-rata nilai persediaan. Makin tinggi angka ITO, makin sehat perputaran stok di gudang.</p>
                  </div>
                </div>
              </h3>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted))" />
                    <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="left" fontSize={12} tickLine={false} axisLine={false} width={30} />
                    <YAxis yAxisId="right" orientation="right" fontSize={12} tickLine={false} axisLine={false} width={30} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '12px' }}
                      itemStyle={{ fontSize: '12px' }}
                    />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="ito" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4, fill: 'hsl(var(--primary))' }} name="Turnover (ITO)" />
                    <Line yAxisId="right" type="monotone" dataKey="efficiency" stroke="hsl(var(--accent))" strokeWidth={3} dot={{ r: 4, fill: 'hsl(var(--accent))' }} name="Efficiency (%)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Moving Stock Distribution Trend */}
            <Card className="p-6 shadow-card border-none bg-card/50 backdrop-blur-sm">
              <h3 className="text-sm font-semibold mb-6 flex items-center gap-2">
                <Package className="w-4 h-4 text-warning" />
                Tren Klasifikasi Moving Stock
              </h3>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted))" />
                    <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '12px' }}
                      itemStyle={{ fontSize: '12px' }}
                    />
                    <Legend />
                    <Bar dataKey="veryFast" stackId="a" fill="#10b981" name="Very Fast" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="fast" stackId="a" fill="#3b82f6" name="Fast" />
                    <Bar dataKey="medium" stackId="a" fill="#f59e0b" name="Medium" />
                    <Bar dataKey="slow" stackId="a" fill="#ef4444" name="Slow" />
                    <Bar dataKey="dead" stackId="a" fill="#64748b" name="Dead Stock" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Revenue Trend */}
            <Card className="p-6 lg:col-span-2 shadow-card border-none bg-card/50 backdrop-blur-sm">
              <h3 className="text-sm font-semibold mb-6 flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                Tren Nilai Inventori vs Revenue
              </h3>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted))" />
                    <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis fontSize={12} tickLine={false} axisLine={false} width={80} 
                      tickFormatter={(val) => `Rp${(val / 1000000).toFixed(0)}M`}
                    />
                    <Tooltip 
                      formatter={(val: number) => formatCurrency(val)}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '12px' }}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorRev)" name="Total Revenue" />
                    <Area type="monotone" dataKey="stockValue" stroke="hsl(var(--accent))" fillOpacity={1} fill="url(#colorVal)" name="Inventory Value" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function TrendStat({ title, value, trend, icon, suffix = '', inverseTrendColor = false }: {
  title: string;
  value: string;
  trend: number;
  icon: React.ReactNode;
  suffix?: string;
  inverseTrendColor?: boolean;
}) {
  const isUp = trend >= 0;
  const isPositive = inverseTrendColor ? !isUp : isUp;
  
  return (
    <Card className="p-4 border-none shadow-card bg-card/50 backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        <span className="text-xs font-medium text-muted-foreground">{title}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-bold tracking-tight">{value}{suffix}</span>
        {trend !== 0 && !isNaN(trend) && (
          <div className={cn(
            "flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-full",
            isUp ? "text-emerald-600 bg-emerald-50" : "text-rose-600 bg-rose-50"
          )}>
            {isUp ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
            {Math.abs(trend).toFixed(1)}%
          </div>
        )}
      </div>
    </Card>
  );
}
