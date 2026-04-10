import { getAISettings, SUMOPOD_BASE_URL } from './aiSettings';
import { getSOHData, getSalesData } from './dataStore';

export interface AIAnalysisResponse {
  condition: string;
  problems: string[];
  recommendations: string[];
  rawMarkdown: string;
}

export async function askSumoPod(systemPrompt: string, userPrompt: string): Promise<string> {
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
          content: `INTRUKSI SISTEM:\n${systemPrompt}\n\nPERTANYAAN USER:\n${userPrompt}` 
        }
      ],
      temperature: 0.7,
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

export async function getInventoryAnalysis(context?: { kodeToko?: string }): Promise<string> {
  const soh = await getSOHData();
  const sales = await getSalesData();
  
  // Filter context if store-specific
  const relevantSoh = context?.kodeToko ? soh.filter(r => r.kodeToko === context.kodeToko) : soh;
  const storeName = context?.kodeToko ? relevantSoh[0]?.namaToko || context.kodeToko : 'Nasional';

  // Calculate some basic metrics for the prompt
  const totalStockValue = relevantSoh.reduce((acc, r) => acc + (r.valueStock || 0), 0);
  const totalSohItem = relevantSoh.length;
  const criticalItems = relevantSoh.filter(r => (r.soh || 0) <= (r.minStock || 0)).length;
  const overstockItems = relevantSoh.filter(r => (r.soh || 0) > (r.maxStock || 0)).length;
  
  // Basic ABC calculation count
  const fastMoving = relevantSoh.filter(r => r.dsi <= 30 && r.soh > 0).length;
  const slowMoving = relevantSoh.filter(r => r.dsi > 90).length;

  const systemPrompt = `Anda adalah Konsultan Bisnis Retail Senior dan Ahli Manajemen Rantai Pasok (Supply Chain).
Tugas Anda adalah menganalisa data inventaris toko "Mobeng" dan memberikan laporan strategis.
Gunakan teori retail terbaik seperti: 
1. ABC Analysis (Pareto)
2. Safety Stock & Reorder Point (ROP) logic
3. JIT (Just in Time) untuk item slow moving
4. Inventory Turnover Ratio (ITO) optimization

Berikan jawaban dalam Bahasa Indonesia yang profesional, padat, dan solutif.
Format jawaban harus menggunakan Markdown dengan struktur:
### 📊 Analisa Kondisi Saat Ini (${storeName})
...penjelasan kondisi stok dan kesehatan inventory...

### ⚠️ Masalah yang Terdeteksi
...list poin permasalahan utama...

### 💡 Rekomendasi Strategis
...solusi konkret untuk perbaikan...`;

  const userPrompt = `Data Inventaris saat ini (${storeName}):
- Total SKU: ${totalSohItem} item
- Total Nilai Stok: Rp ${totalStockValue.toLocaleString('id-ID')}
- Item Kritis (Dibawah Min): ${criticalItems} item
- Item Overstock (Diatas Max): ${overstockItems} item
- Item Fast Moving (DSI < 30 hr): ${fastMoving}
- Item Slow Moving (DSI > 90 hr): ${slowMoving}

Mohon berikan analisa mendalam mengenai kondisi di atas, bandingkan dengan teori bisnis retail terbaik, jelaskan mengapa angka ini bermasalah (jika ada), dan berikan rekomendasi aksi yang harus diambil manajer toko untuk meningkatkan efisiensi modal kerja & ketersediaan stok.`;

  return askSumoPod(systemPrompt, userPrompt);
}
