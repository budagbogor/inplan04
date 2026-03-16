import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
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
import GuidePage from "./pages/GuidePage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <div className="flex min-h-screen w-full">
          <AppSidebar />
          <main className="flex-1 min-w-0 pt-14 md:pt-0 flex flex-col">
            <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto w-full">
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/analysis" element={<AnalysisPage />} />
                <Route path="/upload" element={<UploadPage />} />
                <Route path="/average-demand" element={<AverageDemandPage />} />
                <Route path="/inventory" element={<InventoryPage />} />
                <Route path="/stores" element={<StoresPage />} />
                <Route path="/orders" element={<OrdersPage />} />
                <Route path="/po-supplier" element={<POSupplierPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/guide" element={<GuidePage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </div>
            <footer className="border-t py-4 text-center text-xs text-muted-foreground">
              Copyright © 2026 Mobeng Inventory Planner
            </footer>
          </main>
        </div>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
