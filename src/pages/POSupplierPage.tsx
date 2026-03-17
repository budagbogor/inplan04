import { useState, useMemo, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  FileText, Search, Printer, Save, Plus, Minus, Trash2,
  ChevronDown, ChevronRight, Package, AlertTriangle, Check, Download
} from 'lucide-react';
import ExcelJS from 'exceljs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { getSOHData, formatNumber, formatCurrency } from '@/lib/dataStore';
import { getOrderSettings, filterByActiveStores } from '@/lib/orderSettings';
import { calculateStoreOrders } from '@/lib/storeOrders';
import type { SOHRecord, StoreOrderItem } from '@/lib/types';
import { toast } from 'sonner';

interface POItem {
  kodeProduk: string;
  namaPanjang: string;
  brand: string;
  category: string;
  supplier: string;
  totalStock: number;
  avgDailyDemand: number;
  moq: number;
  suggestedQty: number;
  adjustedQty: number;
  priority: 'critical' | 'low' | 'normal' | 'overstock';
  removed: boolean;
}

interface SupplierGroup {
  supplier: string;
  items: POItem[];
  totalQty: number;
  totalSku: number;
}

function aggregatePOItems(soh: SOHRecord[], settings: ReturnType<typeof getOrderSettings>): POItem[] {
  const storeSummaries = calculateStoreOrders(soh, settings);
  const priorityOrder = { critical: 0, low: 1, normal: 2, overstock: 3 };
  const skuMap = new Map<string, POItem>();

  for (const store of storeSummaries) {
    for (const item of store.items) {
      const existing = skuMap.get(item.kodeProduk);
      if (!existing) {
        skuMap.set(item.kodeProduk, {
          kodeProduk: item.kodeProduk,
          namaPanjang: item.namaPanjang,
          brand: item.brand,
          category: item.category,
          supplier: item.supplier,
          totalStock: item.soh,
          avgDailyDemand: item.avgDailyDemand,
          moq: item.moq,
          suggestedQty: item.suggestedQty,
          adjustedQty: item.suggestedQty,
          priority: item.priority,
          removed: false,
        });
      } else {
        existing.totalStock += item.soh;
        existing.avgDailyDemand += item.avgDailyDemand;
        existing.suggestedQty += item.suggestedQty;
        existing.adjustedQty += item.suggestedQty;
        if (priorityOrder[item.priority] < priorityOrder[existing.priority]) {
          existing.priority = item.priority;
        }
      }
    }
  }

  const items = Array.from(skuMap.values());
  // Round up to MOQ
  for (const item of items) {
    if (item.moq > 1 && item.adjustedQty > 0) {
      item.adjustedQty = Math.ceil(item.adjustedQty / item.moq) * item.moq;
      item.suggestedQty = item.adjustedQty;
    }
  }
  return items;
}

