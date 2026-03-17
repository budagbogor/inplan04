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
  BarChart3,
  History,
  LogOut,
  User as UserIcon,
  Users
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import logoImg from '@/assets/logo.png';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

const navSections = [
  {
    title: 'Data',
    items: [{ to: '/upload', label: 'Upload Data', icon: Upload }],
  },
  {
    title: 'Insight',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/analysis', label: 'Analisa', icon: Activity },
      { to: '/moving-stock', label: 'Moving Stock', icon: BarChart3 },
      { to: '/historical', label: 'Tren Historis', icon: History },
      { to: '/average-demand', label: 'Avg Demand', icon: TrendingUp },
    ],
  },
  {
    title: 'Planning',
    items: [
      { to: '/inventory', label: 'Klasifikasi ABC', icon: Package },
      { to: '/stores', label: 'Suggest Order Per Toko', icon: Store },
      { to: '/orders', label: 'Suggest Order per SKU', icon: ShoppingCart },
      { to: '/po-supplier', label: 'PO to Supplier', icon: FileText },
    ],
  },
  {
    title: 'System',
    items: [
      { to: '/settings', label: 'Pengaturan', icon: Settings },
      { to: '/guide', label: 'Panduan', icon: BookOpen },
    ],
  },
];

export function AppSidebar() {
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, signOut } = useAuth();
  const isAdmin = (user?.email ?? '').toLowerCase() === 'budagbogor@gmail.com';
  const effectiveNavSections = isAdmin
    ? navSections.map((s) => {
        if (s.title !== 'System') return s;
        return {
          ...s,
          items: [...s.items, { to: '/user-management', label: 'User Management', icon: Users }],
        };
      })
    : navSections;

  // Close mobile menu on route change
  useEffect(() => {
    if (isMobile) setMobileOpen(false);
  }, [isMobile]);

  // Mobile: overlay sidebar
  if (isMobile) {
    return (
      <>
        <div className="fixed top-0 left-0 right-0 z-40 h-14 gradient-sidebar border-b border-sidebar-border flex items-center px-4 gap-3">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-lg text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/60 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sidebar-accent/60 border border-sidebar-border flex items-center justify-center overflow-hidden">
              <img src={logoImg} alt="Mobeng Logo" className="w-6 h-6 object-contain" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-sidebar-accent-foreground tracking-tight">Mobeng Inventory</div>
              <div className="text-[10px] text-sidebar-foreground/60 uppercase tracking-widest">Planner</div>
            </div>
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
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-sidebar-accent/60 border border-sidebar-border flex items-center justify-center overflow-hidden shrink-0">
                <img src={logoImg} alt="Mobeng Logo" className="w-7 h-7 object-contain" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-sidebar-accent-foreground tracking-tight truncate">Mobeng Inventory</div>
                <div className="text-[10px] text-sidebar-foreground/60 uppercase tracking-widest">Planner</div>
              </div>
            </div>
            <button
              onClick={() => setMobileOpen(false)}
              className="p-2 rounded-lg text-sidebar-foreground/50 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/60 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
            {effectiveNavSections.map((section) => (
              <div key={section.title} className="pb-2">
                <div className="px-3 py-2 text-[10px] uppercase tracking-widest text-sidebar-foreground/50">
                  {section.title}
                </div>
                <div className="space-y-0.5">
                  {section.items.map((item) => (
                    <RouterNavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === '/'}
                      onClick={() => setMobileOpen(false)}
                      className={({ isActive }) => cn(
                        "group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors border-l-2",
                        isActive
                          ? "bg-sidebar-accent/70 text-sidebar-accent-foreground border-sidebar-primary"
                          : "text-sidebar-foreground/75 border-transparent hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/50"
                      )}
                    >
                      <item.icon className="w-4 h-4 shrink-0 opacity-90 group-hover:opacity-100" />
                      <span className="truncate">{item.label}</span>
                    </RouterNavLink>
                  ))}
                </div>
              </div>
            ))}
          </nav>

          <div className="border-t border-sidebar-border px-3 py-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-sidebar-accent/60 flex items-center justify-center border border-sidebar-border">
                <UserIcon className="w-4 h-4 text-sidebar-accent-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-sidebar-accent-foreground truncate">
                  {user?.email || 'User'}
                </div>
                <div className="text-[11px] text-sidebar-foreground/60 truncate">Signed in</div>
              </div>
              <button
                onClick={async () => {
                  try {
                    await signOut();
                    toast.success('Logout berhasil');
                  } catch (err) {
                    const message = err instanceof Error ? err.message : 'Gagal logout';
                    toast.error(message);
                  }
                }}
                className="p-2 rounded-lg text-sidebar-foreground/60 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/60 transition-colors"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
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
      <div className={cn("border-b border-sidebar-border", collapsed ? "px-2 py-4" : "px-4 py-4")}>
        <div className={cn("flex items-center", collapsed ? "justify-center" : "justify-between")}>
          <div className={cn("flex items-center gap-3 min-w-0", collapsed && "justify-center")}>
            <div className="w-10 h-10 rounded-xl bg-sidebar-accent/60 border border-sidebar-border flex items-center justify-center overflow-hidden shrink-0">
              <img src={logoImg} alt="Mobeng Logo" className="w-7 h-7 object-contain" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="text-sm font-semibold text-sidebar-accent-foreground tracking-tight truncate">Mobeng Inventory</div>
                <div className="text-[10px] text-sidebar-foreground/60 uppercase tracking-widest">Planner</div>
              </div>
            )}
          </div>

          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              className="p-2 rounded-lg text-sidebar-foreground/60 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/60 transition-colors"
              title="Collapse"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <nav className="flex-1 py-3 px-2 overflow-y-auto">
        {effectiveNavSections.map((section) => (
          <div key={section.title} className="pb-2">
            {!collapsed && (
              <div className="px-3 py-2 text-[10px] uppercase tracking-widest text-sidebar-foreground/50">
                {section.title}
              </div>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <RouterNavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) => cn(
                    "group flex items-center gap-3 rounded-lg text-sm font-medium transition-colors border-l-2",
                    collapsed ? "px-2 py-2.5 justify-center" : "px-3 py-2.5",
                    isActive
                      ? "bg-sidebar-accent/70 text-sidebar-accent-foreground border-sidebar-primary"
                      : "text-sidebar-foreground/75 border-transparent hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/50"
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <item.icon className="w-4 h-4 shrink-0 opacity-90 group-hover:opacity-100" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </RouterNavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border">
        <div className={cn("flex items-center", collapsed ? "flex-col gap-2 p-2" : "gap-2 px-3 py-3")}>
          {!collapsed && (
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="w-9 h-9 rounded-lg bg-sidebar-accent/60 flex items-center justify-center border border-sidebar-border shrink-0">
                <UserIcon className="w-4 h-4 text-sidebar-accent-foreground" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-sidebar-accent-foreground truncate">
                  {user?.email || 'User'}
                </div>
                <div className="text-[11px] text-sidebar-foreground/60 truncate">Signed in</div>
              </div>
            </div>
          )}

          {collapsed && (
            <div className="w-9 h-9 rounded-lg bg-sidebar-accent/60 flex items-center justify-center border border-sidebar-border">
              <UserIcon className="w-4 h-4 text-sidebar-accent-foreground" />
            </div>
          )}

          <div className={cn("flex items-center", collapsed ? "flex-col gap-2" : "gap-1")}>
            <button
              onClick={async () => {
                try {
                  await signOut();
                  toast.success('Logout berhasil');
                } catch (err) {
                  const message = err instanceof Error ? err.message : 'Gagal logout';
                  toast.error(message);
                }
              }}
              className="p-2 rounded-lg text-sidebar-foreground/50 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/50 transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-2 rounded-lg text-sidebar-foreground/50 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/50 transition-colors"
              title={collapsed ? "Expand" : "Collapse"}
            >
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
