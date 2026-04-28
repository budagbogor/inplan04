import { getAISettings, SUMOPOD_BASE_URL, OPENROUTER_BASE_URL, GEMINI_BASE_URL } from './aiSettings';
import { getSOHData, getSalesData } from './dataStore';

export interface AIAnalysisResponse {
  condition: string;
  problems: string[];
  recommendations: string[];
  rawMarkdown: string;
}

export async function askAI(systemPrompt: string, userPrompt: string, temperature: number = 0.3): Promise<string> {
  const settings = getAISettings();
  
  if (!settings.apiKey) {
    throw new Error('API Key AI belum diatur. Silakan ke halaman Pengaturan.');
  }

  if (settings.provider === 'Gemini') {
    const url = `${GEMINI_BASE_URL}/models/${encodeURIComponent(settings.model)}:generateContent?key=${encodeURIComponent(settings.apiKey)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `INSTRUCTIONS (INTERNAL SYSTEM):\n${systemPrompt}\n\nUSER REQUEST & DATA:\n${userPrompt}`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature,
          maxOutputTokens: 1500,
        },
      }),
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
    const text = data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text).filter(Boolean).join('') ?? '';
    return text || 'Tidak ada respon dari AI.';
  }

  const isOpenRouter = settings.provider === 'OpenRouter';
  const baseUrl = isOpenRouter ? OPENROUTER_BASE_URL : SUMOPOD_BASE_URL;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${settings.apiKey}`
  };

  if (isOpenRouter) {
    headers['HTTP-Referer'] = window.location.origin;
    headers['X-Title'] = 'Mobeng Inventory Planner';
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: headers,
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
4. GUKANAN STANDAR KPI INVENTORY MOBENG BERIKUT UNTUK EVALUASI:
   - **Stock Efficiency (S/E):** [Total Stock - (Overstock + Non Moving Stock)] / Total Stock. (Mengukur seberapa jauh stok sesuai dengan permintaan). Nilai tinggi = lebih baik.
   - **Stock Month / Days / DSI:** O/H Stock / MAD (Rata2 stok / HPP Penjualan). Target sehat: Oli = 60 hari, Part = 90 hari. Gunakan ini untuk menegur overstock!
   - **Inventory Turn Over (ITO):** JUAL / ((AWAL + AKHIR) / 2). Jika ITO < 1, perputaran sangat lambat, indikasi dead stock tinggi yang mutlak butuh perhatian khusus.
5. PAHAMI SISTEM PELABELAN INVENTORY MOBENG (YANG SANGAT BERMASALAH):
   - Tag "W": Produk utama/wajib. Sangat efektif untuk produk Eksklusif Mobeng (seperti Oli X-ten & Chemical X-ten). **MASALAH SISTEMIK 1:** Produk NON-Eksklusif juga diberi tag W agar bisa ikut "Auto-Replenishment". Akibatnya, barang dipaksa masuk ke cabang yang tidak punya historis penjualan, menghasilkan Dead Stock besar-besaran.
   - Tag "S": Produk sekunder pelengkap Tag W.
   - **DILEMA Auto-Replenishment:** HANYA Tag "W" & "S" yang memiliki fitur order ulang otomatis. Jika produk Non-Eksklusif dicabut dari Tag W/S agar tidak jadi dead stock, maka sistem tidak akan me-restocknya saat laku, memicu Lost Sales. Ini adalah kelemahan sistem tingkat arsitektur.
   - **Solusi Taktis untuk Tag W macet:** Untuk produk Tag W yang mati (Non-Moving) di suatu cabang akibat alokasi sistemik, **solusi mutlak yang HARUS Anda sarankan** adalah: Melakukan *Inter-Branch Transfer* (memindahkan stok tersebut ke cabang lain yang secara historis memiliki pergerakan Fast Moving untuk item itu) ATAU melakukan "Retur ke DC/Depo Pusat" agar tidak menggerus omzet dan kapastias penyimpanan toko yang bersangkutan.
   - **Masalah Pembatasan (PAC & Max Stock):** Perusahaan mencoba membatasi Tag W/S dengan sistem PAC (Product Assortment Class) dan setting Max Stock = 0. **MASALAH SISTEMIK 2:** Karena maintenance limit ini sangat MANUAL, pengaturannya sering terlupakan. Banyak cabang yang tidak pernah jualan tapi Max Stock-nya tidak diubah ke 0, sehingga auto-replenishment terus mengirim barang menjadi Dead Stock.
   - **MASALAH SISTEMIK 3 (Human Error & Kesalahan Formula):** Penentuan semua label Tag ini dilakukan secara MANUAL, sehingga SANGAT SERING terjadi kesalahan pemberian label. Selain itu, sistem *ordering* masih belum sistematis dan formula *Suggest Order* yang digunakan saat ini terbukti BELUM BENAR, tidak efektif, dan tidak efisien.
   - Tag "H", "D", atau "N": Ini adalah produk DEAD STOCK atau CACAT yang sudah TIDAK AKAN DIORDER LAGI ke supplier. Strategi wajib untuk tag ini adalah murni LIKUIDASI, HABISKAN STOK, atau RETUR, bukan menyimpan.

PENTING: Jangan basa-basi. Bertindaklah sebagai konsultan kelas dunia. Serang kelemahan arsitektur sistem (Label Tag yang Manual, Formula Suggest Order yang Batal, Auto-Replenishment Cacat) secara tajam dan selalu masukkan "Transfer Antar Cabang" atau "Retur DC" sebagai jalan keluar utama.`;

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

  const markdown = await askAI(systemPrompt, userPrompt, 0.3);
  
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
