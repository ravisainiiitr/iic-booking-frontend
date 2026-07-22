import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import DashboardHeader from "@/components/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, CreditCard, FlaskConical, Mail, ShieldCheck, UserCog, Wallet } from "lucide-react";

const MODULES = [
  {
    key: "oic",
    title: "Manage Officer In Charge",
    description: "Create, map, edit, and activate/deactivate OIC (manager) users in your department.",
    path: "/manage/department-administration/oic",
    icon: UserCog,
    gradient: "from-indigo-500 to-slate-700",
    button: "bg-indigo-600 hover:bg-indigo-700",
  },
  {
    key: "lab",
    title: "Manage Lab In Charge",
    description: "Create, map, edit, and activate/deactivate Lab Incharge (operator) users in your department.",
    path: "/manage/department-administration/lab",
    icon: FlaskConical,
    gradient: "from-teal-500 to-cyan-700",
    button: "bg-teal-700 hover:bg-teal-800",
  },
  {
    key: "accounts",
    title: "Manage Accounts In Charge",
    description:
      "Create and manage Department Account In-charge users. They monitor and manage department financial activities including wallet recharges, grant utilization, wallet transactions, credit facility usage, and related financial records.",
    path: "/manage/department-administration/accounts",
    icon: Wallet,
    gradient: "from-emerald-500 to-green-700",
    button: "bg-emerald-600 hover:bg-emerald-700",
  },
  {
    key: "faculty-credit",
    title: "Faculty Credit Facility",
    description:
      "Enable a one-time controlled negative balance for newly joined faculty on this department’s sub-wallet.",
    path: "/manage/department-administration/faculty-credit-facility",
    icon: CreditCard,
    gradient: "from-amber-500 to-orange-700",
    button: "bg-amber-600 hover:bg-amber-700",
  },
  {
    key: "sric-bill-section",
    title: "SRIC Bill Section Email",
    description:
      "Configure Bill Section email recipients used for Direct Cash Deposit / Bank Transfer wallet recharge requests.",
    path: "/admin-settings/wallet-sric-settings",
    icon: Mail,
    gradient: "from-sky-500 to-blue-700",
    button: "bg-sky-600 hover:bg-sky-700",
  },
] as const;

export default function DepartmentAdministrationHub() {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const userType = String(user?.user_type ?? "").toLowerCase();
  const isAdmin = userType === "admin";
  const isDeptAdmin = userType === "dept_admin";

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !user) {
      navigate("/auth");
      return;
    }
    if (!isAdmin && !isDeptAdmin) {
      toast.error("Only Main Admin or Department Administrator can open Department Administration.");
      navigate("/dashboard");
    }
  }, [authLoading, isAuthenticated, user?.id, isAdmin, isDeptAdmin, navigate]);

  if (!isAdmin && !isDeptAdmin && !authLoading) return null;

  return (
    <div className="page-shell">
      <DashboardHeader />
      <main className="container mx-auto max-w-5xl px-4 py-8 space-y-6">
        <div>
          <Button variant="ghost" size="sm" className="mb-2" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to dashboard
          </Button>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-8 w-8" />
            Department Administration
          </h1>
          <p className="mt-1 text-muted-foreground">
            Manage Officer In Charge, Lab In Charge, Accounts In Charge, Faculty Credit Facility, and SRIC Bill
            Section email settings for your department. All actions are limited to your assigned department.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
          {MODULES.map((m) => {
            const Icon = m.icon;
            return (
              <Card
                key={m.key}
                className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5"
                onClick={() => navigate(m.path)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-4 mb-1">
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${m.gradient} text-white shadow-lg`}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg leading-snug">{m.title}</CardTitle>
                    </div>
                  </div>
                  <CardDescription className="text-sm mt-2">{m.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className={`w-full text-white ${m.button}`}>Open</Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {isAdmin ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Permission caps (Main Admin)</CardTitle>
              <CardDescription>
                Configure department access flags and which permission caps Department Administrators may grant to
                staff.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={() => navigate("/admin/department-rbac")}>
                Open permission caps
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </main>
    </div>
  );
}
