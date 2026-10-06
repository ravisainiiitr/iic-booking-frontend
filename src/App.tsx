import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, useLocation } from "react-router-dom";
import { BackToDashboardButton } from "@/components/BackToDashboardButton";
import { GlobalBackButton } from "@/components/BackButton";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { UserGuideProvider } from "@/components/UserGuide/UserGuideProvider";
import { ProfileCompletionProvider } from "@/components/ProfileCompletion/ProfileCompletionProvider";
import ResearchCopilotLauncher from "./components/ResearchCopilot/ResearchCopilotLauncher";
import PendingActionsPrompt from "./components/PendingActions/PendingActionsPrompt";
import AppRoutes from "./routes/AppRoutes";
import { BuildUpdateNotifier } from "./components/BuildUpdateNotifier";
import PeakWindowGate from "./components/peak/PeakWindowGate";
import QuotaBreakdownHost from "./components/quota/QuotaBreakdownHost";
import StaffAppChrome from "./components/staff-app/StaffAppChrome";
import { useStaffAppShell } from "./lib/staffApp";
import { isNativeApp } from "./lib/nativeApp";

/** The floating Booking Assistant stays on the website; the staff app keeps the screen uncluttered. */
function AssistantLauncher() {
  const staffShell = useStaffAppShell();
  const { pathname } = useLocation();
  const appScreen = isNativeApp() && (pathname === "/app" || pathname.startsWith("/app/"));
  return staffShell || appScreen ? null : <ResearchCopilotLauncher />;
}

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

// Light/dark follows the OS purely through CSS (prefers-color-scheme); there is no theme provider.
const App = () => (
  <TooltipProvider>
    <BrowserRouter>
      <AuthProvider>
        <ProfileCompletionProvider>
        <UserGuideProvider>
        <NotificationProvider>
          <Toaster />
          <Sonner />
          <BuildUpdateNotifier />
          <PeakWindowGate>
            <EmbedChrome />
            <GlobalBackButton />
            <AssistantLauncher />
            <PendingActionsPrompt />
            <AppRoutes />
            <StaffAppChrome />
            <QuotaBreakdownHost />
          </PeakWindowGate>
        </NotificationProvider>
        </UserGuideProvider>
        </ProfileCompletionProvider>
      </AuthProvider>
    </BrowserRouter>
  </TooltipProvider>
);

export default App;
