import { useState, useEffect, useMemo } from 'react';
import { Settings, Plus, Trash2, Save, RotateCcw, Search, Package, ChevronDown, Truck, Layers, BookOpen, RefreshCcw, Brain, Key, Zap } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { getOrderSettings, saveOrderSettings, DEFAULT_ORDER_SETTINGS, syncSettingsWithData } from '@/lib/orderSettings';
import { getSOHData, invalidateCache } from '@/lib/dataStore';
import type { OrderSettings, SupplierLeadTime, SOHRecord } from '@/lib/types';
import { cn } from '@/lib/utils';
import { getAISettings, saveAISettings, SUMOPOD_MODELS, OPENROUTER_FREE_MODELS, SUMOPOD_BASE_URL, OPENROUTER_BASE_URL } from '@/lib/aiSettings';

interface SkuInfo {
  kodeProduk: string;
  namaPanjang: string;
  brand: string;
  category: string;
  supplier: string;
}

interface StoreInfo {
  kodeToko: string;
  namaToko: string;
  namaCabang: string;
}

/* ── Collapsible Section wrapper ────────────────────────── */
function Section({
  icon: Icon,
  title,
  description,
  badge,
  defaultOpen = false,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  badge?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <button className="w-full text-left">
            <CardHeader className={cn("pb-0", !open && "pb-4")}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className="w-4 h-4 text-accent shrink-0" />
                  <CardTitle className="text-sm sm:text-base truncate">{title}</CardTitle>
                  {badge && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20 shrink-0">
                      {badge}
                    </span>
                  )}
                </div>
                <ChevronDown className={cn("w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200", open && "rotate-180")} />
              </div>
              <CardDescription className="text-xs mt-1">{description}</CardDescription>
            </CardHeader>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-4">
            {children}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<OrderSettings>(DEFAULT_ORDER_SETTINGS);
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [allStores, setAllStores] = useState<StoreInfo[]>([]);
  const [allVendors, setAllVendors] = useState<string[]>([]);
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [allBrands, setAllBrands] = useState<string[]>([]);
  const [allSkus, setAllSkus] = useState<SkuInfo[]>([]);
  const [storeSearch, setStoreSearch] = useState('');
  const [vendorSearch, setVendorSearch] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
  const [brandSearch, setBrandSearch] = useState('');
  const [skuSearch, setSkuSearch] = useState('');
  const [newSupplier, setNewSupplier] = useState('');
  
  // AI Settings State
  const [aiSettings, setAiSettings] = useState(getAISettings());
  const [isTestingAi, setIsTestingAi] = useState(false);


  const [refreshing, setRefreshing] = useState(false);

  const fetchAppData = async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
      invalidateCache();
    }
    
    try {
      const updatedSettings = await syncSettingsWithData();
      setSettings(updatedSettings);

      // Re-fetch SOH to populate the specific filter lists in UI (selectors)
      const soh = await getSOHData();
      
      const s = new Set(soh.map(r => r.supplier).filter(Boolean));
      setSuppliers(Array.from(s).sort());
      setAllVendors(Array.from(s).sort());

      const catsArray = Array.from(new Set(soh.map(r => r.category).filter(Boolean))).sort();
      setAllCategories(catsArray);

      const brandsArray = Array.from(new Set(soh.map(r => r.brand).filter(Boolean))).sort();
      setAllBrands(brandsArray);

      const skuMap = new Map<string, SkuInfo>();
      for (const r of soh) {
        if (!skuMap.has(r.kodeProduk)) {
          skuMap.set(r.kodeProduk, {
            kodeProduk: r.kodeProduk, namaPanjang: r.namaPanjang,
            brand: r.brand, category: r.category, supplier: r.supplier,
          });
        }
      }
      setAllSkus(Array.from(skuMap.values()).sort((a, b) => a.kodeProduk.localeCompare(b.kodeProduk)));

      const storeMap = new Map<string, StoreInfo>();
      for (const r of soh) {
        if (!storeMap.has(r.kodeToko)) {
          storeMap.set(r.kodeToko, { kodeToko: r.kodeToko, namaToko: r.namaToko, namaCabang: r.namaCabang });
        }
      }
      const storeList = Array.from(storeMap.values()).sort((a, b) => a.namaToko.localeCompare(b.namaToko));
      setAllStores(storeList);

      if (isManualRefresh) {
        toast.success('Data diperbarui dari server');
      }
    } catch (err) {
      console.error(err);
      toast.error('Gagal memuat data terbaru');
    } finally {
      if (isManualRefresh) setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAppData();
  }, []);

  const handleRefresh = () => {
    fetchAppData(true);
  };

  const supplierMap = useMemo(() => {
    const map = new Map<string, SupplierLeadTime>();
    for (const s of settings.supplierLeadTimes) map.set(s.supplier, s);
    return map;
  }, [settings.supplierLeadTimes]);

  const updateField = <K extends keyof OrderSettings>(key: K, value: OrderSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const updateSupplierSetting = (supplier: string, field: 'leadTimeDays' | 'moq', value: number) => {
    setSettings(prev => {
      const list = [...prev.supplierLeadTimes];
      const idx = list.findIndex(s => s.supplier === supplier);
      if (idx >= 0) {
        list[idx] = { ...list[idx], [field]: value };
      } else {
        list.push({ supplier, leadTimeDays: field === 'leadTimeDays' ? value : prev.defaultLeadTimeDays, moq: field === 'moq' ? value : 1 });
      }
      return { ...prev, supplierLeadTimes: list };
    });
  };

  const removeSupplierSetting = (supplier: string) => {
    setSettings(prev => ({
      ...prev,
      supplierLeadTimes: prev.supplierLeadTimes.filter(s => s.supplier !== supplier),
    }));
  };

  const addCustomSupplier = () => {
    const name = newSupplier.trim();
    if (!name) return;
    if (settings.supplierLeadTimes.some(s => s.supplier === name)) {
      toast.error('Supplier sudah ada');
      return;
    }
    setSettings(prev => ({
      ...prev,
      supplierLeadTimes: [...prev.supplierLeadTimes, { supplier: name, leadTimeDays: prev.defaultLeadTimeDays, moq: 1 }],
    }));
    setNewSupplier('');
  };

  const handleSave = () => {
    saveOrderSettings(settings);
    saveAISettings(aiSettings);
    toast.success('Pengaturan tersimpan');
  };

  const handleTestAi = async () => {
    if (!aiSettings.apiKey) {
      toast.error('Masukkan API Key terlebih dahulu');
      return;
    }
    
    setIsTestingAi(true);
    const isOpenRouter = aiSettings.provider === 'OpenRouter';
    const checkUrl = isOpenRouter ? `${OPENROUTER_BASE_URL}/models` : `${SUMOPOD_BASE_URL}/models`;

    try {
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${aiSettings.apiKey}`
      };
      if (isOpenRouter) {
        headers['HTTP-Referer'] = window.location.origin;
        headers['X-Title'] = 'Mobeng Inventory Planner';
      }

      const resp = await fetch(checkUrl, { headers });
      
      if (resp.ok) {
        toast.success(`Koneksi ${aiSettings.provider || 'API'} Berhasil!`);
      } else {
        const errData = await resp.json().catch(() => ({}));
        toast.error(`Koneksi Gagal: ${errData.error?.message || resp.statusText}`);
      }
    } catch (err) {
      toast.error(`Gagal menghubungi server ${aiSettings.provider}`);
    } finally {
      setIsTestingAi(false);
    }
  };

  const handleReset = () => {
    setSettings({ ...DEFAULT_ORDER_SETTINGS });
    saveOrderSettings(DEFAULT_ORDER_SETTINGS);
    toast.info('Pengaturan direset ke default');
  };

  const activeStoreCount = allStores.length - settings.excludedStores.length;
  const activeVendorCount = allVendors.length - (settings.excludedSuppliers?.length || 0);
  const activeCategoryCount = allCategories.length - (settings.excludedCategories?.length || 0);
  const activeBrandCount = allBrands.length - (settings.excludedBrands?.length || 0);
  const moqCount = Object.keys(settings.skuMoqs || {}).filter(k => (settings.skuMoqs || {})[k] > 0).length;

  return (
    <div className="space-y-3 sm:space-y-4 max-w-3xl mx-auto">
      <PageHeader title="Pengaturan Order" description="Parameter perhitungan reorder point & safety stock">
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleRefresh} variant="outline" size="sm" className="gap-1.5" disabled={refreshing}>
            <RefreshCcw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
            {refreshing ? 'Memuat...' : 'Refresh Data'}
          </Button>
          <Button onClick={handleReset} variant="outline" size="sm" className="gap-1.5">
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </Button>
          <Button onClick={handleSave} size="sm" className="gap-1.5">
            <Save className="w-3.5 h-3.5" /> Simpan
          </Button>
        </div>
      </PageHeader>

      {/* ── Pengaturan AI Agent ── */}
      <Section 
        icon={Brain} 
        title="Konfigurasi AI Engine" 
        description="Setting Provider & Model asisten AI untuk analisa strategis"
        badge={aiSettings.provider || 'SumoPod'}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Provider AI (Engine)</Label>
              <select 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={aiSettings.provider}
                onChange={e => setAiSettings(prev => ({ 
                  ...prev, 
                  provider: e.target.value,
                  model: e.target.value === 'SumoPod' ? 'gpt-4o-mini' : 'openrouter/auto' 
                }))}
              >
                <option value="SumoPod">SumoPod API</option>
                <option value="OpenRouter">OpenRouter (Free Auto-Switch / Other Models)</option>
              </select>
              <p className="text-[10px] text-muted-foreground">Pilih penyedia layanan kecerdasan buatan</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Pilihan Model AI</Label>
              <select 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={aiSettings.model}
                onChange={e => setAiSettings(prev => ({ ...prev, model: e.target.value }))}
              >
                {(aiSettings.provider === 'OpenRouter' ? OPENROUTER_FREE_MODELS : SUMOPOD_MODELS).map(m => (
                  <option key={m.id} value={m.id}>{m.name} ({m.provider})</option>
                ))}
              </select>
              <p className="text-[10px] text-muted-foreground">Pilih model yang akan digunakan untuk analisa</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">API KEY Global</Label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input 
                  type="password" 
                  placeholder="sk-..." 
                  className="pl-9"
                  value={aiSettings.apiKey}
                  onChange={e => setAiSettings(prev => ({ ...prev, apiKey: e.target.value }))}
                />
              </div>
              <p className="text-[10px] text-muted-foreground">Key akan berlaku global untuk engine {aiSettings.provider || 'SumoPod'}.</p>
            </div>
          </div>
          
          <div className="flex justify-end">
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-1.5"
              onClick={handleTestAi}
              disabled={isTestingAi}
            >
              <Zap className={cn("w-3.5 h-3.5 text-amber-500", isTestingAi && "animate-pulse")} />
              {isTestingAi ? 'Menghubungkan...' : 'Tes Koneksi'}
            </Button>
          </div>
        </div>
      </Section>

      {/* ── Parameter Umum ── */}
      <Section icon={Settings} title="Parameter Umum" description="Pengaturan default untuk perhitungan suggested order" defaultOpen>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
          <div className="space-y-1.5">
            <Label className="text-xs">Default Lead Time (hari)</Label>
            <Input type="number" min={1} value={settings.defaultLeadTimeDays} onChange={e => updateField('defaultLeadTimeDays', Number(e.target.value))} />
            <p className="text-[10px] text-muted-foreground">Waktu pengiriman dari supplier ke toko</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Review Period (hari)</Label>
            <Input type="number" min={1} value={settings.reviewPeriodDays} onChange={e => updateField('reviewPeriodDays', Number(e.target.value))} />
            <p className="text-[10px] text-muted-foreground">Interval review & pemesanan ulang</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Safety Stock Factor — Lead Time</Label>
            <Input type="number" min={0} step={0.1} value={settings.safetyStockLeadTimeFactor} onChange={e => updateField('safetyStockLeadTimeFactor', Number(e.target.value))} />
            <p className="text-[10px] text-muted-foreground">Pengali untuk ketidakpastian lead time</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Safety Stock Factor — Demand</Label>
            <Input type="number" min={0} step={0.1} value={settings.safetyStockDemandFactor} onChange={e => updateField('safetyStockDemandFactor', Number(e.target.value))} />
            <p className="text-[10px] text-muted-foreground">Pengali untuk variabilitas demand</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Target Service Level</Label>
            <Input type="number" min={0.5} max={0.999} step={0.01} value={settings.targetServiceLevel} onChange={e => updateField('targetServiceLevel', Number(e.target.value))} />
            <p className="text-[10px] text-muted-foreground">Tingkat layanan target (0.95 = 95%)</p>
          </div>
        </div>
      </Section>

      {/* ── Lead Time per Supplier ── */}
      <Section
        icon={Truck}
        title="Lead Time per Supplier"
        description="Override lead time per supplier. Supplier dari data SOH otomatis terdeteksi."
        badge={`${settings.supplierLeadTimes.length} override`}
      >
        <div className="space-y-3">
          {suppliers.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Supplier dari Data SOH</p>
              <div className="max-h-[300px] overflow-y-auto space-y-1.5 pr-1">
                {suppliers.map(supplier => {
                  const entry = supplierMap.get(supplier);
                  return (
                    <div key={supplier} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 bg-muted/30 rounded-lg p-3">
                      <span className="text-xs sm:text-sm font-medium sm:min-w-[140px] truncate">{supplier}</span>
                      <div className="flex items-center gap-3 flex-1">
                        <div className="flex items-center gap-1.5">
                          <Label className="text-[10px] text-muted-foreground whitespace-nowrap">Lead Time (hari)</Label>
                          <Input type="number" min={1} className="w-16 sm:w-20 h-8 text-xs" value={entry?.leadTimeDays ?? settings.defaultLeadTimeDays} onChange={e => updateSupplierSetting(supplier, 'leadTimeDays', Number(e.target.value))} />
                        </div>
                        {entry && (
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0" onClick={() => removeSupplierSetting(supplier)}>
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {settings.supplierLeadTimes.filter(s => !suppliers.includes(s.supplier)).map(entry => (
            <div key={entry.supplier} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 bg-muted/30 rounded-lg p-3">
              <span className="text-xs sm:text-sm font-medium sm:min-w-[140px] truncate">{entry.supplier}</span>
              <div className="flex items-center gap-3 flex-1">
                <div className="flex items-center gap-1.5">
                  <Label className="text-[10px] text-muted-foreground whitespace-nowrap">Lead Time (hari)</Label>
                  <Input type="number" min={1} className="w-16 sm:w-20 h-8 text-xs" value={entry.leadTimeDays} onChange={e => updateSupplierSetting(entry.supplier, 'leadTimeDays', Number(e.target.value))} />
                </div>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0" onClick={() => removeSupplierSetting(entry.supplier)}>
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </div>
            </div>
          ))}

          <div className="flex items-center gap-2 pt-2 border-t">
            <Input placeholder="Nama supplier baru..." value={newSupplier} onChange={e => setNewSupplier(e.target.value)} className="flex-1" onKeyDown={e => e.key === 'Enter' && addCustomSupplier()} />
            <Button onClick={addCustomSupplier} variant="outline" size="sm" className="gap-1.5 shrink-0">
              <Plus className="w-4 h-4" /> Tambah
            </Button>
          </div>
        </div>
      </Section>

      {/* ── Filter Data ── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-accent" />
            <CardTitle className="text-sm sm:text-base">Filter Data</CardTitle>
          </div>
          <CardDescription className="text-xs">Pilih toko, vendor, divisi, dan brand yang diikutkan dalam kalkulasi</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 pt-2">
          {/* Toko */}
          <FilterSection
            title="Toko Aktif"
            badge={`${activeStoreCount}/${allStores.length}`}
            search={storeSearch}
            onSearchChange={setStoreSearch}
            searchPlaceholder="Cari toko..."
            onSelectAll={() => setSettings(prev => ({ ...prev, excludedStores: [] }))}
            onClearAll={() => setSettings(prev => ({ ...prev, excludedStores: allStores.map(s => s.kodeToko) }))}
            empty={allStores.length === 0}
          >
            <div className="max-h-[250px] overflow-y-auto rounded-lg border divide-y">
              {allStores
                .filter(st => {
                  if (!storeSearch) return true;
                  const q = storeSearch.toLowerCase();
                  return st.namaToko.toLowerCase().includes(q) || st.kodeToko.toLowerCase().includes(q) || st.namaCabang.toLowerCase().includes(q);
                })
                .map(store => {
                  const isActive = !settings.excludedStores.includes(store.kodeToko);
                  return (
                    <label key={store.kodeToko} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30 transition-colors cursor-pointer">
                      <Checkbox
                        checked={isActive}
                        onCheckedChange={(checked) => {
                          setSettings(prev => ({
                            ...prev,
                            excludedStores: checked
                              ? prev.excludedStores.filter(k => k !== store.kodeToko)
                              : [...prev.excludedStores, store.kodeToko],
                          }));
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-foreground truncate">{store.namaToko}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{store.kodeToko} • {store.namaCabang}</p>
                      </div>
                    </label>
                  );
                })}
            </div>
          </FilterSection>

          {/* Vendor */}
          <FilterSection
            title="Vendor Aktif"
            badge={`${activeVendorCount}/${allVendors.length}`}
            search={vendorSearch}
            onSearchChange={setVendorSearch}
            searchPlaceholder="Cari vendor..."
            onSelectAll={() => setSettings(prev => ({ ...prev, excludedSuppliers: [] }))}
            onClearAll={() => setSettings(prev => ({ ...prev, excludedSuppliers: [...allVendors] }))}
            empty={allVendors.length === 0}
          >
            <div className="max-h-[200px] overflow-y-auto rounded-lg border divide-y">
              {allVendors
                .filter(v => !vendorSearch || v.toLowerCase().includes(vendorSearch.toLowerCase()))
                .map(vendor => {
                  const isActive = !(settings.excludedSuppliers || []).includes(vendor);
                  return (
                    <label key={vendor} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30 transition-colors cursor-pointer">
                      <Checkbox
                        checked={isActive}
                        onCheckedChange={(checked) => {
                          setSettings(prev => ({
                            ...prev,
                            excludedSuppliers: checked
                              ? (prev.excludedSuppliers || []).filter(k => k !== vendor)
                              : [...(prev.excludedSuppliers || []), vendor],
                          }));
                        }}
                      />
                      <span className="text-xs font-medium text-foreground truncate">{vendor}</span>
                    </label>
                  );
                })}
            </div>
          </FilterSection>

          {/* Divisi */}
          <FilterSection
            title="Divisi Aktif"
            badge={`${activeCategoryCount}/${allCategories.length}`}
            search={categorySearch}
            onSearchChange={setCategorySearch}
            searchPlaceholder="Cari divisi..."
            onSelectAll={() => setSettings(prev => ({ ...prev, excludedCategories: [] }))}
            onClearAll={() => setSettings(prev => ({ ...prev, excludedCategories: [...allCategories] }))}
            empty={allCategories.length === 0}
          >
            <div className="max-h-[200px] overflow-y-auto rounded-lg border divide-y">
              {allCategories
                .filter(c => !categorySearch || c.toLowerCase().includes(categorySearch.toLowerCase()))
                .map(cat => {
                  const isActive = !(settings.excludedCategories || []).includes(cat);
                  return (
                    <label key={cat} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30 transition-colors cursor-pointer">
                      <Checkbox
                        checked={isActive}
                        onCheckedChange={(checked) => {
                          setSettings(prev => ({
                            ...prev,
                            excludedCategories: checked
                              ? (prev.excludedCategories || []).filter(k => k !== cat)
                              : [...(prev.excludedCategories || []), cat],
                          }));
                        }}
                      />
                      <span className="text-xs font-medium text-foreground truncate">{cat}</span>
                    </label>
                  );
                })}
            </div>
          </FilterSection>

          {/* Brand */}
          <FilterSection
            title="Brand Aktif"
            badge={`${activeBrandCount}/${allBrands.length}`}
            search={brandSearch}
            onSearchChange={setBrandSearch}
            searchPlaceholder="Cari brand..."
            onSelectAll={() => setSettings(prev => ({ ...prev, excludedBrands: [] }))}
            onClearAll={() => setSettings(prev => ({ ...prev, excludedBrands: [...allBrands] }))}
            empty={allBrands.length === 0}
          >
            <div className="max-h-[200px] overflow-y-auto rounded-lg border divide-y">
              {allBrands
                .filter(b => !brandSearch || b.toLowerCase().includes(brandSearch.toLowerCase()))
                .map(brand => {
                  const isActive = !(settings.excludedBrands || []).includes(brand);
                  return (
                    <label key={brand} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30 transition-colors cursor-pointer">
                      <Checkbox
                        checked={isActive}
                        onCheckedChange={(checked) => {
                          setSettings(prev => ({
                            ...prev,
                            excludedBrands: checked
                              ? (prev.excludedBrands || []).filter(k => k !== brand)
                              : [...(prev.excludedBrands || []), brand],
                          }));
                        }}
                      />
                      <span className="text-xs font-medium text-foreground truncate">{brand}</span>
                    </label>
                  );
                })}
            </div>
          </FilterSection>
        </CardContent>
      </Card>

      {/* ── SKU & MOQ ── */}
      <Section
        icon={Package}
        title="Daftar SKU & MOQ"
        description="Setting MOQ per SKU. Kosongkan untuk menggunakan MOQ supplier."
        badge={moqCount > 0 ? `${moqCount} custom` : undefined}
      >
        {allSkus.length > 0 ? (
          <>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Cari SKU, nama produk, brand..." value={skuSearch} onChange={e => setSkuSearch(e.target.value)} className="pl-9" />
              </div>
            </div>
            <div className="max-h-[400px] overflow-y-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted z-10">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Kode Produk</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden sm:table-cell">Nama Produk</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden md:table-cell">Brand</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden md:table-cell">Supplier</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground w-24">MOQ</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {allSkus
                    .filter(sku => {
                      if (!skuSearch) return true;
                      const q = skuSearch.toLowerCase();
                      return sku.kodeProduk.toLowerCase().includes(q) || sku.namaPanjang.toLowerCase().includes(q) || sku.brand.toLowerCase().includes(q) || sku.supplier.toLowerCase().includes(q);
                    })
                    .map(sku => (
                      <tr key={sku.kodeProduk} className="hover:bg-muted/30 transition-colors">
                        <td className="px-3 py-2 font-mono">{sku.kodeProduk}</td>
                        <td className="px-3 py-2 truncate max-w-[200px] hidden sm:table-cell">{sku.namaPanjang}</td>
                        <td className="px-3 py-2 hidden md:table-cell">{sku.brand}</td>
                        <td className="px-3 py-2 hidden md:table-cell">{sku.supplier}</td>
                        <td className="px-3 py-2 text-right">
                          <Input
                            type="number" min={0}
                            className="w-20 h-7 text-xs text-right ml-auto"
                            placeholder="-"
                            value={(settings.skuMoqs || {})[sku.kodeProduk] || ''}
                            onChange={e => {
                              const val = Number(e.target.value);
                              setSettings(prev => {
                                const moqs = { ...(prev.skuMoqs || {}) };
                                if (val > 0) moqs[sku.kodeProduk] = val;
                                else delete moqs[sku.kodeProduk];
                                return { ...prev, skuMoqs: moqs };
                              });
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Upload data SOH untuk melihat daftar SKU.</p>
        )}
      </Section>

    </div>
  );
}

/* ── Reusable sub-components ────────────────────────────── */

function FilterSection({
  title,
  badge,
  search,
  onSearchChange,
  searchPlaceholder,
  onSelectAll,
  onClearAll,
  empty,
  children,
}: {
  title: string;
  badge: string;
  search: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder: string;
  onSelectAll: () => void;
  onClearAll: () => void;
  empty: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  if (empty) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-muted/40 transition-colors text-left">
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm font-medium text-foreground">{title}</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{badge}</span>
          </div>
          <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform duration-200", open && "rotate-180")} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-1 pb-2 space-y-2">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder={searchPlaceholder} value={search} onChange={e => onSearchChange(e.target.value)} className="pl-9 h-8 text-xs" />
            </div>
            <div className="flex gap-1.5">
              <Button variant="outline" size="sm" onClick={onSelectAll} className="text-[10px] h-8 px-2">Pilih Semua</Button>
              <Button variant="outline" size="sm" onClick={onClearAll} className="text-[10px] h-8 px-2">Hapus Semua</Button>
            </div>
          </div>
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

