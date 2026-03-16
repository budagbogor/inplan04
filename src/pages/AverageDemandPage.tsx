import { useEffect, useState } from 'react';
import { getSOHData, formatNumber } from '@/lib/dataStore';
import { filterByActiveStores } from '@/lib/orderSettings';
import type { SOHRecord } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search } from 'lucide-react';

interface DemandRow {
  kodeProduk: string;
  namaPanjang: string;
  brand: string;
  category: string;
  salesM3: number;
  salesM2: number;
  salesM1: number;
  sales: number;
  avgDemand: number;
  soh: number;
}

export default function AverageDemandPage() {
  const [data, setData] = useState<DemandRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const soh = filterByActiveStores(await getSOHData());
      const skuMap = new Map<string, SOHRecord[]>();
      for (const r of soh) {
        if (r.soh <= 0) continue;
        if (!skuMap.has(r.kodeProduk)) skuMap.set(r.kodeProduk, []);
        skuMap.get(r.kodeProduk)!.push(r);
      }

      const rows: DemandRow[] = [];
      for (const [kodeProduk, records] of skuMap) {
        const first = records[0];
        let totalM3 = 0, totalM2 = 0, totalM1 = 0, totalSales = 0, totalSoh = 0;
        for (const r of records) {
          totalM3 += r.avgSalesM3;
          totalM2 += r.avgSalesM2;
          totalM1 += r.avgSalesM1;
          totalSales += r.sales;
          totalSoh += r.soh;
        }
        const avgDemand = (totalM3 + totalM2 + totalM1 + totalSales) / 4;
        rows.push({
          kodeProduk, namaPanjang: first.namaPanjang, brand: first.brand, category: first.category,
          salesM3: Math.round(totalM3 * 100) / 100, salesM2: Math.round(totalM2 * 100) / 100,
          salesM1: Math.round(totalM1 * 100) / 100, sales: Math.round(totalSales * 100) / 100,
          avgDemand: Math.round(avgDemand * 100) / 100, soh: totalSoh,
        });
      }

      rows.sort((a, b) => b.avgDemand - a.avgDemand);
      setData(rows);
      setLoading(false);
    })();
  }, []);

  const filtered = search
    ? data.filter(r =>
        r.kodeProduk.toLowerCase().includes(search.toLowerCase()) ||
        r.namaPanjang.toLowerCase().includes(search.toLowerCase()) ||
        r.brand.toLowerCase().includes(search.toLowerCase())
      )
    : data;

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Average Demand"
        description="Rata-rata permintaan per SKU berdasarkan data Sales (stok > 0)"
      />

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cari SKU, nama produk, atau brand..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Badge variant="secondary" className="text-xs self-start sm:self-auto">
          {formatNumber(filtered.length)} SKU
        </Badge>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Memuat data...</p>
      ) : data.length === 0 ? (
        <p className="text-muted-foreground text-sm">Belum ada data SOH. Silakan upload file SOH terlebih dahulu.</p>
      ) : (
        <div className="bg-card rounded-xl border shadow-card overflow-hidden">
          <div className="overflow-x-auto max-h-[calc(100vh-220px)]">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-10 text-center text-[10px] sm:text-xs">#</TableHead>
                  <TableHead className="text-[10px] sm:text-xs">Kode Produk</TableHead>
                  <TableHead className="text-[10px] sm:text-xs">Nama Produk</TableHead>
                  <TableHead className="text-[10px] sm:text-xs">Brand</TableHead>
                  <TableHead className="text-[10px] sm:text-xs">Category</TableHead>
                  <TableHead className="text-right text-[10px] sm:text-xs">M-3</TableHead>
                  <TableHead className="text-right text-[10px] sm:text-xs">M-2</TableHead>
                  <TableHead className="text-right text-[10px] sm:text-xs">M-1</TableHead>
                  <TableHead className="text-right text-[10px] sm:text-xs">Sales</TableHead>
                  <TableHead className="text-right font-bold text-[10px] sm:text-xs">Avg Demand</TableHead>
                  <TableHead className="text-right text-[10px] sm:text-xs">SOH</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row, i) => (
                  <TableRow key={row.kodeProduk}>
                    <TableCell className="text-center text-muted-foreground text-xs">{i + 1}</TableCell>
                    <TableCell className="font-mono text-xs">{row.kodeProduk}</TableCell>
                    <TableCell className="max-w-[180px] truncate text-xs sm:text-sm">{row.namaPanjang}</TableCell>
                    <TableCell className="text-xs sm:text-sm">{row.brand}</TableCell>
                    <TableCell className="text-xs sm:text-sm">{row.category}</TableCell>
                    <TableCell className="text-right text-xs sm:text-sm font-mono">{formatNumber(row.salesM3)}</TableCell>
                    <TableCell className="text-right text-xs sm:text-sm font-mono">{formatNumber(row.salesM2)}</TableCell>
                    <TableCell className="text-right text-xs sm:text-sm font-mono">{formatNumber(row.salesM1)}</TableCell>
                    <TableCell className="text-right text-xs sm:text-sm font-mono">{formatNumber(row.sales)}</TableCell>
                    <TableCell className="text-right font-bold text-primary text-xs sm:text-sm font-mono">{formatNumber(row.avgDemand)}</TableCell>
                    <TableCell className="text-right text-xs sm:text-sm font-mono">{formatNumber(row.soh)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