function groupBySupplier(items: POItem[]): SupplierGroup[] {
  const map = new Map<string, POItem[]>();
  for (const item of items) {
    if (item.removed) continue;
    const key = item.supplier || 'Tanpa Supplier';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return Array.from(map.entries())
    .map(([supplier, items]) => ({
      supplier,
      items: items.sort((a, b) => a.namaPanjang.localeCompare(b.namaPanjang)),
      totalQty: items.reduce((s, i) => s + i.adjustedQty, 0),
      totalSku: items.length,
    }))
    .sort((a, b) => b.totalQty - a.totalQty);
}

const priorityConfig = {
  critical: { label: 'Kritis', className: 'bg-destructive/10 text-destructive border-destructive/30' },
  low: { label: 'Rendah', className: 'bg-warning/10 text-warning border-warning/30' },
  normal: { label: 'Normal', className: 'bg-info/10 text-info border-info/30' },
  overstock: { label: 'Overstock', className: 'bg-success/10 text-success border-success/30' },
};

export default function POSupplierPage() {
  const [soh, setSoh] = useState<SOHRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<POItem[]>([]);
  const [search, setSearch] = useState('');
  const [expandedSuppliers, setExpandedSuppliers] = useState<Set<string>>(new Set());
  const [selectedSupplier, setSelectedSupplier] = useState<string>('all');
  const [poNumber, setPoNumber] = useState(`PO-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-001`);
  const [poNotes, setPoNotes] = useState('');
  const printRef = useRef<HTMLDivElement>(null);

  const settings = useMemo(() => getOrderSettings(), []);

  useEffect(() => {
    getSOHData().then(d => {
      const filtered = filterByActiveStores(d);
      setSoh(filtered);
      setItems(aggregatePOItems(filtered, settings));
      setLoading(false);
    });
  }, [settings]);

  const activeItems = useMemo(() => items.filter(i => !i.removed), [items]);
  const supplierGroups = useMemo(() => groupBySupplier(items), [items]);

  const filteredGroups = useMemo(() => {
    let groups = supplierGroups;
    if (selectedSupplier !== 'all') {
      groups = groups.filter(g => g.supplier === selectedSupplier);
    }
    if (search) {
      const q = search.toLowerCase();
      groups = groups.map(g => ({
        ...g,
        items: g.items.filter(i =>
          i.namaPanjang.toLowerCase().includes(q) ||
          i.kodeProduk.toLowerCase().includes(q) ||
          i.brand.toLowerCase().includes(q)
        ),
      })).filter(g => g.items.length > 0);
    }
    return groups;
  }, [supplierGroups, selectedSupplier, search]);

  const totalOrderQty = activeItems.reduce((s, i) => s + i.adjustedQty, 0);
  const totalSku = activeItems.length;
  const supplierCount = supplierGroups.length;
  const modifiedCount = activeItems.filter(i => i.adjustedQty !== i.suggestedQty).length;

  const toggleSupplier = (supplier: string) => {
    setExpandedSuppliers(prev => {
      const next = new Set(prev);
      if (next.has(supplier)) next.delete(supplier);
      else next.add(supplier);
      return next;
    });
  };

  const expandAll = () => setExpandedSuppliers(new Set(supplierGroups.map(g => g.supplier)));
  const collapseAll = () => setExpandedSuppliers(new Set());

  const updateQty = (kodeProduk: string, delta: number) => {
    setItems(prev => prev.map(i => {
      if (i.kodeProduk !== kodeProduk) return i;
      const newQty = Math.max(0, i.adjustedQty + delta);
      return { ...i, adjustedQty: newQty };
    }));
  };

  const setQty = (kodeProduk: string, qty: number) => {
    setItems(prev => prev.map(i =>
      i.kodeProduk === kodeProduk ? { ...i, adjustedQty: Math.max(0, qty) } : i
    ));
  };

  const removeItem = (kodeProduk: string) => {
    setItems(prev => prev.map(i =>
      i.kodeProduk === kodeProduk ? { ...i, removed: true } : i
    ));
  };

  const restoreItem = (kodeProduk: string) => {
    setItems(prev => prev.map(i =>
      i.kodeProduk === kodeProduk ? { ...i, removed: false } : i
    ));
  };

  const resetAll = () => {
    setItems(prev => prev.map(i => ({ ...i, adjustedQty: i.suggestedQty, removed: false })));
    toast.success('Semua item direset ke nilai awal');
  };

  const handleSave = () => {
    const data = {
      poNumber,
      date: new Date().toISOString(),
      notes: poNotes,
      suppliers: supplierGroups.map(g => ({
        supplier: g.supplier,
        items: g.items.map(i => ({
          kodeProduk: i.kodeProduk,
          namaPanjang: i.namaPanjang,
          brand: i.brand,
          qty: i.adjustedQty,
          moq: i.moq,
        })),
      })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${poNumber}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('PO berhasil disimpan');
  };

  const handleExportExcel = async (supplierFilter?: string) => {
    const groupsToExport = supplierFilter
      ? supplierGroups.filter(g => g.supplier === supplierFilter)
      : supplierGroups;

    if (groupsToExport.length === 0) {
      toast.error('Tidak ada data untuk diekspor');
      return;
    }

    const workbook = new ExcelJS.Workbook();

    for (const group of groupsToExport) {
      // Sheet names are limited to 31 chars
      const sheetName = group.supplier.substring(0, 31).replace(/[\\/?*[\]]/g, ' ');
      const worksheet = workbook.addWorksheet(sheetName);

      worksheet.columns = [
        { header: 'No', key: 'no', width: 5 },
        { header: 'Kode Produk', key: 'kodeProduk', width: 15 },
        { header: 'Nama Produk', key: 'namaPanjang', width: 45 },
        { header: 'Brand', key: 'brand', width: 15 },
        { header: 'Kategori', key: 'category', width: 15 },
        { header: 'MOQ', key: 'moq', width: 8 },
        { header: 'Order Qty', key: 'adjustedQty', width: 12 },
      ];

      group.items.forEach((item, index) => {
        worksheet.addRow({
          no: index + 1,
          kodeProduk: item.kodeProduk,
          namaPanjang: item.namaPanjang,
          brand: item.brand,
          category: item.category,
          moq: item.moq,
          adjustedQty: item.adjustedQty,
        });
      });

      // Add total row
      const totalRow = worksheet.addRow({
        no: '',
        kodeProduk: '',
        namaPanjang: 'TOTAL ORDER',
        brand: '',
        category: '',
        moq: '',
        adjustedQty: group.totalQty,
      });
      totalRow.font = { bold: true };
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    
    const fileName = supplierFilter 
      ? `PO_${supplierFilter}_${poNumber}.xlsx` 
      : `${poNumber}_All_Suppliers.xlsx`;
      
    anchor.download = fileName;
    anchor.click();
    window.URL.revokeObjectURL(url);
    toast.success(`Berhasil mengekspor data ke format Excel`);
  };

  const handlePrint = (supplierFilter?: string) => {
    const groupsToPrint = supplierFilter
      ? supplierGroups.filter(g => g.supplier === supplierFilter)
      : supplierGroups;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const today = new Date();
    const dateStr = today.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });

    const supplierSections = groupsToPrint.map(group => `
      <div class="po-section" style="page-break-after: always;">
        <table class="header-table">
          <tr>
            <td style="width:60%">
              <h1 style="margin:0;font-size:20px;color:#1a365d;">PURCHASE ORDER</h1>
              <p style="margin:4px 0 0;color:#64748b;font-size:12px;">MOBENG Inventory Management</p>
            </td>
            <td style="width:40%;text-align:right;">
              <table style="margin-left:auto;font-size:12px;">
                <tr><td style="color:#64748b;padding:2px 8px;">No. PO</td><td style="font-weight:600;">${poNumber}</td></tr>
                <tr><td style="color:#64748b;padding:2px 8px;">Tanggal</td><td>${dateStr}</td></tr>
              </table>
            </td>
          </tr>
        </table>

        <div style="margin:16px 0;padding:12px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;">
          <table style="font-size:12px;width:100%;">
            <tr>
              <td style="color:#64748b;width:100px;">Kepada</td>
              <td style="font-weight:600;font-size:13px;">${group.supplier}</td>
            </tr>
            <tr>
              <td style="color:#64748b;">Total SKU</td>
              <td>${group.items.length} item</td>
            </tr>
            <tr>
              <td style="color:#64748b;">Total Qty</td>
              <td style="font-weight:600;">${group.items.reduce((s, i) => s + i.adjustedQty, 0).toLocaleString('id-ID')} pcs</td>
            </tr>
          </table>
        </div>

        <table class="items-table">
          <thead>
            <tr>
              <th style="width:30px;">No</th>
              <th style="width:110px;">Kode Produk</th>
              <th>Nama Produk</th>
              <th style="width:80px;">Brand</th>
              <th style="width:60px;text-align:right;">MOQ</th>
              <th style="width:80px;text-align:right;">Order Qty</th>
            </tr>
          </thead>
          <tbody>
            ${group.items.map((item, idx) => `
              <tr>
                <td style="text-align:center;color:#64748b;">${idx + 1}</td>
                <td style="font-family:monospace;font-size:11px;">${item.kodeProduk}</td>
                <td>${item.namaPanjang}</td>
                <td>${item.brand}</td>
                <td style="text-align:right;">${item.moq > 1 ? item.moq.toLocaleString('id-ID') : '-'}</td>
                <td style="text-align:right;font-weight:600;">${item.adjustedQty.toLocaleString('id-ID')}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr style="font-weight:700;border-top:2px solid #1a365d;">
              <td colspan="5" style="text-align:right;padding-right:12px;">TOTAL</td>
              <td style="text-align:right;">${group.items.reduce((s, i) => s + i.adjustedQty, 0).toLocaleString('id-ID')}</td>
            </tr>
          </tfoot>
        </table>

        ${poNotes ? `
          <div style="margin-top:16px;padding:10px 14px;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;font-size:11px;">
            <strong>Catatan:</strong> ${poNotes}
          </div>
        ` : ''}

        <div style="margin-top:40px;display:flex;justify-content:space-between;">
          <div style="text-align:center;width:200px;">
            <div style="border-bottom:1px solid #cbd5e1;margin-bottom:6px;height:60px;"></div>
            <p style="font-size:11px;color:#64748b;margin:0;">Dibuat Oleh</p>
          </div>
          <div style="text-align:center;width:200px;">
            <div style="border-bottom:1px solid #cbd5e1;margin-bottom:6px;height:60px;"></div>
            <p style="font-size:11px;color:#64748b;margin:0;">Disetujui Oleh</p>
          </div>
        </div>

        <p style="text-align:center;margin-top:30px;font-size:10px;color:#94a3b8;">
          Dokumen ini digenerate oleh MOBENG Inventory System — ${dateStr}
        </p>
      </div>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${poNumber} - Purchase Order</title>
        <style>
          @page { size: A4; margin: 20mm; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; font-size: 12px; }
          .header-table { width: 100%; border-collapse: collapse; }
          .items-table { width: 100%; border-collapse: collapse; font-size: 11px; }
          .items-table th { background: #1a365d; color: white; padding: 8px 10px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
          .items-table td { padding: 6px 10px; border-bottom: 1px solid #e2e8f0; }
          .items-table tbody tr:nth-child(even) { background: #f8fafc; }
          .items-table tfoot td { padding: 10px; }
          .po-section:last-child { page-break-after: auto; }
          @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        </style>
      </head>
      <body>${supplierSections}</body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 300);
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground text-sm">Memuat data...</div>;

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="p-4 rounded-2xl bg-accent/10 mb-4">
          <FileText className="w-10 h-10 text-accent" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Belum Ada Data PO</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm">Upload data SOH terlebih dahulu untuk generate Purchase Order</p>
      </div>
    );
  }

  const removedItems = items.filter(i => i.removed);

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader title="PO to Supplier" description="Purchase Order per supplier — review, adjust, dan cetak PO profesional">
        <div className="flex items-center gap-2">
          <Button onClick={resetAll} variant="outline" size="sm" className="gap-1.5 text-xs">
            Reset
          </Button>
          <Button onClick={handleSave} variant="outline" size="sm" className="gap-1.5">
            <Save className="w-3.5 h-3.5" /> Save
          </Button>
          <Button onClick={() => handlePrint()} size="sm" className="gap-1.5">
            <Printer className="w-3.5 h-3.5" /> Print All
          </Button>
          <Button onClick={() => handleExportExcel()} size="sm" variant="secondary" className="gap-1.5 bg-success/10 text-success hover:bg-success/20 border border-success/20">
            <Download className="w-3.5 h-3.5" /> Export Excel
          </Button>
        </div>
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard title="Supplier" value={formatNumber(supplierCount)} icon={Package} variant="accent" />
        <StatCard title="Total SKU" value={formatNumber(totalSku)} icon={FileText} variant="default" />
        <StatCard title="Total Order Qty" value={formatNumber(totalOrderQty)} icon={Package} variant="success" />
        <StatCard title="Diubah" value={formatNumber(modifiedCount)} icon={AlertTriangle} variant="warning" />
      </div>

      {/* PO Header Info */}
      <div className="bg-card rounded-xl border shadow-card p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">Informasi PO</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">No. PO</label>
            <Input value={poNumber} onChange={e => setPoNumber(e.target.value)} className="text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Tanggal</label>
            <Input value={new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })} readOnly className="text-sm bg-muted/50" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Catatan</label>
            <Input value={poNotes} onChange={e => setPoNotes(e.target.value)} placeholder="Catatan tambahan..." className="text-sm" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Cari produk..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <select
          value={selectedSupplier}
          onChange={e => setSelectedSupplier(e.target.value)}
          className="px-3 py-2 rounded-lg border bg-card text-sm text-foreground"
        >
          <option value="all">Semua Supplier ({supplierCount})</option>
          {supplierGroups.map(g => (
            <option key={g.supplier} value={g.supplier}>{g.supplier} ({g.totalSku} SKU)</option>
          ))}
        </select>
        <div className="flex gap-1">
          <Button onClick={expandAll} variant="outline" size="sm" className="text-xs">Expand All</Button>
          <Button onClick={collapseAll} variant="outline" size="sm" className="text-xs">Collapse All</Button>
        </div>
      </div>

      {/* Supplier Groups */}
      <div className="space-y-3">
        {filteredGroups.map(group => {
          const isExpanded = expandedSuppliers.has(group.supplier);
          return (
            <motion.div
              key={group.supplier}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card rounded-xl border shadow-card overflow-hidden"
            >
              {/* Supplier Header */}
              <button
                onClick={() => toggleSupplier(group.supplier)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  <div className="text-left">
                    <p className="text-sm font-semibold text-foreground">{group.supplier}</p>
                    <p className="text-[10px] text-muted-foreground">{group.totalSku} SKU • {formatNumber(group.totalQty)} pcs</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={(e) => { e.stopPropagation(); handlePrint(group.supplier); }}
                    variant="ghost" size="sm" className="gap-1 text-xs h-7"
                  >
                    <Printer className="w-3 h-3" /> Print
                  </Button>
                  <Button
                    onClick={(e) => { e.stopPropagation(); handleExportExcel(group.supplier); }}
                    variant="ghost" size="sm" className="gap-1 text-xs h-7 text-success hover:text-success hover:bg-success/10"
                  >
                    <Download className="w-3 h-3" /> Excel
                  </Button>
                </div>
              </button>

              {/* Items Table */}
              {isExpanded && (
                <div className="border-t overflow-x-auto">
                  <table className="w-full text-sm min-w-[650px]">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="text-left px-3 py-2.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Prioritas</th>
                        <th className="text-left px-3 py-2.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Produk</th>
                        <th className="text-right px-3 py-2.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Stok</th>
                        <th className="text-right px-3 py-2.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Suggest</th>
                        <th className="text-center px-3 py-2.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Order Qty</th>
                        <th className="text-center px-3 py-2.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider w-[60px]">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map(item => {
                        const p = priorityConfig[item.priority];
                        const isModified = item.adjustedQty !== item.suggestedQty;
                        return (
                          <tr key={item.kodeProduk} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                            <td className="px-3 py-2">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${p.className}`}>
                                {p.label}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <p className="font-medium text-foreground text-xs truncate max-w-[220px]">{item.namaPanjang}</p>
                              <p className="text-[10px] text-muted-foreground font-mono">{item.kodeProduk} • {item.brand}</p>
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-xs">{formatNumber(item.totalStock)}</td>
                            <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">{formatNumber(item.suggestedQty)}</td>
                            <td className="px-3 py-2">
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  variant="outline" size="icon"
                                  className="h-6 w-6"
                                  onClick={() => updateQty(item.kodeProduk, -(item.moq > 1 ? item.moq : 1))}
                                >
                                  <Minus className="w-3 h-3" />
                                </Button>
                                <Input
                                  type="number"
                                  value={item.adjustedQty}
                                  onChange={e => setQty(item.kodeProduk, parseInt(e.target.value) || 0)}
                                  className={`w-16 h-6 text-center text-xs font-mono px-1 ${isModified ? 'border-warning text-warning font-bold' : ''}`}
                                />
                                <Button
                                  variant="outline" size="icon"
                                  className="h-6 w-6"
                                  onClick={() => updateQty(item.kodeProduk, item.moq > 1 ? item.moq : 1)}
                                >
                                  <Plus className="w-3 h-3" />
                                </Button>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <Button
                                variant="ghost" size="icon"
                                className="h-6 w-6 text-destructive hover:text-destructive"
                                onClick={() => removeItem(item.kodeProduk)}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Removed Items */}
      {removedItems.length > 0 && (
        <div className="bg-card rounded-xl border shadow-card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-2">Item Dihapus ({removedItems.length})</h3>
          <div className="flex flex-wrap gap-2">
            {removedItems.map(item => (
              <button
                key={item.kodeProduk}
                onClick={() => restoreItem(item.kodeProduk)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border bg-muted/50 text-xs text-muted-foreground hover:bg-muted transition-colors"
              >
                <Plus className="w-3 h-3" />
                <span className="font-mono">{item.kodeProduk}</span>
                <span className="truncate max-w-[120px]">{item.namaPanjang}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
