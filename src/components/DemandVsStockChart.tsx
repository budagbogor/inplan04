import { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Line, ComposedChart } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatNumber } from '@/lib/dataStore';
import type { SOHRecord } from '@/lib/types';

interface Props {
  soh: SOHRecord[];
}

export function DemandVsStockChart({ soh }: Props) {
  const [selectedStore, setSelectedStore] = useState<string>('all');
  const avgDemandColor = 'hsl(var(--chart-2))';
  const sohColor = 'hsl(var(--chart-1))';
  const maxStockColor = 'hsl(var(--destructive))';

  const storeList = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of soh) map.set(r.kodeToko, r.namaToko);
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [soh]);

  const chartData = useMemo(() => {
    const filtered = selectedStore === 'all' ? soh : soh.filter(r => r.kodeToko === selectedStore);

    // Aggregate per SKU
    const skuMap = new Map<string, {
      kodeProduk: string;
      namaPanjang: string;
      totalSoh: number;
      totalAvgDemand: number;
      totalMaxStock: number;
    }>();

    for (const r of filtered) {
      const existing = skuMap.get(r.kodeProduk);
      const avgDemand = (r.avgSalesM3 + r.avgSalesM2 + r.avgSalesM1 + r.sales) / 4;
      if (existing) {
        existing.totalSoh += r.soh;
        existing.totalAvgDemand += avgDemand;
        existing.totalMaxStock += r.maxStock;
      } else {
        skuMap.set(r.kodeProduk, {
          kodeProduk: r.kodeProduk,
          namaPanjang: r.namaPanjang,
          totalSoh: r.soh,
          totalAvgDemand: avgDemand,
          totalMaxStock: r.maxStock,
        });
      }
    }

    return Array.from(skuMap.values())
      .map(s => ({
        sku: s.kodeProduk,
        name: s.namaPanjang.length > 25 ? s.namaPanjang.substring(0, 25) + '…' : s.namaPanjang,
        fullName: s.namaPanjang,
        avgDemand: Math.round(s.totalAvgDemand * 100) / 100,
        soh: s.totalSoh,
        maxStock: s.totalMaxStock,
      }))
      .sort((a, b) => b.avgDemand - a.avgDemand)
      .slice(0, 50);
  }, [soh, selectedStore]);

  if (soh.length === 0) return null;

  return (
    <div className="bg-card rounded-xl border shadow-card">
      <div className="px-4 sm:px-5 py-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Top 50 SKU: Avg Demand vs Stock on Hand</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Perbandingan rata-rata permintaan dengan stok tersedia, termasuk DSI</p>
        </div>
        <Select value={selectedStore} onValueChange={setSelectedStore}>
          <SelectTrigger className="w-full sm:w-[220px] h-8 text-xs">
            <SelectValue placeholder="Semua Toko" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Toko (Total)</SelectItem>
            {storeList.map(([kode, nama]) => (
              <SelectItem key={kode} value={kode}>
                <span className="truncate">{nama}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="p-4 sm:p-5">
        <div className="w-full" style={{ height: Math.max(400, chartData.length * 18 + 80) }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              layout="vertical"
              data={chartData}
              margin={{ top: 10, right: 40, left: 10, bottom: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
              <XAxis type="number" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
              <YAxis
                dataKey="sku"
                type="category"
                width={90}
                tick={{ fontSize: 9 }}
                className="fill-muted-foreground"
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0]?.payload;
                  return (
                    <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-xl">
                      <p className="font-semibold text-foreground mb-1">{d?.fullName}</p>
                      <p className="font-mono text-muted-foreground">{d?.sku}</p>
                      <div className="mt-2 space-y-1">
                        <p><span className="inline-block w-2.5 h-2.5 rounded-sm mr-1.5" style={{ backgroundColor: avgDemandColor }} />Avg Demand: <span className="font-semibold">{formatNumber(d?.avgDemand)}</span></p>
                        <p><span className="inline-block w-2.5 h-2.5 rounded-sm mr-1.5" style={{ backgroundColor: sohColor }} />SOH: <span className="font-semibold">{formatNumber(d?.soh)}</span></p>
                        <p><span className="inline-block w-2.5 h-2.5 rounded-sm mr-1.5" style={{ backgroundColor: maxStockColor }} />Max Stock: <span className="font-semibold">{formatNumber(d?.maxStock)}</span></p>
                      </div>
                    </div>
                  );
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 11 }}
                formatter={(value: string) => <span className="text-muted-foreground text-xs">{value}</span>}
              />
              <Bar dataKey="avgDemand" name="Avg Demand" fill={avgDemandColor} barSize={8} radius={[0, 4, 4, 0]} />
              <Bar dataKey="soh" name="Stock on Hand" fill={sohColor} barSize={8} radius={[0, 4, 4, 0]} />
              <Line dataKey="maxStock" name="Max Stock" stroke={maxStockColor} strokeWidth={2} dot={{ r: 2 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
