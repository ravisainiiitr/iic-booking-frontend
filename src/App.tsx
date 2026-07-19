import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { UserGuideProvider } from "@/components/UserGuide/UserGuideProvider";
import { ThemeProvider } from "next-themes";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import EmailVerificationCallback from "./pages/EmailVerificationCallback";
import SelfVerify from "./pages/SelfVerify";
import Dashboard from "./pages/Dashboard";
import ProformaInvoice from "./pages/ProformaInvoice";
import EquipmentList from "./pages/EquipmentList";
import BookEquipment from "./pages/BookEquipment";
import BookingPayment from "./pages/BookingPayment";
import BookingNextSteps from "./pages/BookingNextSteps";
import MyBookings from "./pages/MyBookings";
import BookingManagement from "./pages/BookingManagement";
import UrgentRequests from "./pages/UrgentRequests";
import UrgentRequestsWallet from "./pages/UrgentRequestsWallet";
import MyUrgentRequests from "./pages/MyUrgentRequests";
import StudentManagement from "./pages/StudentManagement";
import BookingAttemptLogs from "./pages/BookingAttemptLogs";
import EquipmentWaitlist from "./pages/EquipmentWaitlist";
import TemporaryOIC from "./pages/TemporaryOIC";
import LeaveManagement from "./pages/LeaveManagement";
import OICLeaveManagement from "./pages/OICLeaveManagement";
import TeamCalendar from "./pages/TeamCalendar";
import TANominationCall from "./pages/TANominationCall";
import TANominationsLog from "./pages/TANominationsLog";
import MyNominationRequests from "./pages/MyNominationRequests";
import TAAssignments from "./pages/TAAssignments";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Wallet from "./pages/Wallet";
import Reports from "./pages/Reports";
import ReportBookingsList from "./pages/ReportBookingsList";
import AdminPanel from "./pages/AdminPanel";
import AdminSection from "./pages/AdminSection";
import DepartmentRbacManagement from "./pages/DepartmentRbacManagement";
import DepartmentAdministrationHub from "./pages/DepartmentAdministrationHub";
import DepartmentStaffManagement from "./pages/DepartmentStaffManagement";
import AdminHeroSlides from "./pages/AdminHeroSlides";
import ContentManagement from "./pages/ContentManagement";
import AdminSettings from "./pages/AdminSettings";
import AdminPanelAccessConfig from "./pages/AdminPanelAccessConfig";
import AdminModuleGuard from "./components/AdminModuleGuard";
import AdminSettingsAuth from "./pages/AdminSettingsAuth";
import AdminCommunication from "./pages/AdminCommunication";
import InboxEmail from "./pages/InboxEmail";
import AdminSettingsEquipment from "./pages/AdminSettingsEquipment";
import AdminSemesters from "./pages/AdminSemesters";
import AdminIcpmsStandards from "./pages/AdminIcpmsStandards";
import AdminEquipmentModeSchedules from "./pages/AdminEquipmentModeSchedules";
import AdminBookingChargeSettings from "./pages/AdminBookingChargeSettings";
import AdminBookingBufferConfig from "./pages/AdminBookingBufferConfig";
import AdminStudentNominations from "./pages/AdminStudentNominations";
import AdminWalletSricSettings from "./pages/AdminWalletSricSettings";
import AdminWalletWithdrawalRequests from "./pages/AdminWalletWithdrawalRequests";
import AdminWalletCreditFacilitySettings from "./pages/AdminWalletCreditFacilitySettings";
import AdminWalletStudentRechargeSettings from "./pages/AdminWalletStudentRechargeSettings";
import ProposeEquipment from "./pages/ProposeEquipment";
import EquipmentAdditionRequests from "./pages/EquipmentAdditionRequests";
import AdminSettingsSupport from "./pages/AdminSettingsSupport";
import AdminSettingsFeedback from "./pages/AdminSettingsFeedback";
import AdminSettingsQualityImprovement from "./pages/AdminSettingsQualityImprovement";
import AdminRewardsConfig from "./pages/AdminRewardsConfig";
import OICAccessories from "./pages/OICAccessories";
import OICPrintMaterials from "./pages/OICPrintMaterials";
import OICQuotaConfigurations from "./pages/OICQuotaConfigurations";
import OICMultiMode from "./pages/OICMultiMode";
import CalendarColorSettings from "./pages/CalendarColorSettings";
import InventoryManagement from "./pages/InventoryManagement";
import ProcurementWorkflow from "./pages/ProcurementWorkflow";
import EquipmentLifecycleHub from "./pages/EquipmentLifecycleHub";
import UserManagement from "./pages/UserManagement";
import SetupTestUsers from "./pages/SetupTestUsers";
import Profile from "./pages/Profile";
import PeriodicTable from "./pages/PeriodicTable";
import IcpmsStandardsTest from "./pages/IcpmsStandardsTest";
import Print3DAnalyzerTest from "./pages/Print3DAnalyzerTest";
import EquipmentProfile from "./pages/EquipmentProfile";
import Tickets from "./pages/Tickets";
import WalletRechargeRequestAction from "./pages/WalletRechargeRequestAction";
import WalletRechargeParse from "./pages/WalletRechargeParse";
import LegacyWalletImportTest from "./pages/LegacyWalletImportTest";
import CmsPageView from "./pages/CmsPageView";
import ExternalUserManagement from "./pages/ExternalUserManagement";
import OrganizationUsersManagement from "./pages/OrganizationUsersManagement";
import ExternalDepartmentAdditionVerification from "./pages/ExternalDepartmentAdditionVerification";
import ChatWidget from "./components/ChatWidget";
import UserGuidePreview from "./pages/UserGuidePreview";

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
              <ChatWidget />
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/auth/verify-email" element={<EmailVerificationCallback />} />
                <Route path="/auth/self-verify" element={<SelfVerify />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/equipments" element={<EquipmentList />} />
                <Route path="/book-equipment" element={<BookEquipment />} />
                <Route path="/bookings/:bookingId/payment" element={<BookingPayment />} />
                <Route path="/bookings/:bookingId/next-steps" element={<BookingNextSteps />} />
                <Route path="/equipment/:id" element={<EquipmentProfile />} />
                <Route path="/my-bookings" element={<MyBookings />} />
                <Route path="/booking-management" element={<BookingManagement />} />
                <Route path="/urgent-requests" element={<UrgentRequests />} />
                <Route path="/urgent-requests-wallet" element={<UrgentRequestsWallet />} />
                <Route path="/my-urgent-requests" element={<MyUrgentRequests />} />
                <Route path="/student-management" element={<StudentManagement />} />
                <Route path="/booking-attempt-logs" element={<ErrorBoundary fallbackTitle="Booking Attempt Log" backPath="/dashboard"><BookingAttemptLogs /></ErrorBoundary>} />
                <Route path="/booking-attempt-logs/" element={<ErrorBoundary fallbackTitle="Booking Attempt Log" backPath="/dashboard"><BookingAttemptLogs /></ErrorBoundary>} />
                <Route path="/equipment-waitlist" element={<ErrorBoundary fallbackTitle="Equipment Waitlist" backPath="/dashboard"><EquipmentWaitlist /></ErrorBoundary>} />
                <Route path="/temporary-oic" element={<ErrorBoundary fallbackTitle="Temporary OIC" backPath="/dashboard"><TemporaryOIC /></ErrorBoundary>} />
                <Route path="/leave-management" element={<ErrorBoundary fallbackTitle="Leave Management" backPath="/dashboard"><LeaveManagement /></ErrorBoundary>} />
                <Route path="/oic-leave-management" element={<ErrorBoundary fallbackTitle="Leave Management" backPath="/dashboard"><OICLeaveManagement /></ErrorBoundary>} />
                <Route path="/team-calendar" element={<ErrorBoundary fallbackTitle="Team Calendar" backPath="/dashboard"><TeamCalendar /></ErrorBoundary>} />
                <Route path="/ta-nomination-call" element={<TANominationCall />} />
                <Route path="/ta-assignments" element={<TAAssignments />} />
                <Route path="/ta-nominations-log" element={<TANominationsLog />} />
                <Route path="/my-nomination-requests" element={<MyNominationRequests />} />
                <Route path="/wallet" element={<Wallet />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/reports/bookings" element={<ReportBookingsList />} />
                <Route path="/proforma-invoice" element={<ProformaInvoice />} />
                {/* /admin is deprecated: everything is on /dashboard */}
                <Route path="/admin" element={<Navigate to="/dashboard" replace />} />
                <Route path="/admin/external-user-management" element={<ExternalUserManagement />} />
                <Route path="/admin/section/:section" element={<AdminSection />} />
                <Route path="/admin/department-rbac" element={<DepartmentRbacManagement />} />
                <Route path="/admin/department-administration" element={<DepartmentAdministrationHub />} />
                <Route path="/admin/department-administration/:role" element={<DepartmentStaffManagement />} />
                <Route path="/manage/external-user-management" element={<ExternalUserManagement />} />
                <Route path="/manage/external-user-management/departments" element={<ExternalDepartmentAdditionVerification />} />
                {/* External user verification is handled in AdminSection (users) */}
                <Route path="/manage/section/:section" element={<AdminSection />} />
                <Route path="/manage/department-rbac" element={<DepartmentAdministrationHub />} />
                <Route path="/manage/department-administration" element={<DepartmentAdministrationHub />} />
                <Route path="/manage/department-administration/:role" element={<DepartmentStaffManagement />} />
                <Route path="/organization/users" element={<OrganizationUsersManagement />} />
                <Route path="/admin/hero-slides" element={<AdminHeroSlides />} />
                <Route path="/content-management" element={<ContentManagement />} />
                <Route path="/admin-settings" element={<AdminSettings />} />
                <Route
                  path="/admin-settings/admin-panel-access"
                  element={
                    <AdminModuleGuard moduleKey="admin_settings.admin_panel_access">
                      <AdminPanelAccessConfig />
                    </AdminModuleGuard>
                  }
                />
                <Route path="/admin-settings/auth" element={<AdminSettingsAuth />} />
                <Route path="/admin-settings/communication" element={<AdminCommunication />} />
                <Route path="/admin-settings/inbox-email" element={<InboxEmail />} />
                <Route path="/admin-settings/wallet-recharge-parse" element={<WalletRechargeParse />} />
                <Route path="/admin-settings/legacy-wallet-import" element={<LegacyWalletImportTest />} />
                <Route path="/calendar-colors" element={<CalendarColorSettings />} />
                <Route path="/inventory-management" element={<InventoryManagement />} />
                <Route path="/procurement-workflow" element={<ProcurementWorkflow />} />
                <Route path="/equipment-lifecycle" element={<EquipmentLifecycleHub />} />
                <Route path="/propose-equipment" element={<ProposeEquipment />} />
                <Route path="/admin/equipment-addition-requests" element={<EquipmentAdditionRequests />} />
                <Route path="/admin-settings/equipment" element={<AdminSettingsEquipment />} />
                <Route path="/admin-settings/equipment/semesters" element={<AdminSemesters />} />
                <Route path="/admin-settings/equipment/icpms-standards" element={<AdminIcpmsStandards />} />
                <Route path="/admin-settings/equipment/mode-schedules" element={<AdminEquipmentModeSchedules />} />
                <Route path="/admin-settings/equipment/booking-charge-settings" element={<AdminBookingChargeSettings />} />
                <Route path="/admin-settings/equipment/booking-buffer-config" element={<AdminBookingBufferConfig />} />
                <Route path="/admin-settings/equipment/student-nominations" element={<AdminStudentNominations />} />
                <Route path="/admin-settings/wallet-sric-settings" element={<AdminWalletSricSettings />} />
                <Route path="/admin-settings/wallet-withdrawal-requests" element={<AdminWalletWithdrawalRequests />} />
                <Route path="/admin-settings/wallet-credit-facility-settings" element={<AdminWalletCreditFacilitySettings />} />
                <Route path="/admin-settings/wallet-student-recharge-settings" element={<AdminWalletStudentRechargeSettings />} />
                <Route path="/admin-settings/support" element={<AdminSettingsSupport />} />
                <Route path="/admin-settings/feedback" element={<AdminSettingsFeedback />} />
                <Route path="/admin-settings/quality-improvement" element={<AdminSettingsQualityImprovement />} />
                <Route path="/admin-settings/rewards" element={<AdminRewardsConfig />} />
                <Route path="/oic/accessories" element={<ErrorBoundary fallbackTitle="Accessories" backPath="/dashboard"><OICAccessories /></ErrorBoundary>} />
                <Route path="/oic/print-materials" element={<ErrorBoundary fallbackTitle="3D Print Materials" backPath="/dashboard"><OICPrintMaterials /></ErrorBoundary>} />
                <Route path="/oic/quota-configurations" element={<ErrorBoundary fallbackTitle="Quota Configurations" backPath="/dashboard"><OICQuotaConfigurations /></ErrorBoundary>} />
                <Route path="/oic/multi-mode" element={<ErrorBoundary fallbackTitle="Multi-Mode Equipment" backPath="/dashboard"><OICMultiMode /></ErrorBoundary>} />
                <Route path="/user-management" element={<UserManagement />} />
                <Route path="/setup-test-users" element={<SetupTestUsers />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/periodic-table" element={<PeriodicTable />} />
                <Route path="/test/icpms-standards" element={<IcpmsStandardsTest />} />
                <Route path="/test/print3d-analyzer" element={<Print3DAnalyzerTest />} />
                <Route path="/tickets" element={<Tickets />} />
                <Route path="/dev/user-guides" element={<UserGuidePreview />} />
                <Route path="/page/:slug" element={<CmsPageView />} />
                {/* Wallet recharge request action pages - redirect to Django backend */}
                <Route path="/wallet/recharge-requests/:requestId" element={<WalletRechargeRequestAction />} />
                <Route path="/wallet/recharge-requests/:requestId/approve" element={<WalletRechargeRequestAction />} />
                <Route path="/wallet/recharge-requests/:requestId/reject" element={<WalletRechargeRequestAction />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </NotificationProvider>
            </UserGuideProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
