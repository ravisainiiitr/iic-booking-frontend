import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft,
  Banknote,
  ChevronRight,
  CreditCard,
  FileStack,
  FolderTree,
  Mail,
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
import { hasAdminModule } from "@/lib/adminPanelAccess";
import { toast } from "sonner";

type SubCard = {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  /** Permission code (besides Main Admin) required for a Department Admin to see this tile. */
  requiresPermission?: string;
  /** Institute-wide singleton/config; Main Admin only, never shown to Department Admin. */
  mainAdminOnly?: boolean;
  /** Admin Settings module key (registry) this card maps to, for the module-based access system. */
  moduleKey?: string;
};

/** Cards corresponding to Django admin/users/ sections. Each links to admin section that mirrors Django admin functionality. */
const USER_MANAGEMENT_CARDS: SubCard[] = [
  {
    key: "users",
    label: "Users",
    description: "Manage users: list, add, edit, approve/reject (mirrors Django admin/users/user/)",
    icon: <Users className="h-6 w-6" />,
    path: "/admin/section/users",
    requiresPermission: "users.manage",
    moduleKey: "user_management.users",
  },
  {
    key: "departments",
    label: "Departments",
    description: "Manage departments: name, code, type (mirrors Django admin/users/department/)",
    icon: <Building2 className="h-6 w-6" />,
    path: "/admin/section/departments",
    requiresPermission: "users.manage",
    moduleKey: "user_management.departments",
  },
  {
    key: "projects",
    label: "Projects",
    description: "Manage projects: name, code, agency, faculty, dates (mirrors Django admin/users/project/)",
    icon: <FolderTree className="h-6 w-6" />,
    path: "/admin/section/projects",
    requiresPermission: "users.manage",
    moduleKey: "user_management.projects",
  },
  {
    key: "wallets",
    label: "Wallets",
    description: "View user wallets and total balance (mirrors Django admin/users/wallet/)",
    icon: <Wallet className="h-6 w-6" />,
    path: "/admin/section/wallets",
    requiresPermission: "admin_settings.wallet",
    moduleKey: "user_management.wallets",
  },
  {
    key: "subWallets",
    label: "Sub-Wallets",
    description: "Department-wise balances; credit/debit (mirrors Django admin/users/subwallet/)",
    icon: <CreditCard className="h-6 w-6" />,
    path: "/admin/section/subWallets",
    requiresPermission: "admin_settings.wallet",
    moduleKey: "user_management.sub_wallets",
  },
  {
    key: "subWalletTransactions",
    label: "Sub-Wallet Transactions",
    description: "View transaction history (mirrors Django admin/users/subwallettransaction/)",
    icon: <Receipt className="h-6 w-6" />,
    path: "/admin/section/subWalletTransactions",
    requiresPermission: "admin_settings.wallet",
    moduleKey: "user_management.sub_wallet_transactions",
  },
  {
    key: "walletRazorpayOrders",
    label: "Wallet Razorpay Orders",
    description: "View Razorpay recharge orders (mirrors Django admin/users/walletrazorpayorder/)",
    icon: <Landmark className="h-6 w-6" />,
    path: "/admin/section/walletRazorpayOrders",
    requiresPermission: "admin_settings.wallet",
    moduleKey: "user_management.wallet_razorpay_orders",
  },
  {
    key: "walletRechargeRequests",
    label: "Wallet Recharge Requests",
    description: "View and manage recharge requests (mirrors Django admin/users/walletrechargerequest/)",
    icon: <ShoppingCart className="h-6 w-6" />,
    path: "/admin/section/walletRechargeRequests",
    requiresPermission: "admin_settings.wallet",
    moduleKey: "user_management.wallet_recharge_requests",
  },
  {
    key: "userDocuments",
    label: "User Documents",
    description: "Manage user-uploaded documents (mirrors Django admin/users/userdocument/)",
    icon: <FileStack className="h-6 w-6" />,
    path: "/admin/section/userDocuments",
    requiresPermission: "users.manage",
    moduleKey: "user_management.user_documents",
  },
  {
    key: "userGroups",
    label: "User Groups",
    description: "Visibility groups and members (mirrors Django admin/users/usergroup/)",
    icon: <UserCog className="h-6 w-6" />,
    path: "/admin/section/userGroups",
    requiresPermission: "users.manage",
    moduleKey: "user_management.user_groups",
  },
  {
    key: "userGroupMembers",
    label: "User Group Members",
    description: "Assign users to groups (mirrors Django admin/users/usergroupmember/)",
    icon: <UserPlus className="h-6 w-6" />,
    path: "/admin/section/userGroupMembers",
    requiresPermission: "users.manage",
    moduleKey: "user_management.user_group_members",
  },
  {
    key: "walletSricSettings",
    label: "Wallet SRIC Office Notification Settings",
    description: "SRIC Office email recipients for faculty wallet recharge notifications",
    icon: <Mail className="h-6 w-6" />,
    path: "/admin-settings/wallet-sric-settings",
    mainAdminOnly: true,
    moduleKey: "user_management.wallet_sric_settings",
  },
  {
    key: "walletWithdrawalRequests",
    label: "Wallet Withdrawal Requests",
    description: "View withdrawal requests transferring wallet balance to bank accounts",
    icon: <Banknote className="h-6 w-6" />,
    path: "/admin-settings/wallet-withdrawal-requests",
    mainAdminOnly: true,
    moduleKey: "user_management.wallet_withdrawal_requests",
  },
  {
    key: "walletCreditFacilitySettings",
    label: "Wallet Credit Facility Settings",
    description: "Temporary credit line defaults for faculty wallet recharge requests",
    icon: <CreditCard className="h-6 w-6" />,
    path: "/admin-settings/wallet-credit-facility-settings",
    mainAdminOnly: true,
    moduleKey: "user_management.wallet_credit_facility_settings",
  },
  {
    key: "walletStudentRechargeSettings",
    label: "Wallet Student Recharge Settings",
    description: "Toggle IITR Student recharge of the shared faculty wallet",
    icon: <ShoppingCart className="h-6 w-6" />,
    path: "/admin-settings/wallet-student-recharge-settings",
    mainAdminOnly: true,
    moduleKey: "user_management.wallet_student_recharge_settings",
  },
];

export default function UserManagement() {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const userTypeStr = user?.user_type != null ? String(user.user_type).toLowerCase() : "";
  const isAdmin = userTypeStr === "admin";

  /** Tile visibility: Main Admin sees all; others need Admin Panel module grant for the card. */
  const canSeeCard = (card: SubCard): boolean => {
    if (isAdmin) return true;
    if (card.mainAdminOnly) return false;
    if (card.moduleKey) return hasAdminModule(user, card.moduleKey);
    return hasAdminModule(user, "user_management");
  };

  const visibleCards = USER_MANAGEMENT_CARDS.filter(canSeeCard);

  const canAccess = isAdmin || hasAdminModule(user, "user_management");

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !user) {
      navigate("/auth");
      return;
    }
    if (!canAccess) {
      toast.error("You do not have permission to access User Management.");
      navigate("/admin-settings");
      return;
    }
  }, [navigate, isAuthenticated, user?.id, canAccess, authLoading]);

  if (!canAccess && !authLoading) return null;

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
          {visibleCards.map((item) => (
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
