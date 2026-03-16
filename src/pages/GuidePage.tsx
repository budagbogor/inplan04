import { BookOpen, Upload, Settings, BarChart3, ShoppingCart, Store, ArrowRight, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { PageHeader } from '@/components/PageHeader';

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

export default function GuidePage() {
  const steps = [
    {
      icon: Settings,
      title: "Atur Parameter di Pengaturan",
      description: "Sebelum mulai, pastikan untuk memeriksa halaman Pengaturan. Anda dapat menyesuaikan filter toko (seperti menonaktifkan DC Surabaya), vendor, divisi, maupun Brand. Anda juga bisa mengatur Safety Stock Factor, Service Level, dan Lead Time."
    },
    {
      icon: Upload,
      title: "Upload Data SOH & Penjualan",
      description: "Beralih ke halaman Upload Data. Tarik & letakkan file Excel berisi data stok (SOH Jakarta & SOH Surabaya) serta histori penjualan (Sales MTD/Nett Sales) ke dalam area drop zone yang tersedia. Konfirmasi setiap tipe file."
    },
    {
      icon: BarChart3,
      title: "Pantau Dashboard Utama",
      description: "Data akan diproses secara otomatis. Di halaman Dashboard, Anda bisa memantau Ringkasan Inventory (berapa SKU yang butuh restock, overstock, atau kritis) serta melacak total nilai kapital pemesanan yang disarankan."
    },
    {
      icon: Store,
      title: "Cek Analisa & Ketersediaan Level Toko",
      description: "Gunakan menu Klasifikasi ABC untuk melihat SKU paling berharga (kategori A/B/C) berdasarkan nilai pergerakan. Anda kemudian dapat memeriksa detail suggest order spesifik tiap cabang via Suggest Order Per Toko."
    },
    {
      icon: ShoppingCart,
      title: "Evaluasi Rekomendasi Pemesanan (PO)",
      description: "Di menu Suggest Order per SKU maupun PO to Supplier, sistem telah menghitung rumusan reorder point otomatis (bisa dicek detil formulanya di pengaturan). Setujui, revisi kuantitas MOQ, atau ekspor laporan purchase order siap pesan."
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
      </div>
    </div>
  );
}
