import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, useLocation } from "react-router-dom";
import { BackToDashboardButton } from "@/components/BackToDashboardButton";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { UserGuideProvider } from "@/components/UserGuide/UserGuideProvider";
import { ThemeProvider } from "next-themes";
import ChatWidget from "./components/ChatWidget";
import ResearchCopilot from "./components/ResearchCopilot";
import AppRoutes from "./routes/AppRoutes";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
    },
  },
});

function EmbedChrome() {
  const { search } = useLocation();
  const isEmbed = new URLSearchParams(search).get("embed") === "1";
  if (!isEmbed) return null;
  return (
    <div className="sticky top-0 z-50 flex items-center justify-between gap-3 border-b border-border bg-card/95 px-3 py-2 backdrop-blur">
      <p className="text-xs text-muted-foreground truncate">Viewing inside dashboard</p>
      <BackToDashboardButton size="sm" variant="outline" label="Back to overview" />
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider>
        <BrowserRouter>
          <AuthProvider>
            <UserGuideProvider>
            <NotificationProvider>
              <Toaster />
              <Sonner />
              <EmbedChrome />
              <ChatWidget />
              <ResearchCopilot />
              <AppRoutes />
            </NotificationProvider>
            </UserGuideProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
