import AuthorConfirmOnLogin from "@/components/impact/AuthorConfirmOnLogin";
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
import AppRoutes from "./routes/AppRoutes";
import { BuildUpdateNotifier } from "./components/BuildUpdateNotifier";
import PeakWindowGate from "./components/peak/PeakWindowGate";
import AccountLifecycleBanner from "./components/accountLifecycle/AccountLifecycleBanner";
import QuotaBreakdownHost from "./components/quota/QuotaBreakdownHost";
import { CallProvider } from "./components/calls/CallProvider";
import { UserCardProvider } from "./components/users/UserIdCardLink";
import { GlobalSearchHost } from "./components/search/GlobalSearch";
import StaffAppChrome from "./components/staff-app/StaffAppChrome";
import { useAppAudience } from "./lib/appShell";
import { isNativeApp } from "./lib/nativeApp";

/** The floating IITR Equipment Booking Assistant stays on the website and with administrators; on a phone it would cover the screen's own actions. */
function AssistantLauncher() {
  const audience = useAppAudience();
  const staffShell = audience === "staff" || audience === "user";
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
            <UserCardProvider>
            <CallProvider>
            <AccountLifecycleBanner />
            <EmbedChrome />
            <GlobalBackButton />
            <AssistantLauncher />
            <AppRoutes />
            <StaffAppChrome />
            <QuotaBreakdownHost />
            <GlobalSearchHost />
            <AuthorConfirmOnLogin />
            </CallProvider>
            </UserCardProvider>
          </PeakWindowGate>
        </NotificationProvider>
        </UserGuideProvider>
        </ProfileCompletionProvider>
      </AuthProvider>
    </BrowserRouter>
  </TooltipProvider>
);

export default App;
