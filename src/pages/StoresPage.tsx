import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Store, AlertTriangle, Package, ChevronDown, ChevronUp, Search, Download } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getSOHData, formatNumber, getUploadedFiles } from '@/lib/dataStore';
import { getOrderSettings, filterByActiveStores } from '@/lib/orderSettings';
import { calculateStoreOrders } from '@/lib/storeOrders';
import type { SOHRecord } from '@/lib/types';
import ExcelJS from 'exceljs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const priorityConfig = {
  critical: { label: 'Kritis', className: 'bg-destructive/10 text-destructive border-destructive/30' },
  low: { label: 'Rendah', className: 'bg-warning/10 text-warning border-warning/30' },
  normal: { label: 'Normal', className: 'bg-info/10 text-info border-info/30' },
  overstock: { label: 'Overstock', className: 'bg-success/10 text-success border-success/30' },
};

export default function StoresPage() {
  const [soh, setSoh] = useState<SOHRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedStore, setExpandedStore] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [availablePeriods, setAvailablePeriods] = useState<string[]>([]);
  const [currentPeriod, setCurrentPeriod] = useState<string>('');

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
    getSOHData(currentPeriod).then(d => { setSoh(filterByActiveStores(d)); setLoading(false); });
  }, [currentPeriod, availablePeriods.length]);

  const settings = useMemo(() => getOrderSettings(), []);
  const stores = useMemo(() => calculateStoreOrders(soh, settings), [soh, settings]);

  const filtered = useMemo(() => {
    if (!search) return stores;
    const q = search.toLowerCase();
    return stores.filter(s =>
      s.namaToko.toLowerCase().includes(q) ||
      s.kodeToko.toLowerCase().includes(q) ||
      s.items.some(i => i.kodeProduk.toLowerCase().includes(q) || i.namaPanjang.toLowerCase().includes(q))
    );
  }, [stores, search]);

  const totalCritical = stores.reduce((s, st) => s + st.criticalCount, 0);
  const totalSkuToOrder = stores.reduce((s, st) => s + st.totalSkuToOrder, 0);

  const exportAll = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Store Orders');

    worksheet.columns = [
      { header: 'Kode Toko', key: 'kodeToko', width: 12 },
      { header: 'Nama Toko', key: 'namaToko', width: 25 },
      { header: 'Kode Produk', key: 'kodeProduk', width: 15 },
      { header: 'Nama Produk', key: 'namaPanjang', width: 30 },
      { header: 'Brand', key: 'brand', width: 15 },
      { header: 'Supplier', key: 'supplier', width: 15 },
      { header: 'SOH', key: 'soh', width: 10 },
      { header: 'Avg Daily', key: 'avgDailyDemand', width: 10 },
      { header: 'Lead Time', key: 'leadTimeDays', width: 10 },
      { header: 'Safety Stock', key: 'safetyStock', width: 12 },
      { header: 'ROP', key: 'rop', width: 12 },
      { header: 'Order Up To', key: 'maxStock', width: 12 },
      { header: 'Suggest Qty', key: 'suggestedQty', width: 12 },
      { header: 'MOQ', key: 'moq', width: 10 },
      { header: 'Prioritas', key: 'priority', width: 12 },
    ];

    stores.flatMap(st =>
      st.items.map(i => ({
        kodeToko: st.kodeToko,
        namaToko: st.namaToko,
        kodeProduk: i.kodeProduk,
        namaPanjang: i.namaPanjang,
        brand: i.brand,
        supplier: i.supplier,
        soh: i.soh,
        avgDailyDemand: i.avgDailyDemand,
        leadTimeDays: i.leadTimeDays,
        safetyStock: i.safetyStock,
        rop: i.rop,
        maxStock: i.maxStock,
        suggestedQty: i.suggestedQty,
        moq: i.moq,
        priority: priorityConfig[i.priority].label,
      }))
    ).forEach(row => worksheet.addRow(row));

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `Store_Orders_${new Date().toISOString().slice(0, 10)}.xlsx`;
    anchor.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground text-sm">Memuat data...</div>;

  if (stores.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="p-4 rounded-2xl bg-accent/10 mb-4">
          <Store className="w-10 h-10 text-accent" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Belum Ada Data</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm">Upload data SOH untuk melihat rekomendasi order per toko</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader title="Suggest Order Per Toko" description={`${stores.length} toko dengan SKU perlu diorder`}>
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-end w-full sm:w-auto mt-2 sm:mt-0">
          {availablePeriods.length > 0 && (
            <div className="flex items-center gap-2 mr-0 sm:mr-2">
              <span className="text-xs font-medium text-muted-foreground whitespace-nowrap hidden sm:inline">Periode:</span>
              <Select value={currentPeriod} onValueChange={setCurrentPeriod}>
                <SelectTrigger className="w-[120px] sm:w-[140px] bg-card h-8 text-xs border-muted-foreground/20">
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
          <Button onClick={exportAll} variant="outline" size="sm" className="gap-2">
            <Download className="w-4 h-4" /> Export
          </Button>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <StatCard title="Total Toko" value={formatNumber(stores.length)} icon={Store} variant="accent" />
        <StatCard title="SKU Perlu Order" value={formatNumber(totalSkuToOrder)} icon={Package} variant="warning" />
        <StatCard title="SKU Kritis" value={formatNumber(totalCritical)} icon={AlertTriangle} variant="destructive" />
      </div>

      <div className="relative max-w-full sm:max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Cari toko atau produk..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
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
                    <Store className="w-4 sm:w-5 h-4 sm:h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs sm:text-sm font-semibold text-foreground truncate">{store.namaToko}</h3>
                    <p className="text-[10px] text-muted-foreground font-mono">{store.kodeToko} • {store.namaCabang}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 sm:gap-4 shrink-0 pl-11 sm:pl-0">
                  <div className="text-left sm:text-right">
                    <p className="text-[10px] text-muted-foreground">SKU</p>
                    <p className="text-xs sm:text-sm font-bold font-mono text-foreground">{store.totalSkuToOrder}</p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-[10px] text-muted-foreground">Qty</p>
                    <p className="text-xs sm:text-sm font-bold font-mono text-accent">{formatNumber(store.totalOrderQty)}</p>
                  </div>
                  {store.criticalCount > 0 && (
                    <Badge variant="destructive" className="text-[10px]">
                      {store.criticalCount} kritis
                    </Badge>
                  )}
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
              </button>

              {isExpanded && (
                <div className="border-t overflow-x-auto">
                  <table className="w-full text-sm min-w-[800px]">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="text-left px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Prioritas</th>
                        <th className="text-left px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Produk</th>
                        <th className="text-left px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Supplier</th>
                        <th className="text-right px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">SOH</th>
                        <th className="text-right px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Avg/Hari</th>
                        <th className="text-right px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">LT</th>
                        <th className="text-right px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">SS</th>
                        <th className="text-right px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">ROP</th>
                        <th className="text-right px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Max</th>
                        <th className="text-right px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">MOQ</th>
                        <th className="text-right px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider font-bold">Order</th>
                      </tr>
                    </thead>
                    <tbody>
                      {store.items.map((item, j) => {
                        const p = priorityConfig[item.priority];
                        return (
                          <tr key={`${item.kodeProduk}-${j}`} className="border-t hover:bg-muted/20 transition-colors">
                            <td className="px-3 py-2">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${p.className}`}>
                                {p.label}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <p className="font-medium text-foreground text-xs truncate max-w-[200px]">{item.namaPanjang}</p>
                              <p className="text-[10px] text-muted-foreground font-mono">{item.kodeProduk} • {item.brand}</p>
                            </td>
                            <td className="px-3 py-2 text-xs text-muted-foreground truncate max-w-[120px]">{item.supplier || '-'}</td>
                            <td className="px-3 py-2 text-right font-mono text-xs">{formatNumber(item.soh)}</td>
                            <td className="px-3 py-2 text-right font-mono text-xs">{item.avgDailyDemand}</td>
                            <td className="px-3 py-2 text-right font-mono text-xs">{item.leadTimeDays}</td>
                            <td className="px-3 py-2 text-right font-mono text-xs">{formatNumber(item.safetyStock)}</td>
                            <td className="px-3 py-2 text-right font-mono text-xs">{formatNumber(item.rop)}</td>
                            <td className="px-3 py-2 text-right font-mono text-xs">{formatNumber(item.maxStock)}</td>
                            <td className="px-3 py-2 text-right font-mono text-xs">{item.moq > 1 ? formatNumber(item.moq) : '-'}</td>
                            <td className="px-3 py-2 text-right font-mono text-xs font-bold text-accent">{formatNumber(item.suggestedQty)}</td>
                          </tr>
                        );
                      })}
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
