import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Wrench,
  Users,
  Calendar,
  CalendarDays,
  Package,
  FolderTree,
  Layers,
  Banknote,
  FileText,
  UserCog,
  Wallet,
  CreditCard,
  Receipt,
  ArrowLeft,
  ChevronRight,
  Tag,
  UserCheck,
} from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";

type SectionItem = { key: string; label: string; icon: React.ReactNode };

const EQUIPMENT_SECTIONS: SectionItem[] = [
  { key: "bookings", label: "Bookings", icon: <Calendar className="h-5 w-5" /> },
  { key: "bookingAttemptLogs", label: "Booking requests log", icon: <FileText className="h-5 w-5" /> },
  { key: "dailySlots", label: "Daily Slots", icon: <CalendarDays className="h-5 w-5" /> },
  { key: "equipment", label: "Equipment", icon: <Package className="h-5 w-5" /> },
  { key: "equipmentCategories", label: "Equipment Categories", icon: <FolderTree className="h-5 w-5" /> },
  { key: "equipmentGroups", label: "Equipment Groups", icon: <Layers className="h-5 w-5" /> },
  { key: "holidays", label: "Holidays", icon: <Calendar className="h-5 w-5" /> },
  { key: "equipmentReports", label: "Equipment Reports", icon: <FileText className="h-5 w-5" /> },
];

const USERS_SECTIONS: SectionItem[] = [
  { key: "departments", label: "Departments", icon: <FolderTree className="h-5 w-5" /> },
  { key: "projects", label: "Projects", icon: <FileText className="h-5 w-5" /> },
  { key: "subWalletTransactions", label: "Sub-Wallet Transactions", icon: <Receipt className="h-5 w-5" /> },
  { key: "subWallets", label: "Sub-Wallets", icon: <Wallet className="h-5 w-5" /> },
  { key: "userDocuments", label: "User Documents", icon: <FileText className="h-5 w-5" /> },
  { key: "userGroupMembers", label: "User Group Members", icon: <UserCog className="h-5 w-5" /> },
  { key: "userGroups", label: "User Groups", icon: <Users className="h-5 w-5" /> },
  { key: "users", label: "Users", icon: <Users className="h-5 w-5" /> },
  { key: "walletRazorpayOrders", label: "Wallet Razorpay Orders", icon: <CreditCard className="h-5 w-5" /> },
  { key: "walletRechargeRequests", label: "Wallet Recharge Requests", icon: <Banknote className="h-5 w-5" /> },
  { key: "wallets", label: "Wallets", icon: <Wallet className="h-5 w-5" /> },
];

const AdminPanel = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const token = apiClient.getToken();
      if (!token) {
        navigate("/auth");
        return;
      }

      const userResponse = await apiClient.getCurrentUser();
      if (userResponse.error || !userResponse.data) {
        navigate("/auth");
        return;
      }

      const isAdminByType = apiClient.isAdminPanelUser(userResponse.data.user_type);
      const adminCheck = await apiClient.checkAdminRole(String(userResponse.data.id));
      const isAdminValue = isAdminByType || adminCheck.data?.is_admin === true;
      if (!isAdminValue) {
        toast({
          title: "Access Denied",
          description: "You don't have admin permissions",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      setIsAdmin(true);
    } catch (error) {
      console.error("Error checking admin access:", error);
      navigate("/");
    } finally {
      setCheckingAuth(false);
    }
  };

  if (checkingAuth || !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-accent/20">
      <DashboardHeader />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-5xl">
        <div className="flex flex-wrap items-center gap-4 mb-8">
          <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>

        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Manage equipment and users from the frontend. No Django Admin login required.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-1 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <UserCheck className="h-6 w-6" />
                External User Management
              </CardTitle>
              <CardDescription>
                Verify external departments/organizations and external users.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              <button
                type="button"
                onClick={() => navigate("/admin/external-user-management")}
                className="w-full flex items-center justify-between gap-3 rounded-lg border p-3 text-left hover:bg-accent/50 hover:border-primary/30 transition-colors"
              >
                <span className="flex items-center gap-3">
                  <UserCheck className="h-5 w-5" />
                  <span className="font-medium">Open external user tools</span>
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Wrench className="h-6 w-6" />
                Equipment
              </CardTitle>
              <CardDescription>
                Bookings, slots, equipment, categories, groups, and holidays
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              {EQUIPMENT_SECTIONS.map((section) => (
                <button
                  key={section.key}
                  type="button"
                  onClick={() =>
                    section.key === "bookingAttemptLogs"
                      ? navigate("/booking-attempt-logs")
                      : section.key === "equipmentReports"
                        ? navigate("/reports")
                        : navigate(`/admin/section/${section.key}`)
                  }
                  className="w-full flex items-center justify-between gap-3 rounded-lg border p-3 text-left hover:bg-accent/50 hover:border-primary/30 transition-colors"
                >
                  <span className="flex items-center gap-3">
                    {section.icon}
                    <span className="font-medium">{section.label}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Users className="h-6 w-6" />
                Users
              </CardTitle>
              <CardDescription>
                Departments, projects, wallets, user groups, and user management
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              {USERS_SECTIONS.map((section) => (
                <button
                  key={section.key}
                  type="button"
                  onClick={() => navigate(`/admin/section/${section.key}`)}
                  className="w-full flex items-center justify-between gap-3 rounded-lg border p-3 text-left hover:bg-accent/50 hover:border-primary/30 transition-colors"
                >
                  <span className="flex items-center gap-3">
                    {section.icon}
                    <span className="font-medium">{section.label}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Tag className="h-6 w-6" />
                Coupons
              </CardTitle>
              <CardDescription>
                Create discount coupons, assign them to users, and view consumption history.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              <button
                type="button"
                onClick={() => navigate("/admin/coupons")}
                className="w-full flex items-center justify-between gap-3 rounded-lg border p-3 text-left hover:bg-accent/50 hover:border-primary/30 transition-colors"
              >
                <span className="flex items-center gap-3">
                  <Tag className="h-5 w-5" />
                  <span className="font-medium">Create & manage coupons</span>
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default AdminPanel;
