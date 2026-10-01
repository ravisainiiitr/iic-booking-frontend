import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, useLocation } from "react-router-dom";
import { BackToDashboardButton } from "@/components/BackToDashboardButton";
import { GlobalBackButton } from "@/components/BackButton";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { UserGuideProvider } from "@/components/UserGuide/UserGuideProvider";
import { ThemeProvider } from "next-themes";
import ResearchCopilotLauncher from "./components/ResearchCopilot/ResearchCopilotLauncher";
import PendingActionsPrompt from "./components/PendingActions/PendingActionsPrompt";
import AppRoutes from "./routes/AppRoutes";
import { BuildUpdateNotifier } from "./components/BuildUpdateNotifier";

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
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <TooltipProvider>
      <BrowserRouter>
        <AuthProvider>
          <UserGuideProvider>
          <NotificationProvider>
            <Toaster />
            <Sonner />
            <BuildUpdateNotifier />
            <EmbedChrome />
            <GlobalBackButton />
            <ResearchCopilotLauncher />
            <PendingActionsPrompt />
            <AppRoutes />
          </NotificationProvider>
          </UserGuideProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </ThemeProvider>
);

export default App;
