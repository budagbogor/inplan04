# Mobeng Inventory Planner 📦

Sistem aplikasi web cerdas untuk memantau, merencanakan, dan mengklasifikasikan operasional manajemen persediaan (SOH & Sales) dari berbagai cabang toko dengan perhitungan rekomendasi Reorder otomatis.

## ✨ Fitur Utama (Core Features)

1. **Unggah Data Otomatis (Upload)**
   Langkah awal untuk memulai analisa. Mendukung parsing multi-file Excel untuk *Report Daily Nett Sales* dan *Stok On Hand (SOH)* cabang Jakarta dan Surabaya. Data tersimpan aman di cloud.

2. **Dashboard & Analitik Komprehensif**
   Tinjau performa SKU (Service Level), identifikasi *Overstock / Kritis*, serta nilai total estimasi modal pemesanan (*Purchase Order*). Dilengkapi dengan **Filter Periode Multi-Bulan** untuk membandingkan basis stok antar bulan.

3. **Tren Historis (Historical Snapshots)**  
   Simpan (*snapshot*) metrik performa tiap bulan untuk memantau nilai Inventory Turnover (ITO), efisiensi stok, dan perkembangan HPP vs Revenue lewat diagram interaktif.

4. **Moving Stock & Clickable Details**
   Visualisasi pergerakan stok harian. Setiap baris SKU dapat diklik untuk melihat rincian ketersediaan stok di setiap cabang toko secara mendalam.

5. **Kalkulasi Klasifikasi ABC**
   Algoritma Analisis Pareto (*ABC Analysis*) otomatis untuk setiap cabang, mengelompokkan barang berdasarkan kontribusi nilai HPP (Kelas A, B, dan C).

6. **Suggest Order & Export PO**
   Rekomendasi pemesanan otomatis menggunakan formula *Safety Stock* dan *Average Daily Demand* dengan pembulatan MOQ. Mendukung ekspor ke Excel.

7. **Advanced Map Caching (Tuning Performa)**
   Navigasi kilat antar menu dengan sistem penyimpanan sementara berbasis memori dan algoritma *infinite loop fetching* yang mencegah *timeout database* saat memuat ratusan ribu data secara bersamaan.

## 🚀 Instalasi & Menjalankan Aplikasi

Proyek ini menggunakan **React + Vite 8** dengan integrasi **Supabase** untuk persistensi data.

Pastikan **Node.js** dan `npm` sudah terpasang.

```bash
# 1. Clone repositori
git clone https://github.com/budagbogor/inventoryplanner03.git

# 2. Install dependencies
npm install

# 3. Setup Environment Variables
# Buat file .env.local dan isi dengan kredensial Supabase Anda:
# VITE_SUPABASE_URL=your_url
# VITE_SUPABASE_ANON_KEY=your_key

# 4. Jalankan aplikasi
npm run dev
```

## 🛠️ Stack Teknologi

- **Framework**: [React](https://react.dev/) + [Vite 8](https://vitejs.dev/)
- **Database**: [Supabase](https://supabase.com/) (PostgreSQL + Realtime)
- **Bahasa**: [TypeScript](https://www.typescriptlang.org/)
- **Tampilan**: [Tailwind CSS](https://tailwindcss.com/) & [shadcn/ui](https://ui.shadcn.com/)
- **Ikonografi**: [Lucide React](https://lucide.dev/)
- **Animasi**: `framer-motion`
- **Lainnya**: `sonner`, `recharts`, `xlsx` (Excel Processing)

---
*Dikembangkan secara privat untuk keperluan manajemen Inventaris internal.*
