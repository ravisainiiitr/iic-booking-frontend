import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft,
  ChevronRight,
  CreditCard,
  FileStack,
  FolderTree,
  Receipt,
  ShoppingCart,
  Users,
  Wallet,
  Building2,
  UserCog,
  UserPlus,
  Landmark,
} from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type SubCard = {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  path: string;
};

/** Cards corresponding to Django admin/users/ sections. Each links to admin section that mirrors Django admin functionality. */
const USER_MANAGEMENT_CARDS: SubCard[] = [
  {
    key: "users",
    label: "Users",
    description: "Manage users: list, add, edit, approve/reject (mirrors Django admin/users/user/)",
    icon: <Users className="h-6 w-6" />,
    path: "/admin/section/users",
  },
  {
    key: "departments",
    label: "Departments",
    description: "Manage departments: name, code, type (mirrors Django admin/users/department/)",
    icon: <Building2 className="h-6 w-6" />,
    path: "/admin/section/departments",
  },
  {
    key: "projects",
    label: "Projects",
    description: "Manage projects: name, code, agency, faculty, dates (mirrors Django admin/users/project/)",
    icon: <FolderTree className="h-6 w-6" />,
    path: "/admin/section/projects",
  },
  {
    key: "wallets",
    label: "Wallets",
    description: "View user wallets and total balance (mirrors Django admin/users/wallet/)",
    icon: <Wallet className="h-6 w-6" />,
    path: "/admin/section/wallets",
  },
  {
    key: "subWallets",
    label: "Sub-Wallets",
    description: "Department-wise balances; credit/debit (mirrors Django admin/users/subwallet/)",
    icon: <CreditCard className="h-6 w-6" />,
    path: "/admin/section/subWallets",
  },
  {
    key: "subWalletTransactions",
    label: "Sub-Wallet Transactions",
    description: "View transaction history (mirrors Django admin/users/subwallettransaction/)",
    icon: <Receipt className="h-6 w-6" />,
    path: "/admin/section/subWalletTransactions",
  },
  {
    key: "walletRazorpayOrders",
    label: "Wallet Razorpay Orders",
    description: "View Razorpay recharge orders (mirrors Django admin/users/walletrazorpayorder/)",
    icon: <Landmark className="h-6 w-6" />,
    path: "/admin/section/walletRazorpayOrders",
  },
  {
    key: "walletRechargeRequests",
    label: "Wallet Recharge Requests",
    description: "View and manage recharge requests (mirrors Django admin/users/walletrechargerequest/)",
    icon: <ShoppingCart className="h-6 w-6" />,
    path: "/admin/section/walletRechargeRequests",
  },
  {
    key: "userDocuments",
    label: "User Documents",
    description: "Manage user-uploaded documents (mirrors Django admin/users/userdocument/)",
    icon: <FileStack className="h-6 w-6" />,
    path: "/admin/section/userDocuments",
  },
  {
    key: "userGroups",
    label: "User Groups",
    description: "Visibility groups and members (mirrors Django admin/users/usergroup/)",
    icon: <UserCog className="h-6 w-6" />,
    path: "/admin/section/userGroups",
  },
  {
    key: "userGroupMembers",
    label: "User Group Members",
    description: "Assign users to groups (mirrors Django admin/users/usergroupmember/)",
    icon: <UserPlus className="h-6 w-6" />,
    path: "/admin/section/userGroupMembers",
  },
];

export default function UserManagement() {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const userTypeStr = user?.user_type != null ? String(user.user_type).toLowerCase() : "";
  const isAdmin = userTypeStr === "admin";

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !user) {
      navigate("/auth");
      return;
    }
    if (isAdmin) return; // Already admin by user_type
    const runChecks = async () => {
      try {
        const { apiClient } = await import("@/lib/api");
        if (!apiClient.getToken()) {
          navigate("/auth");
          return;
        }
        const isAdminPanel = apiClient.isAdminPanelUser(user.user_type);
        const roleRes = await apiClient.checkAdminRole(String(user.id));
        if (!isAdminPanel && roleRes.data?.is_admin !== true) {
          toast.error("Only admin can access User Management.");
          navigate("/admin-settings");
        }
      } catch {
        navigate("/admin-settings");
      }
    };
    runChecks();
  }, [navigate, isAuthenticated, user, isAdmin, authLoading]);

  if (!isAdmin && !authLoading) {
    try {
      const { apiClient } = require("@/lib/api");
      const isAdminPanel = user && apiClient.isAdminPanelUser(user.user_type);
      if (!isAdminPanel) return null;
    } catch {
      return null;
    }
  }

  return (
    <div className="page-shell">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/admin-settings")}
              className="mb-2"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Admin Settings
            </Button>
            <h1 className="text-3xl font-bold">User Management</h1>
            <p className="text-muted-foreground mt-1">
              Users, departments, projects, wallets, sub-wallets, transactions, recharge requests, documents, and groups (mirrors Django admin/users/).
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {USER_MANAGEMENT_CARDS.map((item) => (
            <Card
              key={item.key}
              className="cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5 border-border hover:border-primary/30"
              onClick={() => navigate(item.path)}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    {item.icon}
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                </div>
                <CardTitle className="text-base mt-3">{item.label}</CardTitle>
                <CardDescription className="text-sm">{item.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
