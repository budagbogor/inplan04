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

export async function getInventoryAnalysis(context?: { kodeToko?: string; period?: string }): Promise<string> {
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

  const systemPrompt = `Anda adalah Ahli Strategi Bisnis Retail dan Supply Chain Analyst Senior yang sangat kritis dan skeptis terhadap inefisiensi.
Tujuan Anda adalah membantu Manajemen memberikan wawasan yang TAJAM, KRITIS, dan REALISTIS untuk perbaikan operasional.

Gunakan standar analisa profesional:
1. Identifikasi Inefisiensi Modal: Berapa banyak modal yang tertahan di overstock/slow-moving?
2. Resiko Penjualan Hilang (Lost Sales): Fokus pada item kritis (stok < Min).
3. Strategi Perbaikan: Jangan hanya menyarankan "beli lebih banyak" atau "kurangi stok", tapi berikan saran TAKTIS seperti "Inter-branch Transfer", "Markdown Sale untuk SKU tertentu", atau "Negosiasi Lead Time" serta "Evaluasi Supplier".
4. Bandingkan secara eksplisit antara data yang ada dengan teori retail terbaik (Pareto 80/20, JIT, Buffer Stock).

PENTING: Jangan basa-basi. Langsung ke inti permasalahan dan berikan langkah aksi nyata. Gunakan nada bicara yang tegas, profesional, dan berorientasi hasil.`;

  const userPrompt = `Laporan Inventory ${storeName} (Periode: ${context?.period || 'Terbaru'}):
- Total SKU Aktif: ${totalSohItem}
- Nilai Stok Saat Ini: Rp ${totalStockValue.toLocaleString('id-ID')}
- Item Out of Stock (0): ${zeroStockItems} SKU
- Item Kritis (Berisiko Habis): ${criticalItems} SKU
- Item Overstock (Waste): ${overstockItems} SKU
- Produk Fast Moving (High Turnover): ${fastMoving} SKU
- Produk Slow Moving: ${slowMoving} SKU
- Produk Non-Moving (Dead Stock): ${nonMoving} SKU

TUGAS ANDA:
1. Berikan Analisa Kritis mengenai "Waste" (pemborosan modal) di ${storeName}.
2. Identifikasi Resiko Operasional terbesar yang tersembunyi di balik angka ini.
3. Berikan Rekomendasi 3 Langkah Aksi Strategis yang harus dilakukan DALAM MINGGU INI untuk memperbaiki efisiensi.
4. Jika ini analisa Nasional, sebutkan perbandingan performa antar cabang jika diperlukan.

Format jawaban: Markdown professional dengan header yang tegas.`;

  return askSumoPod(systemPrompt, userPrompt, 0.3);
}
