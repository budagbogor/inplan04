import { NavLink as RouterNavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  Upload, 
  Package, 
  ShoppingCart, 
  Store,
  TrendingUp,
  Settings,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  FileText,
  Activity,
  BookOpen,
  BarChart3
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import logoImg from '@/assets/logo.png';

const navItems = [
  { to: '/upload', label: 'Upload Data', icon: Upload },
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/analysis', label: 'Analisa', icon: Activity },
  { to: '/moving-stock', label: 'Moving Stock', icon: BarChart3 },
  { to: '/average-demand', label: 'Avg Demand', icon: TrendingUp },
  { to: '/inventory', label: 'Klasifikasi ABC', icon: Package },
  { to: '/stores', label: 'Suggest Order Per Toko', icon: Store },
  { to: '/orders', label: 'Suggest Order per SKU', icon: ShoppingCart },
  { to: '/po-supplier', label: 'PO to Supplier', icon: FileText },
  { to: '/settings', label: 'Pengaturan', icon: Settings },
  { to: '/guide', label: 'Panduan', icon: BookOpen },
];

export function AppSidebar() {
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    if (isMobile) setMobileOpen(false);
  }, [isMobile]);

  // Mobile: overlay sidebar
  if (isMobile) {
    return (
      <>
        {/* Mobile top bar */}
        <div className="fixed top-0 left-0 right-0 z-40 h-14 gradient-sidebar border-b border-sidebar-border flex items-center px-4 gap-3">
          <button onClick={() => setMobileOpen(true)} className="p-2 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center">
              <Package className="w-3.5 h-3.5 text-accent-foreground" />
            </div>
            <h1 className="text-sm font-bold text-sidebar-accent-foreground tracking-tight">Mobeng</h1>
          </div>
        </div>

        {/* Overlay */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
        )}

        {/* Slide-out sidebar */}
        <aside className={cn(
          "fixed top-0 left-0 z-50 h-full w-64 gradient-sidebar border-r border-sidebar-border transition-transform duration-300 flex flex-col",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <div className="flex items-center justify-between px-4 py-4 border-b border-sidebar-border">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
                <Package className="w-4 h-4 text-accent-foreground" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-sidebar-accent-foreground tracking-tight">Mobeng</h1>
                <p className="text-[10px] text-sidebar-foreground/60 uppercase tracking-widest">Inventory Planner</p>
              </div>
            </div>
            <button onClick={() => setMobileOpen(false)} className="p-2 rounded-lg text-sidebar-foreground/50 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/50 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
            {navItems.map((item) => (
              <RouterNavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) => cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-accent"
                    : "text-sidebar-foreground/70 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/50"
                )}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </RouterNavLink>
            ))}
          </nav>
        </aside>
      </>
    );
  }

  // Desktop: collapsible sidebar
  return (
    <aside className={cn(
      "gradient-sidebar flex flex-col h-screen sticky top-0 transition-all duration-300 border-r border-sidebar-border",
      collapsed ? "w-[68px]" : "w-60"
    )}>
      <div className={cn("flex items-center gap-2 py-5 border-b border-sidebar-border", collapsed ? "px-3 justify-center" : "px-4")}>
        <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shrink-0">
          <Package className="w-4 h-4 text-accent-foreground" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="text-sm font-bold text-sidebar-accent-foreground tracking-tight">Mobeng</h1>
            <p className="text-[10px] text-sidebar-foreground/60 uppercase tracking-widest">Inventory Planner</p>
          </div>
        )}
      </div>

      <nav className="flex-1 py-3 px-2 space-y-0.5">
        {navItems.map((item) => (
          <RouterNavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => cn(
              "flex items-center gap-3 rounded-lg text-sm font-medium transition-colors",
              collapsed ? "px-2 py-2.5 justify-center" : "px-3 py-2.5",
              isActive
                ? "bg-sidebar-accent text-accent"
                : "text-sidebar-foreground/70 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/50"
            )}
            title={collapsed ? item.label : undefined}
          >
            <item.icon className="w-4 h-4 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </RouterNavLink>
        ))}
      </nav>

      <div className={cn("border-t border-sidebar-border flex items-center", collapsed ? "flex-col gap-2 p-2" : "justify-between px-3 py-3")}>
        <img src={logoImg} alt="Mobeng Logo" className="w-8 h-8 rounded-lg object-contain" />
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-2 rounded-lg text-sidebar-foreground/50 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/50 transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
}
