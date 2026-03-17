import { BookOpen, Upload, Settings, BarChart3, ShoppingCart, Store, ArrowRight, CheckCircle2, ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';
import { PageHeader } from '@/components/PageHeader';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

function StepCard({
  icon: Icon,
  title,
  description,
  step,
  delay
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  step: number;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="relative flex flex-col md:flex-row gap-4 p-6 bg-card rounded-xl border shadow-sm hover:shadow-md transition-shadow group"
    >
      <div className="flex-shrink-0">
        <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
          <Icon className="w-6 h-6" />
        </div>
      </div>
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-accent/20 text-accent text-xs font-bold font-mono">
            {step}
          </span>
          <h3 className="text-lg font-bold text-foreground">{title}</h3>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
      </div>
    </motion.div>
  );
}

function Section({
  icon: Icon,
  title,
  description,
  defaultOpen = false,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <button className="w-full text-left">
            <CardHeader className={cn("pb-0", !open && "pb-4")}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className="w-4 h-4 text-accent shrink-0" />
                  <CardTitle className="text-sm sm:text-base truncate">{title}</CardTitle>
                </div>
                <ChevronDown className={cn("w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200", open && "rotate-180")} />
              </div>
              <CardDescription className="text-xs mt-1">{description}</CardDescription>
            </CardHeader>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-4">
            {children}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function FormulaItem({ num, title, formula, description }: { num: string; title: string; formula: string; description: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3 sm:p-4 space-y-1.5">
      <p className="text-xs sm:text-sm font-semibold text-foreground">{num}. {title}</p>
      <p className="text-[10px] sm:text-xs font-mono text-accent bg-accent/5 rounded px-2 py-1 inline-block">{formula}</p>
      <p className="text-[10px] sm:text-xs text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}

export default function GuidePage() {
  const steps = [
    {
      icon: Upload,
      title: "Upload Data SOH & Penjualan",
      description: "Langkah pertama: Beralih ke halaman Upload Data. Tarik & letakkan file Excel berisi data stok (SOH Jakarta & Surabaya) serta histori penjualan. Data akan disimpan secara aman di database Cloud (Supabase) sehingga dapat diakses kapan saja."
    },
    {
      icon: Settings,
      title: "Atur Parameter & Filter",
      description: "Pastikan parameter perhitungan sudah sesuai. Anda dapat menyesuaikan Safety Stock Factor, Lead Time, serta memfilter data berdasarkan toko, vendor, brand, atau divisi tertentu untuk hasil analisa yang lebih spesifik."
    },
    {
      icon: BarChart3,
      title: "Pantau Dashboard & Moving Stock",
      description: "Data diproses otomatis. Di Dashboard, pantau ringkasan stok kritis. Di halaman Moving Stock, klik pada baris SKU untuk melihat detail ketersediaan stok di setiap cabang toko secara mendalam."
    },
    {
      icon: Store,
      title: "Klasifikasi ABC & Detail Cabang",
      description: "Gunakan Klasifikasi ABC untuk melihat SKU paling berkontribusi (Pareto). Anda dapat memeriksa detail rekomendasi order spesifik untuk masing-masing cabang di menu Suggest Order Per Toko."
    },
    {
      icon: ShoppingCart,
      title: "Evaluasi Rekomendasi Pemesanan (PO)",
      description: "Sistem menghitung Reorder Point otomatis. Di menu Suggest Order per SKU atau PO to Supplier, Anda bisa menyetujui, merevisi kuantitas berdasarkan MOQ vendor, lalu mengekspor laporan PO yang siap dikirim."
    }
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <PageHeader 
        title="Panduan Penggunaan" 
        description="Pelajari alur kerja Mobeng Inventory Planner langkah demi langkah."
      />

      <div className="grid gap-6">
        {steps.map((step, index) => (
          <div key={index} className="relative">
            {/* Connecting Line (hidden on the last item) */}
            {index !== steps.length - 1 && (
              <div className="hidden md:block absolute left-12 top-[4.5rem] bottom-[-2.5rem] w-px bg-border -translate-x-1/2 z-[-1]" />
            )}
            
            <StepCard 
              step={index + 1}
              icon={step.icon}
              title={step.title}
              description={step.description}
              delay={0.1 * index}
            />
            
            {/* Mobile connecting arrow */}
            {index !== steps.length - 1 && (
              <div className="md:hidden flex justify-center py-2 text-muted-foreground/30">
                <ArrowRight className="w-5 h-5 rotate-90" />
              </div>
            )}
          </div>
        ))}

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-6 p-6 rounded-2xl bg-gradient-to-br from-success/20 to-success/5 border border-success/30 flex items-center justify-center text-center gap-4 flex-col sm:flex-row"
        >
          <div className="w-12 h-12 flex items-center justify-center rounded-full bg-success/20 text-success shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <p className="text-success-foreground font-medium text-lg leading-tight">
            Anda siap menggunakan Mobeng Inventory Planner!
          </p>
        </motion.div>

        <Section icon={BookOpen} title="Formula Perhitungan" description="Penjelasan setiap formula yang digunakan sistem untuk menghitung rekomendasi order" defaultOpen>
          <div className="space-y-4">
            <FormulaItem
              num="1"
              title="Average Daily Demand (Rata-rata Permintaan Harian)"
              formula="(Sales M3 + M2 + M1 + Sales) / 4 / 30"
              description="Menghitung rata-rata penjualan harian suatu SKU berdasarkan data 4 bulan terakhir. Angka ini menjadi dasar utama seluruh perhitungan persediaan."
            />
            <FormulaItem
              num="2"
              title="Safety Stock (Stok Pengaman)"
              formula="Avg Daily × √Lead Time × Demand Factor + Avg Daily × LT Factor"
              description="Menjaga ketersediaan stok dari dua risiko: (1) Variabilitas demand — lonjakan permintaan; (2) Ketidakpastian lead time — keterlambatan pengiriman."
            />
            <FormulaItem
              num="3"
              title="Reorder Point / ROP (Titik Pemesanan Ulang)"
              formula="(Avg Daily × Lead Time) + Safety Stock"
              description="Level stok minimum di mana pesanan baru harus dilakukan. SOH < 50% ROP = Kritis, SOH < ROP = Rendah."
            />
            <FormulaItem
              num="4"
              title="Order Up To Level (Level Stok Maksimal Target)"
              formula="Avg Daily × (Lead Time + Review Period) + Safety Stock"
              description="Jumlah stok ideal setelah pesanan diterima, cukup untuk memenuhi permintaan sampai siklus pemesanan berikutnya."
            />
            <FormulaItem
              num="5"
              title="Suggested Order (Rekomendasi Jumlah Pesanan)"
              formula="max(0, Order Up To − SOH), dibulatkan ke MOQ"
              description="Berapa banyak unit yang perlu dipesan agar stok kembali ke level optimal. Dibulatkan ke atas sesuai kelipatan MOQ."
            />

            <div className="rounded-lg border border-info/30 bg-info/5 p-4 space-y-1.5">
              <p className="text-sm font-semibold text-foreground">📊 Klasifikasi Prioritas</p>
              <div className="text-xs text-muted-foreground leading-relaxed space-y-1">
                <p><span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-destructive/10 text-destructive border-destructive/30 mr-1">Kritis</span> SOH = 0 atau SOH &lt; 50% dari ROP</p>
                <p><span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-warning/10 text-warning border-warning/30 mr-1">Rendah</span> SOH di bawah ROP</p>
                <p><span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-info/10 text-info border-info/30 mr-1">Normal</span> SOH di antara ROP dan Order Up To</p>
                <p><span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-success/10 text-success border-success/30 mr-1">Overstock</span> SOH &gt; 150% dari Order Up To</p>
              </div>
            </div>

            <div className="rounded-lg border border-accent/30 bg-accent/5 p-4 space-y-1.5">
              <p className="text-sm font-semibold text-foreground">📦 Klasifikasi ABC (Analisis Pareto)</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Mengelompokkan SKU di setiap toko berdasarkan kontribusi nilai persediaan (SOH × HPP) menggunakan prinsip Pareto.
              </p>
              <p className="text-xs font-mono text-accent bg-accent/5 rounded px-2 py-1 inline-block mt-1">Nilai HPP = SOH × Rata-rata HPP per unit</p>
              <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                SKU diurutkan dari nilai HPP tertinggi ke terendah, lalu dihitung persentase kumulatif.
              </p>
              <div className="mt-2 text-xs text-muted-foreground leading-relaxed space-y-1">
                <p><span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-destructive/10 text-destructive border-destructive/30 mr-1">A</span> Kumulatif ≤ 80% — ~20% SKU menguasai ~80% nilai</p>
                <p><span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-warning/10 text-warning border-warning/30 mr-1">B</span> Kumulatif 80–95% — nilai sedang, monitoring berkala</p>
                <p><span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-info/10 text-info border-info/30 mr-1">C</span> Kumulatif &gt; 95% — jumlah banyak, kontribusi kecil</p>
              </div>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
