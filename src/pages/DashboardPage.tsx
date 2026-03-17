import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Package, TrendingUp, DollarSign, BarChart3, Boxes, Tags, CheckCircle, Warehouse } from 'lucide-react';
import { StatCard } from '@/components/StatCard';
import { PageHeader } from '@/components/PageHeader';
import { getSalesData, getSOHData, getSkuSummaries, formatCurrency, formatNumber } from '@/lib/dataStore';
import { filterByActiveStores } from '@/lib/orderSettings';
import { useNavigate } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { SalesRecord, SOHRecord } from '@/lib/types';
import { DemandVsStockChart } from '@/components/DemandVsStockChart';

export default function DashboardPage() {
  const [sales, setSales] = useState<SalesRecord[]>([]);
  const [soh, setSoh] = useState<SOHRecord[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([getSalesData(), getSOHData()]).then(([s, h]) => {
      setSales(filterByActiveStores(s)); setSoh(filterByActiveStores(h)); setLoading(false);
    });
  }, []);

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
      <PageHeader title="Dashboard" description="Ringkasan penjualan dan inventori nasional" />

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
    </div>
  );
}
