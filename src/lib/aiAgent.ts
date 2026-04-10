import { getAISettings, SUMOPOD_BASE_URL } from './aiSettings';
import { getSOHData, getSalesData } from './dataStore';

export interface AIAnalysisResponse {
  condition: string;
  problems: string[];
  recommendations: string[];
  rawMarkdown: string;
}

export async function askSumoPod(systemPrompt: string, userPrompt: string, temperature: number = 0.3): Promise<string> {
  const settings = getAISettings();
  
  if (!settings.apiKey) {
    throw new Error('API Key SumoPod belum diatur. Silakan ke halaman Pengaturan.');
  }

  const response = await fetch(`${SUMOPOD_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify({
      model: settings.model,
      messages: [
        { 
          role: 'user', 
          content: `INSTRUCTIONS (INTERNAL SYSTEM):\n${systemPrompt}\n\nUSER REQUEST & DATA:\n${userPrompt}` 
        }
      ],
      temperature: temperature,
      max_tokens: 1500
    })
  });

  if (!response.ok) {
    let errorMsg = `API Error: ${response.status} ${response.statusText}`;
    try {
      const errorData = await response.json();
      errorMsg = errorData.error?.message || errorData.message || JSON.stringify(errorData);
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'Tidak ada respon dari AI.';
}

export interface AIAnalysisResult {
  markdown: string;
  stats: {
    totalStockValue: number;
    totalSohItem: number;
    criticalItems: number;
    zeroStockItems: number;
    overstockItems: number;
    fastMoving: number;
    slowMoving: number;
    nonMoving: number;
    tagW_SKU: number;
    deadStockTags: number;
    deadStockTagsValue: number;
  };
}

export async function getInventoryAnalysis(context?: { kodeToko?: string; period?: string }): Promise<AIAnalysisResult> {
  const soh = await getSOHData(context?.period);
  const sales = await getSalesData(context?.period);
  
  // Filter context if store-specific
  const relevantSoh = context?.kodeToko ? soh.filter(r => r.kodeToko === context.kodeToko) : soh;
  const storeName = context?.kodeToko ? relevantSoh[0]?.namaToko || context.kodeToko : 'Nasional';

  // Calculate some basic metrics for the prompt
  const totalStockValue = relevantSoh.reduce((acc, r) => acc + (r.valueStock || 0), 0);
  const totalSohItem = relevantSoh.length;
  const criticalItems = relevantSoh.filter(r => (r.soh || 0) <= (r.minStock || 0) && r.soh > 0).length;
  const zeroStockItems = relevantSoh.filter(r => (r.soh || 0) === 0).length;
  const overstockItems = relevantSoh.filter(r => (r.soh || 0) > (r.maxStock || 0) && r.maxStock > 0).length;
  
  // Basic ABC calculation count
  const fastMoving = relevantSoh.filter(r => r.dsi <= 30 && r.soh > 0).length;
  const slowMoving = relevantSoh.filter(r => r.dsi > 90 && r.soh > 0).length;
  const nonMoving = relevantSoh.filter(r => r.dsi === 0 && r.soh > 0).length;

  // Mobeng Specific Tags Count
  const tagW_SKU = relevantSoh.filter(r => r.tagProduk?.toUpperCase() === 'W').length;
  const deadStockTags = relevantSoh.filter(r => ['H', 'D', 'N'].includes(r.tagProduk?.toUpperCase() || '')).length;
  const deadStockTagsValue = relevantSoh.filter(r => ['H', 'D', 'N'].includes(r.tagProduk?.toUpperCase() || '')).reduce((acc, r) => acc + (r.valueStock || 0), 0);

  const systemPrompt = `Anda adalah Ahli Strategi Bisnis Retail dan Supply Chain Analyst Senior tingkat Direktur yang sangat kritis, analitis, dan skeptis terhadap inefisiensi sistem.
Tujuan Anda adalah membantu Manajemen C-Level memberikan wawasan yang TAJAM, KRITIS, dan REALISTIS untuk perbaikan operasional dan evaluasi SOP perusahaan.

Gunakan standar analisa profesional:
1. Identifikasi Inefisiensi Modal: Berapa banyak modal yang tertahan di overstock/slow-moving?
2. Resiko Penjualan Hilang (Lost Sales): Fokus pada item kritis (stok < Min).
3. Evaluasi Kelemahan Sistem/SOP: Jangan ragu untuk mengkritik kebijakan internal perusahaan jika hal tersebut terbukti merugikan berdasarkan data inventory.
4. Bandingkan secara eksplisit antara data yang ada dengan teori retail terbaik (Pareto 80/20, JIT, Buffer Stock).
5. PAHAMI SISTEM PELABELAN INVENTORY MOBENG:
   - Tag "W": Produk utama/wajib (Traffic/Margin tinggi). **Aturan Sistem:** Produk Tag W WAJIB ada di semua toko, walaupun toko tersebut TIDAK meiliki historis penjualan. Akibatnya, sistem ini sering memicu penumpukan produk Non-Moving di cabang tertentu.
   - Tag "S": Produk sekunder pelengkap Tag W.
   - Auto-Replenishment: Hanya Tag "W" dan "S" yang memiliki sistem pemesanan ulang otomatis (Auto-Replenishment) berdasarkan data pusat.
   - Tag lainnya (I, U, K): Hanya dipesan ke supplier berdasarkan request manual dari Tim Operasional / Toko bersangkutan.
   - Tag "H", "D", atau "N": Ini adalah produk DEAD STOCK atau CACAT yang sudah TIDAK AKAN DIORDER LAGI ke supplier. Strategi wajib untuk tag ini adalah murni LIKUIDASI, HABISKAN STOK, atau RETUR, bukan menyimpan.

PENTING: Jangan basa-basi. Langsung ke inti permasalahan, kritisi kelemahan sistem saat ini secara profesional, dan berikan langkah aksi strategis.`;

  const userPrompt = `Laporan Inventory ${storeName} (Periode: ${context?.period || 'Terbaru'}):
- Total SKU Aktif: ${totalSohItem}
- Nilai Stok Saat Ini: Rp ${totalStockValue.toLocaleString('id-ID')}
- Item Out of Stock (0): ${zeroStockItems} SKU
- Item Kritis (Berisiko Habis): ${criticalItems} SKU
- Item Overstock (Waste): ${overstockItems} SKU
- Produk Fast Moving (High Turnover): ${fastMoving} SKU
- Produk Slow Moving: ${slowMoving} SKU
- Produk Non-Moving (Dead Stock): ${nonMoving} SKU

**STATUS TAGGING MOBENG (KRITIS):**
- Produk Tag "W" (Wajib Ada): ${tagW_SKU} SKU
- Produk Tag "H/D/N" (Harus Dimatikan/dihabiskan): ${deadStockTags} SKU dengan total nilai tertahan Rp ${deadStockTagsValue.toLocaleString('id-ID')}

TUGAS ANDA:
1. Berikan Analisa Kritis mengenai "Waste" (pemborosan modal) di ${storeName}, berikan teguran tajam jika proporsi Tag W menjadi penyebab utama tingginya nilai produk Non-Moving.
2. Identifikasi Resiko Operasional & Celah Sistem terbesar yang tersembunyi di balik angka ini (termasuk kebijakan auto-replenishment Tag W & S).
3. Berikan solusi dan strategi operasional (baik untuk level toko maupun evaluasi kebijakan kantor pusat) untuk membendung masalah tag H/D/N, dan solusi untuk alokasi paksa Tag W.
4. Berikan Rekomendasi 3 Langkah Aksi Strategis yang harus dilakukan DALAM MINGGU INI.

Format jawaban: Markdown professional dengan header yang tegas.`;

  const markdown = await askSumoPod(systemPrompt, userPrompt, 0.3);
  
  return {
    markdown,
    stats: {
      totalStockValue,
      totalSohItem,
      criticalItems,
      zeroStockItems,
      overstockItems,
      fastMoving,
      slowMoving,
      nonMoving,
      tagW_SKU,
      deadStockTags,
      deadStockTagsValue
    }
  };
}
