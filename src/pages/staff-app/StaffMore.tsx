import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  CalendarOff,
  ChevronRight,
  Download,
  LayoutDashboard,
  LifeBuoy,
  ListOrdered,
  Loader2,
  LogOut,
  User,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient, type MobileAppRelease } from "@/lib/api";
import { APP_SIGN_IN_PATH, getNativeAppInfo, openInBrowser, type NativeAppInfo } from "@/lib/nativeApp";
import StaffTopBar from "./StaffTopBar";

const MobileDevicesCard = lazy(() => import("@/components/profile/MobileDevicesCard"));

function Row({ to, icon, label, hint }: { to: string; icon: ReactNode; label: string; hint?: string }) {
  return (
    <li>
      <Link
        to={to}
        className="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors active:bg-muted/60 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-foreground">{label}</span>
          {hint && <span className="block truncate text-xs text-muted-foreground">{hint}</span>}
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  );
}

export default function StaffMore() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [info, setInfo] = useState<NativeAppInfo | null>(null);
  const [update, setUpdate] = useState<MobileAppRelease | null>(null);
  const [updating, setUpdating] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const isOic = String(user?.user_type ?? "").toLowerCase() === "manager";

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const appInfo = await getNativeAppInfo();
      if (cancelled) return;
      setInfo(appInfo);
      if (!appInfo) return;
      const res = await apiClient.getMobileAppLatest();
      const latest = res.data?.release;
      if (!cancelled && latest && latest.version_code > Number(appInfo.appBuild || 0)) setUpdate(latest);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const downloadUpdate = async () => {
    setUpdating(true);
    try {
      const res = await apiClient.createMobileAppDownloadTicket();
      if (res.data?.url) await openInBrowser(res.data.url);
    } finally {
      setUpdating(false);
    }
  };

  const signOut = async () => {
    setSigningOut(true);
    try {
      await logout();
    } finally {
      navigate(APP_SIGN_IN_PATH, { replace: true });
    }
  };

  return (
    <div className="min-h-[100dvh] bg-muted/20">
      <StaffTopBar title="More" subtitle={user?.email ?? undefined} />
      <main className="mx-auto max-w-3xl space-y-5 px-4 py-4">
        {update && (
          <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
            <Download className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">Update available: version {update.version_name}</p>
              <p className="text-xs text-muted-foreground">Download it, then open the file to install.</p>
            </div>
            <Button size="sm" className="h-10" onClick={() => void downloadUpdate()} disabled={updating}>
              {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update"}
            </Button>
          </div>
        )}

        <ul className="divide-y divide-border/70 overflow-hidden rounded-xl border bg-card">
          <Row to="/leave-management" icon={<CalendarOff className="h-5 w-5" />} label="Intimate Unavailability" hint="Tell users and your OIC when you are away" />
          <Row to="/tickets" icon={<LifeBuoy className="h-5 w-5" />} label="Support tickets" />
          {isOic && <Row to="/urgent-requests" icon={<Zap className="h-5 w-5" />} label="Urgent requests" />}
          {isOic && <Row to="/equipment-waitlist" icon={<ListOrdered className="h-5 w-5" />} label="Waitlist" />}
          <Row to="/profile" icon={<User className="h-5 w-5" />} label="Profile" />
          <Row to="/dashboard?full=1" icon={<LayoutDashboard className="h-5 w-5" />} label="Full dashboard" hint="Everything from the website" />
        </ul>

        {info && (
          <Suspense fallback={null}>
            <div className="[&>div]:mt-0 [&>div]:max-w-none">
              <MobileDevicesCard />
            </div>
          </Suspense>
        )}

        <Button variant="outline" className="h-12 w-full text-base text-destructive hover:text-destructive" onClick={() => void signOut()} disabled={signingOut}>
          {signingOut ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <LogOut className="mr-2 h-5 w-5" />}
          Sign out
        </Button>

        {info && (
          <p className="text-center text-xs text-muted-foreground">
            IIC Booking app {info.appVersion} ({info.appBuild})
          </p>
        )}
      </main>
    </div>
  );
}
