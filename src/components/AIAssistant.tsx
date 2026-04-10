import { useState, useEffect, useRef } from 'react';
import { Brain, Sparkles, X, Send, Bot, User, Loader2, BarChart2, ShieldAlert, Lightbulb, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { getInventoryAnalysis } from '@/lib/aiAgent';
import { toast } from 'sonner';

export function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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
    setAnalysis(null);
    try {
      const result = await getInventoryAnalysis();
      setAnalysis(result);
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

  // Simple Markdown-ish renderer
  const renderContent = (content: string) => {
    return content.split('\n').map((line, i) => {
      if (line.startsWith('### ')) {
        return <h3 key={i} className="text-lg font-bold text-foreground mt-4 mb-2 flex items-center gap-2">
          {line.includes('Analisa') && <BarChart2 className="w-4 h-4 text-blue-500" />}
          {line.includes('Masalah') && <ShieldAlert className="w-4 h-4 text-amber-500" />}
          {line.includes('Rekomendasi') && <Lightbulb className="w-4 h-4 text-green-500" />}
          {line.replace('### ', '')}
        </h3>;
      }
      if (line.startsWith('* ') || line.startsWith('- ')) {
        return <li key={i} className="ml-4 text-sm text-muted-foreground list-disc my-1">{line.substring(2)}</li>;
      }
      if (line.trim() === '') return <br key={i} />;
      return <p key={i} className="text-sm text-muted-foreground leading-relaxed">{line}</p>;
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
              className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[55]"
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-full w-full sm:w-[450px] bg-background/95 backdrop-blur-md border-l shadow-2xl z-[60] flex flex-col"
            >
              {/* Header */}
              <div className="p-4 border-b flex items-center justify-between bg-gradient-to-r from-blue-50/50 to-transparent">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-lg">
                    <Brain className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-foreground leading-none">SumoPod AI Agent</h2>
                    <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-widest">Retail Consultant</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Chat/Analysis Area */}
              <ScrollArea className="flex-1 p-6">
                {!analysis && !isAnalyzing ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4 pt-20">
                    <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                      <Sparkles className="w-10 h-10 animate-pulse" />
                    </div>
                    <div className="space-y-2 max-w-[280px]">
                      <h3 className="font-bold text-foreground italic underline">Siap menganalisa bisnis Anda?</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Saya akan memproses data stok, penjualan, dan trend untuk memberikan rekomendasi strategis berdasarkan teori retail terbaik.
                      </p>
                    </div>
                    <Button onClick={handleRunAnalysis} className="gap-2 bg-blue-600 hover:bg-blue-700">
                      Mulai Analisa Sekarang
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4 pb-10">
                    {isAnalyzing ? (
                      <div className="flex flex-col items-center justify-center py-20 space-y-4">
                        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                        <p className="text-sm text-blue-600 font-medium animate-pulse">Sedang mengolah data inventaris...</p>
                      </div>
                    ) : (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-card rounded-2xl p-5 border shadow-sm prose prose-sm max-w-none"
                      >
                        {renderContent(analysis || '')}
                      </motion.div>
                    )}
                  </div>
                )}
              </ScrollArea>

              {/* Footer Actions */}
              {analysis && !isAnalyzing && (
                <div className="p-4 border-t bg-muted/30">
                  <Button 
                    variant="outline" 
                    className="w-full gap-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200"
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
