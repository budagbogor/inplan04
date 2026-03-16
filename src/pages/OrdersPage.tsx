import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ShoppingCart, AlertTriangle, Search, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { getSOHData, formatNumber } from '@/lib/dataStore';
import { getOrderSettings, filterByActiveStores } from '@/lib/orderSettings';
import { calculateStoreOrders } from '@/lib/storeOrders';
import type { SOHRecord } from '@/lib/types';
import * as XLSX from 'xlsx';

const priorityConfig = {
  critical: { label: 'Kritis', className: 'bg-destructive/10 text-destructive border-destructive/30' },
  low: { label: 'Rendah', className: 'bg-warning/10 text-warning border-warning/30' },
  normal: { label: 'Normal', className: 'bg-info/10 text-info border-info/30' },
  overstock: { label: 'Overstock', className: 'bg-success/10 text-success border-success/30' },
};

interface SkuOrder {
  kodeProduk: string;
  namaPanjang: string;
  brand: string;
  category: string;
  supplier: string;
  totalStock: number;
  avgDailyDemand: number;
  moq: number;
  suggestedQty: number;
  priority: 'critical' | 'low' | 'normal' | 'overstock';
}

/**
 * Aggregates per-store suggested orders (from calculateStoreOrders) into per-SKU totals.
 * Sum suggestedQty across stores for each SKU, then round up to MOQ.
 */
function aggregateToSkuOrders(soh: SOHRecord[], settings: ReturnType<typeof getOrderSettings>): SkuOrder[] {
  const storeSummaries = calculateStoreOrders(soh, settings);

  const priorityOrder = { critical: 0, low: 1, normal: 2, overstock: 3 };

  // Aggregate all store items by kodeProduk
  const skuMap = new Map<string, {
    kodeProduk: string;
    namaPanjang: string;
    brand: string;
    category: string;
    supplier: string;
    totalStock: number;
    totalAvgDaily: number;
    totalSuggestedQty: number;
    moq: number;
    worstPriority: 'critical' | 'low' | 'normal' | 'overstock';
  }>();

  for (const store of storeSummaries) {
    for (const item of store.items) {
      const existing = skuMap.get(item.kodeProduk);
      if (!existing) {
        skuMap.set(item.kodeProduk, {
          kodeProduk: item.kodeProduk,
          namaPanjang: item.namaPanjang,
          brand: item.brand,
          category: item.category,
          supplier: item.supplier,
          totalStock: item.soh,
          totalAvgDaily: item.avgDailyDemand,
          totalSuggestedQty: item.suggestedQty,
          moq: item.moq,
          worstPriority: item.priority,
        });
      } else {
        existing.totalStock += item.soh;
        existing.totalAvgDaily += item.avgDailyDemand;
        existing.totalSuggestedQty += item.suggestedQty;
        // Keep worst priority
        if (priorityOrder[item.priority] < priorityOrder[existing.worstPriority]) {
          existing.worstPriority = item.priority;
        }
      }
    }
  }

  const orders: SkuOrder[] = [];
  for (const entry of skuMap.values()) {
    let suggestedQty = entry.totalSuggestedQty;
    // Round up total to MOQ
    if (entry.moq > 1 && suggestedQty > 0) {
      suggestedQty = Math.ceil(suggestedQty / entry.moq) * entry.moq;
    }

    orders.push({
      kodeProduk: entry.kodeProduk,
      namaPanjang: entry.namaPanjang,
      brand: entry.brand,
      category: entry.category,
      supplier: entry.supplier,
      totalStock: entry.totalStock,
      avgDailyDemand: Math.round(entry.totalAvgDaily * 100) / 100,
      moq: entry.moq,
      suggestedQty,
      priority: entry.worstPriority,
    });
  }

  orders.sort((a, b) => {
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) return priorityOrder[a.priority] - priorityOrder[b.priority];
    return b.suggestedQty - a.suggestedQty;
  });

  return orders;
}

