import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/AppSidebar";
import DashboardPage from "./pages/DashboardPage";
import UploadPage from "./pages/UploadPage";
import InventoryPage from "./pages/InventoryPage";
import StoresPage from "./pages/StoresPage";
import OrdersPage from "./pages/OrdersPage";
import AverageDemandPage from "./pages/AverageDemandPage";
import POSupplierPage from "./pages/POSupplierPage";
import AnalysisPage from "./pages/AnalysisPage";
import SettingsPage from "./pages/SettingsPage";
import MovingStockPage from "./pages/MovingStockPage";
import HistoricalPage from "./pages/HistoricalPage";
import GuidePage from "./pages/GuidePage";
import NotFound from "./pages/NotFound";
import LoginPage from "./pages/LoginPage";
import UserManagementPage from "./pages/UserManagementPage";
import { AuthProvider, useAuth } from "@/lib/auth";

const queryClient = new QueryClient();

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  const email = user?.email?.toLowerCase() ?? "";
  if (email !== "budagbogor@gmail.com") return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppShell() {
  return (
    <div className="flex min-h-screen w-full">
      <AppSidebar />
      <main className="flex-1 min-w-0 pt-14 md:pt-0 flex flex-col futuristic-surface">
        <div className="relative z-10 flex-1 p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto w-full">
          <Outlet />
        </div>
        <footer className="relative z-10 border-t py-4 text-center text-xs text-muted-foreground">
          Copyright © 2026 Mobeng Inventory Planner
        </footer>
      </main>
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              element={
                <RequireAuth>
                  <AppShell />
                </RequireAuth>
              }
            >
              <Route path="/" element={<DashboardPage />} />
              <Route path="/analysis" element={<AnalysisPage />} />
              <Route path="/moving-stock" element={<MovingStockPage />} />
              <Route path="/historical" element={<HistoricalPage />} />
              <Route path="/upload" element={<UploadPage />} />
              <Route path="/average-demand" element={<AverageDemandPage />} />
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/stores" element={<StoresPage />} />
              <Route path="/orders" element={<OrdersPage />} />
              <Route path="/po-supplier" element={<POSupplierPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/guide" element={<GuidePage />} />
              <Route
                path="/user-management"
                element={
                  <RequireAdmin>
                    <UserManagementPage />
                  </RequireAdmin>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
