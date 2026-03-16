# Mobeng Inventory Planner 📦

Sistem aplikasi web cerdas untuk memantau, merencanakan, dan mengklasifikasikan operasional manajemen persediaan (SOH & Sales) dari berbagai cabang toko dengan perhitungan rekomendasi Reorder otomatis.

## ✨ Fitur Utama (Core Features)

1. **Dashboard & Analitik Komprehensif**
   Tinjau performa SKU (Service Level), identifikasi *Overstock / Kritis*, dan nilai total estimasi modal untuk pembelian barang (*Purchase Order*).
   
2. **Unggah Data Otomatis (Upload)**
   Mendukung kemampuan baca (parsing) multi-file dokumen Excel yang memuat *Report Daily Nett Sales* dan data *Stok On Hand (SOH)* spesifik untuk cabang area seperti Jakarta dan Surabaya.
   
3. **Penyaringan Pintar (Smart Filtering)**
   Mengecualikan kalkulasi secara otomatis/manual berdasarkan nama vendor tertentu, ID toko, brand produk, maupun klasifikasi divisi.

4. **Kalkulasi Klasifikasi ABC**
   Melakukan algoritma Analisis Pareto (*ABC Analysis*) pada tiap sub-cabang/toko, otomatis mengurutkan barang berdasarkan kontribusi total nilai HPP-nya. (Kelas A, B, dan C)

5. **Perhitungan Keperluan Stok (Suggest Order)**
   Analisis dan pembentukan *Purchase Order* menggunakan formula *Safety Stock, Average Daily Demand,* hingga pembulatan angka berdasakran kapasitas *Minimum Order Quantity* (MOQ) tiap suplier. Mendukung ekspor data ke Excel.

6. **Panduan Penggunaan Terpadu**
   Memiliki sesi panduan visual dalam aplikasi untuk melancarkan proses *on-boarding* staf maupun kasir baru.

## 🚀 Instalasi & Menjalankan Aplikasi (Local Development)

Proyek ini dibangun menggunakan **React + Vite** dibalut dengan Tailwind CSS dan komponen antarmuka dari **shadcn-ui**.

Pastikan **Node.js** dan `npm` sudah terpasang.

```bash
# 1. Clone repositori ini
git clone https://github.com/budagbogor/inventoryplanner02.git

# 2. Masuk ke dalam folder project (main root target)
cd inventoryplanner02/inventory-planner-main

# 3. Install seluruh dependencies (Catatan: file lock yang valid hanyalah package-lock.json milih npm)
npm install

# 4. Jalankan local development server (dilengkapi Hot-Reload)
npm run dev

# 5. Build aplikasi untuk produksi (Production)
npm run build
```

Setelah `npm run dev` berjalan, buka URL lokal (umumnya `http://localhost:8080/` atau `http://localhost:5173/`) pada _browser_ web pilihan Anda.

## 🛠️ Stack Teknologi

- **Framework**: [React](https://react.dev/) + [Vite](https://vitejs.dev/)
- **Bahasa**: [TypeScript](https://www.typescriptlang.org/)
- **Routing**: `react-router-dom`
- **Tampilan (Styling)**: [Tailwind CSS](https://tailwindcss.com/) & [shadcn/ui](https://ui.shadcn.com/)
- **Ikonografi**: [Lucide React](https://lucide.dev/)
- **Lainnya**: `sonner` (untuk notifikasi toast), `recharts` (Analisis Grafik), dan `xlsx` (Pengolahan data file import/export)

---
*Dikembangkan secara privat untuk keperluan manajemen Inventaris internal.*
