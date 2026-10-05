import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Navigate, NavLink, Outlet, Route, Routes } from "react-router-dom";
import { Boxes, Loader2, Lock } from "lucide-react";
import { PageHero, PageShell, StandaloneOnly } from "@/components/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { lazyPage } from "@/lib/lazyPage";
import { cn } from "@/lib/utils";
import { errorMessage, type PmDepartment, type PmBootstrap } from "@/lib/procurementApi";
import { NativeSelect, ProcurementProvider, useProcurementBootstrap, usePm } from "./shared";

const DashboardPage = lazyPage(() => import("./ProcurementDashboard"));
const RequestsPage = lazyPage(() => import("./RequestsPage"));
const RequestWizard = lazyPage(() => import("./RequestWizard"));
const RequestDetail = lazyPage(() => import("./RequestDetail"));
const SmallPurchasePage = lazyPage(() => import("./SmallPurchasePage"));
const PlanningPage = lazyPage(() => import("./PlanningPage"));
const RecordsPage = lazyPage(() => import("./RecordsPage"));
const RecordDetail = lazyPage(() => import("./RecordDetail"));
const AssetsPage = lazyPage(() => import("./AssetsPage"));
const StockPage = lazyPage(() => import("./StockPage"));
const AmcPage = lazyPage(() => import("./AmcPage"));
const MastersPage = lazyPage(() => import("./MastersPage"));
const ReportsPage = lazyPage(() => import("./ReportsPage"));
const SettingsPage = lazyPage(() => import("./SettingsPage"));

interface Tab {
  to: string;
  label: string;
  show: (d: PmDepartment | null, boot: PmBootstrap) => boolean;
}

const has = (d: PmDepartment | null, perm: string) => !!d?.permissions.includes(perm);

const TABS: Tab[] = [
  { to: "", label: "Dashboard", show: (d) => !!d },
  { to: "requests", label: "Requests", show: (d) => !!d?.menus.my_requests },
  { to: "approvals", label: "Approvals", show: (d) => !!d?.menus.approvals },
  { to: "planning", label: "Plan / Non-Plan", show: (d) => !!(d?.menus.requirements || d?.menus.consolidation) },
  { to: "records", label: "Procurement", show: (d) => !!d?.menus.procurement },
  { to: "small-purchases", label: "Small purchases", show: (d) => !!d?.menus.small_purchases },
  { to: "assets", label: "Assets", show: (d) => !!d?.menus.assets },
  { to: "stock", label: "Consumables", show: (d) => !!d?.menus.consumables },
  { to: "amc", label: "AMC / Service", show: (d) => !!d?.menus.amc },
  { to: "masters", label: "Masters", show: (d) => has(d, "masters") },
  { to: "reports", label: "Reports & budget", show: (d) => !!d?.menus.reports || has(d, "budget") },
  { to: "settings", label: "Settings", show: (_d, boot) => boot.can_configure },
];

function Fallback() {
  return (
    <div className="flex justify-center py-16">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Loading" />
    </div>
  );
}

function Layout() {
  const { boot, dept, setDeptId } = usePm();
  const tabs = TABS.filter((t) => t.show(dept, boot));
  return (
    <PageShell>
      <main className="container mx-auto max-w-7xl space-y-4 px-4 py-5">
        <StandaloneOnly>
          <PageHero
            compact
            icon={<Boxes className="h-5 w-5" />}
            title="Procurement & Assets"
            description="Purchase requests, approvals, procurement, bills, asset register, consumable stock and AMC."
            actions={
              boot.departments.length > 1 ? (
                <NativeSelect
                  aria-label="Department"
                  className="h-9 w-64 border-white/30 bg-white/10 text-white [&>option]:text-foreground"
                  value={String(dept?.department.id ?? "")}
                  onChange={(e) => setDeptId(Number(e.target.value))}
                  options={boot.departments.map((d) => ({ value: String(d.department.id), label: d.department.name }))}
                />
              ) : dept ? (
                <span className="rounded-md bg-white/10 px-3 py-1.5 text-sm">{dept.department.name}</span>
              ) : null
            }
          />
        </StandaloneOnly>
        <nav aria-label="Procurement & Assets" className="flex gap-1 overflow-x-auto rounded-lg border bg-card p-1">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.to === ""}
              className={({ isActive }) =>
                cn(
                  "whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
        <Suspense fallback={<Fallback />}>
          <Outlet />
        </Suspense>
      </main>
    </PageShell>
  );
}

function Unavailable({ message }: { message: string }) {
  return (
    <PageShell>
      <main className="container mx-auto max-w-3xl px-4 py-10">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Lock className="h-8 w-8 text-muted-foreground" />
            <h1 className="text-lg font-semibold">Procurement & Assets</h1>
            <p className="max-w-md text-sm text-muted-foreground">{message}</p>
          </CardContent>
        </Card>
      </main>
    </PageShell>
  );
}

function DeptRequired({ children }: { children: JSX.Element }) {
  const { dept } = usePm();
  return dept ? children : <Navigate to="/procurement/settings" replace />;
}

// The app shell has no QueryClientProvider; the module brings its own so nothing outside it changes.
const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1, staleTime: 15_000 } },
});

export default function ProcurementRoutes() {
  return (
    <QueryClientProvider client={queryClient}>
      <ProcurementModule />
    </QueryClientProvider>
  );
}

function ProcurementModule() {
  const boot = useProcurementBootstrap();
  if (boot.isLoading) return <Fallback />;
  if (boot.error || !boot.data) {
    return <Unavailable message={boot.error ? errorMessage(boot.error) : "Unable to load the module."} />;
  }
  if (!boot.data.enabled && !boot.data.can_configure) {
    return <Unavailable message="Procurement & Assets is not enabled for your department, or you do not have a role in it yet." />;
  }
  return (
    <ProcurementProvider boot={boot.data}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<DeptRequired><DashboardPage /></DeptRequired>} />
          <Route path="requests" element={<DeptRequired><RequestsPage /></DeptRequired>} />
          <Route path="requests/new" element={<DeptRequired><RequestWizard /></DeptRequired>} />
          <Route path="requests/:id" element={<DeptRequired><RequestDetail /></DeptRequired>} />
          <Route path="approvals" element={<DeptRequired><RequestsPage inbox /></DeptRequired>} />
          <Route path="planning" element={<DeptRequired><PlanningPage /></DeptRequired>} />
          <Route path="records" element={<DeptRequired><RecordsPage /></DeptRequired>} />
          <Route path="records/:id" element={<DeptRequired><RecordDetail /></DeptRequired>} />
          <Route path="small-purchases" element={<DeptRequired><RecordsPage small /></DeptRequired>} />
          <Route path="small-purchases/new" element={<DeptRequired><SmallPurchasePage /></DeptRequired>} />
          <Route path="assets" element={<DeptRequired><AssetsPage /></DeptRequired>} />
          <Route path="assets/:id" element={<DeptRequired><AssetsPage /></DeptRequired>} />
          <Route path="stock" element={<DeptRequired><StockPage /></DeptRequired>} />
          <Route path="amc" element={<DeptRequired><AmcPage /></DeptRequired>} />
          <Route path="masters" element={<DeptRequired><MastersPage /></DeptRequired>} />
          <Route path="reports" element={<DeptRequired><ReportsPage /></DeptRequired>} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/procurement" replace />} />
        </Route>
      </Routes>
    </ProcurementProvider>
  );
}
