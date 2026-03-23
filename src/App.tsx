import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { AuthProvider } from "@/contexts/AuthContext";
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
import MyBookings from "./pages/MyBookings";
import BookingManagement from "./pages/BookingManagement";
import UrgentRequests from "./pages/UrgentRequests";
import UrgentRequestsWallet from "./pages/UrgentRequestsWallet";
import MyUrgentRequests from "./pages/MyUrgentRequests";
import StudentManagement from "./pages/StudentManagement";
import BookingAttemptLogs from "./pages/BookingAttemptLogs";
import EquipmentWaitlist from "./pages/EquipmentWaitlist";
import TemporaryOIC from "./pages/TemporaryOIC";
import TANominationCall from "./pages/TANominationCall";
import TANominationsLog from "./pages/TANominationsLog";
import MyNominationRequests from "./pages/MyNominationRequests";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Wallet from "./pages/Wallet";
import Reports from "./pages/Reports";
import ReportBookingsList from "./pages/ReportBookingsList";
import AdminPanel from "./pages/AdminPanel";
import AdminSection from "./pages/AdminSection";
import AdminHeroSlides from "./pages/AdminHeroSlides";
import ContentManagement from "./pages/ContentManagement";
import AdminSettings from "./pages/AdminSettings";
import AdminSettingsAuth from "./pages/AdminSettingsAuth";
import AdminCommunication from "./pages/AdminCommunication";
import AdminCoupons from "./pages/AdminCoupons";
import Coupons from "./pages/Coupons";
import InboxEmail from "./pages/InboxEmail";
import AdminSettingsEquipment from "./pages/AdminSettingsEquipment";
import AdminSettingsSupport from "./pages/AdminSettingsSupport";
import AdminSettingsQualityImprovement from "./pages/AdminSettingsQualityImprovement";
import CalendarColorSettings from "./pages/CalendarColorSettings";
import UserManagement from "./pages/UserManagement";
import SetupTestUsers from "./pages/SetupTestUsers";
import Profile from "./pages/Profile";
import PeriodicTable from "./pages/PeriodicTable";
import IcpmsStandardsTest from "./pages/IcpmsStandardsTest";
import EquipmentProfile from "./pages/EquipmentProfile";
import Tickets from "./pages/Tickets";
import WalletRechargeRequestAction from "./pages/WalletRechargeRequestAction";
import WalletRechargeParse from "./pages/WalletRechargeParse";
import CmsPageView from "./pages/CmsPageView";
import ExternalUserManagement from "./pages/ExternalUserManagement";
import ExternalDepartmentAdditionVerification from "./pages/ExternalDepartmentAdditionVerification";
import ChatWidget from "./components/ChatWidget";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider>
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <AuthProvider>
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
                <Route path="/ta-nomination-call" element={<TANominationCall />} />
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
                <Route path="/manage/external-user-management" element={<ExternalUserManagement />} />
                <Route path="/manage/external-user-management/departments" element={<ExternalDepartmentAdditionVerification />} />
                {/* External user verification is handled in AdminSection (users) */}
                <Route path="/manage/section/:section" element={<AdminSection />} />
                <Route path="/admin/hero-slides" element={<AdminHeroSlides />} />
                <Route path="/content-management" element={<ContentManagement />} />
                <Route path="/admin-settings" element={<AdminSettings />} />
                <Route path="/admin-settings/auth" element={<AdminSettingsAuth />} />
                <Route path="/admin-settings/communication" element={<AdminCommunication />} />
                <Route path="/admin/coupons" element={<AdminCoupons />} />
                <Route path="/coupons" element={<Coupons />} />
                <Route path="/admin-settings/inbox-email" element={<InboxEmail />} />
                <Route path="/admin-settings/wallet-recharge-parse" element={<WalletRechargeParse />} />
                <Route path="/calendar-colors" element={<CalendarColorSettings />} />
                <Route path="/admin-settings/equipment" element={<AdminSettingsEquipment />} />
                <Route path="/admin-settings/support" element={<AdminSettingsSupport />} />
                <Route path="/admin-settings/quality-improvement" element={<AdminSettingsQualityImprovement />} />
                <Route path="/user-management" element={<UserManagement />} />
                <Route path="/setup-test-users" element={<SetupTestUsers />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/periodic-table" element={<PeriodicTable />} />
                <Route path="/test/icpms-standards" element={<IcpmsStandardsTest />} />
                <Route path="/tickets" element={<Tickets />} />
                <Route path="/page/:slug" element={<CmsPageView />} />
                {/* Wallet recharge request action pages - redirect to Django backend */}
                <Route path="/wallet/recharge-requests/:requestId" element={<WalletRechargeRequestAction />} />
                <Route path="/wallet/recharge-requests/:requestId/approve" element={<WalletRechargeRequestAction />} />
                <Route path="/wallet/recharge-requests/:requestId/reject" element={<WalletRechargeRequestAction />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </NotificationProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
