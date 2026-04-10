import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { ShieldAlert, AlertTriangle, CheckCircle2, PackageX, TrendingDown, ArrowRight } from 'lucide-react';
import { formatCurrency } from '@/lib/dataStore';
import { cn } from '@/lib/utils';
import type { AIAnalysisResult } from '@/lib/aiAgent';

interface AIGraphicsProps {
  stats: AIAnalysisResult['stats'];
}

export function AIGraphics({ stats }: AIGraphicsProps) {
  // Data for Moving Class Distribution Pie Chart
  const pieData = [
    { name: 'Fast Moving', value: stats.fastMoving, color: '#10b981' }, // emerald-500
    { name: 'Slow Moving', value: stats.slowMoving, color: '#f59e0b' }, // amber-500
    { name: 'Non/Dead Stock', value: stats.nonMoving, color: '#ef4444' }, // red-500
  ].filter(d => d.value > 0);

  const totalSKU = stats.totalSohItem;
  
  // Threat Math
  const deadStockPercent = totalSKU > 0 ? (stats.deadStockTags / totalSKU) * 100 : 0;
  const oosPercent = totalSKU > 0 ? (stats.zeroStockItems / totalSKU) * 100 : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
      {/* 1. Pemborosan Modal (Waste) & Moving Class */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-muted/20 rounded-2xl p-5 border border-muted"
      >
        <div className="flex items-center gap-2 mb-4">
          <TrendingDown className="w-5 h-5 text-amber-500" />
          <h4 className="font-bold text-sm text-foreground">Distribusi Pergerakan (SKU)</h4>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="h-28 w-28 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={30}
                  outerRadius={45}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => [`${value} SKU`, 'Jumlah']}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          
          <div className="flex-1 space-y-2">
            {pieData.map(item => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-muted-foreground">{item.name}</span>
                </div>
                <span className="font-semibold text-foreground">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* 2. Peringatan Ancaman Sistem (Tag H/D/N & Tag W) */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-red-500/5 rounded-2xl p-5 border border-red-500/20"
      >
        <div className="flex items-center gap-2 mb-4">
          <ShieldAlert className="w-5 h-5 text-red-500" />
          <h4 className="font-bold text-sm text-foreground">Peringatan Tag & Risiko</h4>
        </div>

        <div className="space-y-5">
          {/* Tag H/D/N Alert */}
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="font-semibold text-red-600 dark:text-red-400">Purgatory (Tag H/D/N)</span>
              <span className="font-bold text-red-600 dark:text-red-400">{stats.deadStockTags} SKU</span>
            </div>
            <div className="h-2 w-full bg-red-100 dark:bg-red-950 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: Math.min(deadStockPercent, 100) + '%' }}
                transition={{ duration: 1, delay: 0.5 }}
                className="h-full bg-red-500 rounded-full"
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5 leading-tight">
              Tertahan senilai <strong className="text-foreground">{formatCurrency(stats.deadStockTagsValue)}</strong>. Murni waste, tidak boleh diorder!
            </p>
          </div>

          {/* OOS Risk for Tag W */}
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="font-semibold text-amber-600 dark:text-amber-400">Total Out of Stock (0 Murni)</span>
              <span className="font-bold text-amber-600 dark:text-amber-400">{stats.zeroStockItems} SKU</span>
            </div>
            <div className="h-2 w-full bg-amber-100 dark:bg-amber-950/30 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: Math.min(oosPercent, 100) + '%' }}
                transition={{ duration: 1, delay: 0.7 }}
                className="h-full bg-amber-500 rounded-full"
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5 leading-tight">
              Risiko Lost Sales tinggi. Evaluasi segera pemenuhan Tag W ({stats.tagW_SKU} SKU) agar aman.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
