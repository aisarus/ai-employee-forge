import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AppHeader } from "@/components/AppHeader";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { I18nProvider } from "@/hooks/useI18n";
import Index from "./pages/Index";
import WorkspacePage from "./pages/WorkspacePage";
import MyAgents from "./pages/MyAgents";
import Integrations from "./pages/Integrations";
import Billing from "./pages/Billing";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import ErrorBoundary from "@/components/ErrorBoundary";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/auth" element={<ErrorBoundary><Auth /></ErrorBoundary>} />
        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-h-screen">
          <AppHeader />
          <main className="flex-1 flex flex-col">
            <Routes>
              <Route path="/" element={<ErrorBoundary><Index /></ErrorBoundary>} />
              <Route path="/workspace" element={<ErrorBoundary><WorkspacePage /></ErrorBoundary>} />
              <Route path="/agents" element={<ErrorBoundary><MyAgents /></ErrorBoundary>} />
              <Route path="/integrations" element={<ErrorBoundary><Integrations /></ErrorBoundary>} />
              <Route path="/billing" element={<ErrorBoundary><Billing /></ErrorBoundary>} />
              <Route path="/auth" element={<Navigate to="/" replace />} />
              <Route path="*" element={<ErrorBoundary><NotFound /></ErrorBoundary>} />
            </Routes>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <I18nProvider>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </I18nProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