export default function OrdersPage() {
  const [soh, setSoh] = useState<SOHRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSOHData().then(d => { setSoh(filterByActiveStores(d)); setLoading(false); });
  }, []);

  const settings = useMemo(() => getOrderSettings(), []);
  const allOrders = useMemo(() => aggregateToSkuOrders(soh, settings), [soh, settings]);

  const [search, setSearch] = useState('');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const filtered = useMemo(() => {
    setPage(1);
    return allOrders.filter(o => {
      if (filterPriority !== 'all' && o.priority !== filterPriority) return false;
      if (search) {
        const q = search.toLowerCase();
        return o.namaPanjang.toLowerCase().includes(q) ||
          o.kodeProduk.toLowerCase().includes(q) ||
          o.brand.toLowerCase().includes(q);
      }
      return true;
    });
  }, [allOrders, search, filterPriority]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const criticalCount = allOrders.filter(o => o.priority === 'critical').length;
  const lowCount = allOrders.filter(o => o.priority === 'low').length;

  const exportToExcel = () => {
    const data = filtered.map(o => ({
      'Kode Produk': o.kodeProduk, 'Nama Produk': o.namaPanjang,
      'Brand': o.brand, 'Kategori': o.category, 'Supplier': o.supplier,
      'Total Stok': o.totalStock, 'Avg/Hari': o.avgDailyDemand,
      'MOQ': o.moq, 'Order Qty': o.suggestedQty,
      'Prioritas': priorityConfig[o.priority].label,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Suggested Orders');
    XLSX.writeFile(wb, `Suggested_Orders_SKU_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground text-sm">Memuat data...</div>;

  if (allOrders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="p-4 rounded-2xl bg-accent/10 mb-4">
          <ShoppingCart className="w-10 h-10 text-accent" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Belum Ada Rekomendasi</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm">Upload data SOH untuk generate rekomendasi order per SKU</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader title="Suggest Order per SKU" description="Rekomendasi order per SKU berdasarkan total stok dan rata-rata penjualan semua toko">
        <Button onClick={exportToExcel} variant="outline" size="sm" className="gap-2">
          <Download className="w-4 h-4" /> Export
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <StatCard title="Total SKU" value={formatNumber(allOrders.length)} icon={ShoppingCart} variant="accent" />
        <StatCard title="Kritis (Segera)" value={formatNumber(criticalCount)} icon={AlertTriangle} variant="destructive" />
        <StatCard title="Stok Rendah" value={formatNumber(lowCount)} icon={AlertTriangle} variant="warning" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Cari produk..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="px-3 py-2 rounded-lg border bg-card text-sm text-foreground"
        >
          <option value="all">Semua Prioritas</option>
          <option value="critical">Kritis</option>
          <option value="low">Rendah</option>
          <option value="normal">Normal</option>
        </select>
      </div>

      <div className="bg-card rounded-xl border shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-3 sm:px-4 py-3 text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">Prioritas</th>
                <th className="text-left px-3 sm:px-4 py-3 text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">Produk</th>
                <th className="text-right px-3 sm:px-4 py-3 text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Stok</th>
                <th className="text-right px-3 sm:px-4 py-3 text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">Avg/Hari</th>
                <th className="text-right px-3 sm:px-4 py-3 text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">MOQ</th>
                <th className="text-right px-3 sm:px-4 py-3 text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider font-bold">Order</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((order, i) => {
                const p = priorityConfig[order.priority];
                return (
                  <motion.tr
                    key={order.kodeProduk}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.01, 0.3) }}
                    className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-3 sm:px-4 py-2.5">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${p.className}`}>
                        {p.label}
                      </span>
                    </td>
                    <td className="px-3 sm:px-4 py-2.5">
                      <p className="font-medium text-foreground text-xs truncate max-w-[250px]">{order.namaPanjang}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{order.kodeProduk} • {order.brand}</p>
                    </td>
                    <td className="px-3 sm:px-4 py-2.5 text-right font-mono text-xs">{formatNumber(order.totalStock)}</td>
                    <td className="px-3 sm:px-4 py-2.5 text-right font-mono text-xs">{order.avgDailyDemand}</td>
                    <td className="px-3 sm:px-4 py-2.5 text-right font-mono text-xs">{order.moq > 1 ? formatNumber(order.moq) : '-'}</td>
                    <td className="px-3 sm:px-4 py-2.5 text-right font-mono text-xs font-bold text-accent">{formatNumber(order.suggestedQty)}</td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <p className="text-xs text-muted-foreground">
              {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} dari {filtered.length} SKU
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline" size="icon"
                className="h-8 w-8"
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, idx) => {
                let p: number;
                if (totalPages <= 5) {
                  p = idx + 1;
                } else if (page <= 3) {
                  p = idx + 1;
                } else if (page >= totalPages - 2) {
                  p = totalPages - 4 + idx;
                } else {
                  p = page - 2 + idx;
                }
                return (
                  <Button
                    key={p}
                    variant={p === page ? 'default' : 'outline'}
                    size="icon"
                    className="h-8 w-8 text-xs"
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </Button>
                );
              })}
              <Button
                variant="outline" size="icon"
                className="h-8 w-8"
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
