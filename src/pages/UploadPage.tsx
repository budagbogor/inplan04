import { useState, useCallback, useEffect, useRef } from 'react';
import { Upload, FileSpreadsheet, Trash2, AlertCircle, CheckCircle2, RefreshCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/PageHeader';
import {
  parseSalesExcel,
  parseSOHExcel,
  saveSalesData,
  saveSOHDataByRegion,
  getUploadedFiles,
  saveUploadedFiles,
  getSalesCount,
  getSOHCountByRegion,
  invalidateCache,
  deleteUploadedFile,
} from '@/lib/dataStore';
import { syncSettingsWithData } from '@/lib/orderSettings';
import { cn } from '@/lib/utils';
import type { UploadedFile } from '@/lib/types';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

type DataType = 'sales' | 'soh-jkt' | 'soh-sby';

function detectFileType(fileName: string): DataType {
  const lower = fileName.toLowerCase();
  const isSOH = lower.includes('soh') || lower.includes('stock') || lower.includes('stok') || lower.includes('minmax');
  if (isSOH) {
    if (lower.includes('sby') || lower.includes('surabaya')) return 'soh-sby';
    return 'soh-jkt';
  }
  if (lower.includes('sales') || lower.includes('nett') || lower.includes('penjualan')) {
    return 'sales';
  }
  return 'sales';
}

function typeLabel(type: DataType): string {
  switch (type) {
    case 'sales': return 'Data Penjualan (Sales)';
    case 'soh-jkt': return 'Data Stok (SOH Jakarta)';
    case 'soh-sby': return 'Data Stok (SOH Surabaya)';
  }
}

interface PendingFile {
  file: File;
  detectedType: DataType;
}

export default function UploadPage() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [salesCount, setSalesCount] = useState(0);
  const [sohJktCount, setSohJktCount] = useState(0);
  const [sohSbyCount, setSohSbyCount] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [showTypeDialog, setShowTypeDialog] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [refreshing, setRefreshing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentPeriod = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;

  const loadData = useCallback(async () => {
    const [f, s, jkt, sby] = await Promise.all([
      getUploadedFiles(), 
      getSalesCount(currentPeriod), 
      getSOHCountByRegion('jkt', currentPeriod), 
      getSOHCountByRegion('sby', currentPeriod)
    ]);
    setFiles(f);
    setSalesCount(s);
    setSohJktCount(jkt);
    setSohSbyCount(sby);
  }, [currentPeriod]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const hasSales = files.some(f => f.type === 'sales');
  const hasSohJkt = files.some(f => f.type === 'soh-jkt');
  const hasSohSby = files.some(f => f.type === 'soh-sby');

  const refreshCounts = useCallback(async () => {
    const [s, jkt, sby] = await Promise.all([
      getSalesCount(currentPeriod), 
      getSOHCountByRegion('jkt', currentPeriod), 
      getSOHCountByRegion('sby', currentPeriod)
    ]);
    setSalesCount(s);
    setSohJktCount(jkt);
    setSohSbyCount(sby);
  }, [currentPeriod]);

  const processFile = useCallback(async (file: File, type: DataType) => {
    const period = currentPeriod;
    if (type === 'sales') {
      const records = await parseSalesExcel(file);
      if (records.length === 0) { toast.error(`Tidak ada data penjualan dari ${file.name}`); return; }
      await saveSalesData(records, period);
      const newFile: UploadedFile = { 
        id: Date.now().toString(), 
        name: file.name, 
        type: 'sales', 
        uploadedAt: new Date().toISOString(), 
        recordCount: records.length,
        period 
      };
      const currentFiles = await getUploadedFiles();
      const updated = [...currentFiles, newFile];
      await saveUploadedFiles(updated);
      const sortedFiles = await getUploadedFiles();
      setFiles(sortedFiles);
      toast.success(`${records.length} data penjualan berhasil diupload untuk periode ${period}`);
    } else {
      const region = type === 'soh-jkt' ? 'jkt' as const : 'sby' as const;
      const records = await parseSOHExcel(file);
      if (records.length === 0) { toast.error(`Tidak ada data stok dari ${file.name}`); return; }
      await saveSOHDataByRegion(records, region, period);
      const newFile: UploadedFile = { 
        id: Date.now().toString(), 
        name: file.name, 
        type, 
        uploadedAt: new Date().toISOString(), 
        recordCount: records.length,
        period 
      };
      const currentFiles = await getUploadedFiles();
      const updated = [...currentFiles, newFile];
      await saveUploadedFiles(updated);
      const sortedFiles = await getUploadedFiles();
      setFiles(sortedFiles);
      toast.success(`${records.length} data stok ${region === 'jkt' ? 'Jakarta' : 'Surabaya'} berhasil diupload untuk periode ${period}`);
    }
  }, [currentPeriod]);

  const handleFilesSelected = useCallback((fileList: FileList) => {
    const validFiles: PendingFile[] = [];
    for (const file of Array.from(fileList)) {
      if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        toast.error(`${file.name} bukan file Excel`);
        continue;
      }
      validFiles.push({ file, detectedType: detectFileType(file.name) });
    }
    if (validFiles.length > 0) {
      setPendingFiles(validFiles);
      setShowTypeDialog(true);
    }
  }, []);

  const handleConfirmUpload = useCallback(async () => {
    setShowTypeDialog(false);
    setUploading(true);
    for (const pf of pendingFiles) {
      try {
        await processFile(pf.file, pf.detectedType);
      } catch (err) {
        console.error(`[Upload Error] ${pf.file.name}:`, err);
      }
    }
    setPendingFiles([]);
    await refreshCounts();
    setUploading(false);
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [pendingFiles, refreshCounts, processFile]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      invalidateCache();
      await syncSettingsWithData();
      await refreshCounts();
      const f = await getUploadedFiles();
      setFiles(f);
      toast.success('Pengaturan disinkronkan dengan data terbaru');
    } catch (err) {
      console.error(err);
      toast.error('Gagal menyinkronkan data');
    } finally {
      setRefreshing(false);
    }
  };

  const updatePendingType = (index: number, type: DataType) => {
    setPendingFiles(prev => prev.map((pf, i) => i === index ? { ...pf, detectedType: type } : pf));
  };

  const handleDeleteFile = async (fileId: string, type: string, period: string) => {
    try {
      await deleteUploadedFile(fileId, type, period);
      const updated = await getUploadedFiles();
      setFiles(updated);
      await refreshCounts();
      toast.success('Data berhasil dihapus');
    } catch (err) {
      console.error(err);
      toast.error('Gagal menghapus data');
    }
  };

  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div className="space-y-6 w-full">
      <PageHeader title="Upload Data" description="Upload file Excel penjualan (Sales) dan stok (SOH Jakarta & Surabaya)">
        <div className="flex items-center gap-2">
          <select 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="text-sm bg-background border rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-primary outline-none"
          >
            {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select 
            value={selectedYear} 
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="text-sm bg-background border rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-primary outline-none mr-2"
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-1.5" 
            onClick={handleRefresh}
            disabled={refreshing || uploading}
          >
            <RefreshCcw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
            {refreshing ? 'Sinkronisasi...' : 'Terapkan Pengaturan'}
          </Button>
        </div>
      </PageHeader>

      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold text-primary">Periode Aktif: {months[selectedMonth]} {selectedYear}</p>
          <p className="text-muted-foreground mt-0.5">Semua data yang diupload akan dikategorikan ke dalam periode ini. Pastikan periode sudah benar sebelum mengupload.</p>
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFilesSelected(e.dataTransfer.files); }}
        className={`relative border-2 border-dashed rounded-xl p-8 sm:p-12 text-center transition-colors ${
          dragOver ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          multiple
          onChange={(e) => e.target.files && handleFilesSelected(e.target.files)}
          className="absolute inset-0 opacity-0 cursor-pointer"
          disabled={uploading}
        />
        <Upload className={`w-8 sm:w-10 h-8 sm:h-10 mx-auto mb-3 ${dragOver ? 'text-accent' : 'text-muted-foreground'}`} />
        <p className="text-sm font-medium text-foreground">
          {uploading ? 'Memproses...' : 'Drag & drop file Excel atau klik untuk browse'}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Pilih 1 atau lebih file Excel untuk periode {months[selectedMonth]} {selectedYear}
        </p>
      </div>

      {/* Status for Current Period */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <DataCard title={typeLabel('sales')} hasData={hasSales} file={files.find(f => f.type === 'sales' && f.period === currentPeriod)} recordCount={salesCount} />
        <DataCard title={typeLabel('soh-jkt')} hasData={hasSohJkt} file={files.find(f => f.type === 'soh-jkt' && f.period === currentPeriod)} recordCount={sohJktCount} />
        <DataCard title={typeLabel('soh-sby')} hasData={hasSohSby} file={files.find(f => f.type === 'soh-sby' && f.period === currentPeriod)} recordCount={sohSbyCount} />
      </div>

      {/* Upload History Table */}
      <div className="bg-card rounded-xl border shadow-card overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/30">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-primary" />
            Riwayat Upload Data
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border text-left">
                <th className="px-4 py-3 font-medium text-muted-foreground">Periode</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Nama File</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Tipe</th>
                <th className="px-4 py-3 font-medium text-muted-foreground text-right">Records</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Tgl Upload</th>
                <th className="px-4 py-3 font-medium text-muted-foreground text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {files.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground italic">
                    Belum ada riwayat upload.
                  </td>
                </tr>
              ) : (
                files.map((file) => {
                  const safePeriod = file.period || '';
                  const [year, month] = safePeriod.split('-');
                  const periodLabel = year && month ? `${months[parseInt(month) - 1]} ${year}` : 'Tidak Ada Periode';
                  return (
                    <tr key={file.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{periodLabel}</td>
                      <td className="px-4 py-3 max-w-[200px] truncate" title={file.name}>{file.name}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                          file.type === 'sales' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {file.type === 'sales' ? 'Sales' : 'SOH ' + (file.type === 'soh-jkt' ? 'JKT' : 'SBY')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs">{file.recordCount.toLocaleString()}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {new Date(file.uploadedAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleDeleteFile(file.id, file.type, file.period)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 w-7 p-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Type Selection Dialog */}
      <Dialog open={showTypeDialog} onOpenChange={(open) => { if (!open) { setPendingFiles([]); } setShowTypeDialog(open); }}>
        <DialogContent className="sm:max-w-[32rem]">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-xl">Konfirmasi Tipe Data</DialogTitle>
            <DialogDescription>
              Pastikan tipe data sudah sesuai untuk setiap file sebelum melakukan upload.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-4 max-h-[55vh] overflow-y-auto pr-1">
            {pendingFiles.map((pf, idx) => (
              <div key={idx} className="flex flex-col gap-3 p-4 rounded-xl border border-border bg-card shadow-sm relative overflow-hidden group">
                {/* Aksen visual halus dikanan */}
                <div className="absolute top-0 bottom-0 left-0 w-1 bg-primary/20" />
                
                <div className="flex items-start gap-3 min-w-0">
                  <div className="p-2 bg-primary/10 text-primary rounded-lg shrink-0">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate" title={pf.file.name}>
                      {pf.file.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Pilih tipe data untuk file ini:
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 w-full mt-1">
                  {(['sales', 'soh-jkt', 'soh-sby'] as DataType[]).map(t => (
                    <button
                      key={t}
                      onClick={() => updatePendingType(idx, t)}
                      className={`flex-1 py-2 px-2 text-xs rounded-lg font-medium transition-all duration-200 border ${
                        pf.detectedType === t
                          ? 'bg-primary border-primary text-primary-foreground shadow-sm'
                          : 'bg-secondary/30 border-border/60 text-muted-foreground hover:bg-secondary hover:text-foreground'
                      }`}
                    >
                      {t === 'sales' ? 'Sales' : t === 'soh-jkt' ? 'SOH Jakarta' : 'SOH Surabaya'}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border/50">
            <Button variant="outline" className="px-6" onClick={() => { setShowTypeDialog(false); setPendingFiles([]); }}>
              Batal
            </Button>
            <Button className="px-6" onClick={handleConfirmUpload}>
              Upload {pendingFiles.length} File
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DataCard({ title, hasData, file, recordCount }: {
  title: string;
  hasData: boolean;
  file?: UploadedFile;
  recordCount: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border p-4 sm:p-5 shadow-card ${hasData ? 'border-success/30 bg-success/5' : 'border-border'}`}
    >
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className={`p-2 rounded-lg shrink-0 ${hasData ? 'bg-success/10 text-success' : 'bg-secondary text-muted-foreground'}`}>
            {hasData ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">{title}</p>
            {hasData && file ? (
              <div className="space-y-0.5 mt-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1 min-w-0">
                  <FileSpreadsheet className="w-3 h-3 shrink-0" />
                  <span className="truncate block">{file.name}</span>
                </p>
                <p className="text-xs text-muted-foreground font-mono">{recordCount.toLocaleString()} records</p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">Belum ada data</p>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
