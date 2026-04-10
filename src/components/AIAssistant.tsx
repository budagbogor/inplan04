import { useState, useEffect, useRef } from 'react';
import { Brain, Sparkles, X, Send, Loader2, BarChart2, ShieldAlert, Lightbulb, Calendar, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { getInventoryAnalysis, type AIAnalysisResult } from '@/lib/aiAgent';
import { getUploadedFiles, getSOHData } from '@/lib/dataStore';
import { filterByActiveStores } from '@/lib/orderSettings';
import { AIGraphics } from './AIGraphics';
import { toast } from 'sonner';

export function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AIAnalysisResult | null>(null);
  
  // Filters State
  const [availablePeriods, setAvailablePeriods] = useState<string[]>([]);
  const [currentPeriod, setCurrentPeriod] = useState<string>('');
  const [stores, setStores] = useState<{kodeToko: string, namaToko: string}[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>('all');

  const scrollRef = useRef<HTMLDivElement>(null);

  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  // Fetch Periods on open
  useEffect(() => {
    if (isOpen) {
      getUploadedFiles().then(files => {
        const periods = Array.from(new Set(files.map(f => f.period))).filter(Boolean).sort().reverse();
        setAvailablePeriods(periods);
        if (periods.length > 0 && !currentPeriod) {
          setCurrentPeriod(periods[0]);
        }
      });
    }
  }, [isOpen]);

  // Fetch Stores when period changes
  useEffect(() => {
    if (isOpen && currentPeriod) {
      getSOHData(currentPeriod).then(soh => {
        const filtered = filterByActiveStores(soh);
        const uniqueStores = Array.from(new Map(filtered.map(s => [s.kodeToko, {kodeToko: s.kodeToko, namaToko: s.namaToko}])).values());
        // Sort alphabetically
        uniqueStores.sort((a, b) => a.namaToko.localeCompare(b.namaToko));
        setStores(uniqueStores);
      });
    }
  }, [isOpen, currentPeriod]);

  // Close with Escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  const handleRunAnalysis = async () => {
    setIsAnalyzing(true);
    setAnalysisResult(null);
    try {
      const result = await getInventoryAnalysis({
        kodeToko: selectedStore === 'all' ? undefined : selectedStore,
        period: currentPeriod
      });
      setAnalysisResult(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal melakukan analisa';
      toast.error(msg);
      if (msg.includes('API Key')) {
        setIsOpen(false);
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const parseInline = (text: string) => {
    const boldParts = text.split(/(\*\*.*?\*\*)/g);
    return boldParts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-bold text-foreground">{part.slice(2, -2)}</strong>;
      }
      const italicParts = part.split(/(\*[^\*]+\*)/g);
      return italicParts.map((subPart, j) => {
        if (subPart.startsWith('*') && subPart.endsWith('*') && subPart.length > 2) {
          return <em key={`${i}-${j}`} className="italic font-medium text-foreground/90">{subPart.slice(1, -1)}</em>;
        }
        return subPart;
      });
    });
  };

  const renderContent = (content: string) => {
    return content.split('\n').map((line, i) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('### ')) {
        return <h3 key={i} className="text-lg font-bold text-foreground mt-6 mb-3 flex items-center gap-2 border-b pb-2">
          {trimmed.includes('Analisa') && <BarChart2 className="w-5 h-5 text-primary" />}
          {trimmed.includes('Masalah') && <ShieldAlert className="w-5 h-5 text-amber-500" />}
          {trimmed.includes('Rekomendasi') && <Lightbulb className="w-5 h-5 text-green-500" />}
          {parseInline(trimmed.substring(4))}
        </h3>;
      }
      if (trimmed.startsWith('## ')) {
        return <h2 key={i} className="text-xl font-extrabold text-primary mt-8 mb-4">
          {parseInline(trimmed.substring(3))}
        </h2>;
      }
      if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
        return <li key={i} className="ml-5 text-sm text-foreground/80 list-disc my-1.5 pl-1 leading-relaxed">
          {parseInline(trimmed.substring(2))}
        </li>;
      }
      if (trimmed.match(/^\d+\./)) {
        return <div key={i} className="ml-1 font-semibold text-sm text-foreground mt-5 mb-2">
          {parseInline(trimmed)}
        </div>;
      }
      if (trimmed === '') return <div key={i} className="h-3" />;
      return <p key={i} className="text-sm text-foreground/80 leading-relaxed mb-3">
        {parseInline(trimmed)}
      </p>;
    });
  };

  return (
    <>
      {/* Floating Button */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-xl flex items-center justify-center border-2 border-white/20 hover:shadow-blue-500/20 transition-shadow"
      >
        <Sparkles className="w-6 h-6" />
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white animate-pulse" />
      </motion.button>

      {/* Sidebar Overlay */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[55]"
            />
            <motion.aside
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-0 sm:inset-4 md:inset-10 bg-background sm:rounded-2xl shadow-2xl z-[60] flex flex-col border overflow-hidden"
            >
              {/* Header */}
              <div className="p-4 sm:p-5 border-b flex flex-col sm:flex-row sm:items-center justify-between bg-gradient-to-r from-primary/10 via-primary/5 to-transparent gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/20">
                    <Brain className="w-7 h-7" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-foreground leading-none">SumoPod AI Agent</h2>
                    <p className="text-xs text-muted-foreground mt-1 tracking-widest uppercase">Strategic Retail Consultant</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  {/* Period Filter */}
                  {availablePeriods.length > 0 && (
                    <div className="flex items-center gap-2 flex-1 sm:flex-none">
                      <Calendar className="w-4 h-4 text-muted-foreground hidden sm:block" />
                      <Select value={currentPeriod} onValueChange={setCurrentPeriod}>
                        <SelectTrigger className="w-full sm:w-[150px] h-9 bg-card">
                          <SelectValue placeholder="Pilih Bulan" />
                        </SelectTrigger>
                        <SelectContent className="z-[70]">
                          {availablePeriods.map(p => {
                            const [year, month] = p.split('-');
                            return (
                              <SelectItem key={p} value={p}>
                                {months[parseInt(month) - 1]} {year}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Store Filter */}
                  <div className="flex items-center gap-2 flex-1 sm:flex-none">
                    <MapPin className="w-4 h-4 text-muted-foreground hidden sm:block" />
                    <Select value={selectedStore} onValueChange={setSelectedStore}>
                      <SelectTrigger className="w-full sm:w-[200px] h-9 bg-card">
                        <SelectValue placeholder="Pilih Toko" />
                      </SelectTrigger>
                      <SelectContent className="z-[70]">
                        <SelectItem value="all">🌐 Seluruh Nasional</SelectItem>
                        {stores.map(s => (
                          <SelectItem key={s.kodeToko} value={s.kodeToko}>
                            🏠 {s.namaToko}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <button 
                    onClick={() => setIsOpen(false)}
                    className="p-2 rounded-xl bg-muted/50 hover:bg-muted text-muted-foreground transition-colors ml-auto sm:ml-2"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Chat/Analysis Area */}
              <ScrollArea className="flex-1 bg-muted/10">
                {!analysisResult && !isAnalyzing ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4 pt-20">
                    <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                      <Sparkles className="w-12 h-12 animate-pulse" />
                    </div>
                    <div className="space-y-3 max-w-md">
                      <h3 className="text-xl font-bold text-foreground">Strategic Analysis Full-Page</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Analisa ini dikunci pada <strong>Suhu (Temperature) 0.3</strong> untuk memberikan wawasan yang tajam, sangat akurat, dan berfokus pada efisiensi modal. <br/><br/>
                        Silakan pilih <b>Periode</b> dan <b>Toko</b> di bagian atas, lalu klik tombol di bawah untuk memulai analisa bersama Infografis Visual.
                      </p>
                    </div>
                    <Button size="lg" onClick={handleRunAnalysis} className="gap-2 bg-primary hover:bg-primary/90 text-white shadow-lg w-full sm:w-auto px-8">
                      Mulai Analisa Sekarang
                    </Button>
                  </div>
                ) : (
                  <div className="max-w-5xl mx-auto p-4 sm:p-8 space-y-4 pb-10">
                    {isAnalyzing ? (
                      <div className="flex flex-col items-center justify-center py-32 space-y-5">
                        <Loader2 className="w-12 h-12 text-primary animate-spin" />
                        <p className="text-base text-primary font-medium animate-pulse">Menghubungkan ke AI untuk analisa mendalam...</p>
                      </div>
                    ) : (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="space-y-6 printable-ai-section"
                      >
                        {/* INJECT AIGraphics INFOGRAPHIC HERE */}
                        {analysisResult && <AIGraphics stats={analysisResult.stats} />}

                        <div className="bg-card rounded-3xl p-6 sm:p-10 border shadow-md prose prose-sm sm:prose-base max-w-none text-foreground dark:prose-invert">
                          {renderContent(analysisResult?.markdown || '')}
                        </div>
                      </motion.div>
                    )}
                  </div>
                )}
              </ScrollArea>

              {/* Footer Actions */}
              {analysisResult && !isAnalyzing && (
                <div className="p-4 border-t bg-muted/30 flex justify-center hide-in-print-ai">
                  <Button 
                    variant="outline" 
                    className="w-full sm:w-auto gap-2 text-primary hover:text-primary/90 hover:bg-primary/10 border-primary/20 px-8"
                    onClick={handleRunAnalysis}
                  >
                    <Send className="w-4 h-4" />
                    Re-Analisa dengan Data Terbaru
                  </Button>
                </div>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
