import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "next-themes";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import EmailVerificationCallback from "./pages/EmailVerificationCallback";
import Dashboard from "./pages/Dashboard";
import EquipmentList from "./pages/EquipmentList";
import BookEquipment from "./pages/BookEquipment";
import MyBookings from "./pages/MyBookings";
import BookingManagement from "./pages/BookingManagement";
import Wallet from "./pages/Wallet";
import Reports from "./pages/Reports";
import AdminPanel from "./pages/AdminPanel";
import UserManagement from "./pages/UserManagement";
import UserGroups from "./pages/UserGroups";
import SetupTestUsers from "./pages/SetupTestUsers";
import Profile from "./pages/Profile";
import PeriodicTable from "./pages/PeriodicTable";
import EquipmentProfile from "./pages/EquipmentProfile";
import Tickets from "./pages/Tickets";
import WalletRechargeRequestAction from "./pages/WalletRechargeRequestAction";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider>
        <AuthProvider>
          <NotificationProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter
              future={{
                v7_startTransition: true,
                v7_relativeSplatPath: true,
              }}
            >
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/auth/verify-email" element={<EmailVerificationCallback />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/equipments" element={<EquipmentList />} />
                <Route path="/book-equipment" element={<BookEquipment />} />
                <Route path="/equipment/:id" element={<EquipmentProfile />} />
                <Route path="/my-bookings" element={<MyBookings />} />
                <Route path="/booking-management" element={<BookingManagement />} />
                <Route path="/wallet" element={<Wallet />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/admin" element={<AdminPanel />} />
                <Route path="/user-management" element={<UserManagement />} />
                <Route path="/user-groups" element={<UserGroups />} />
                <Route path="/setup-test-users" element={<SetupTestUsers />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/periodic-table" element={<PeriodicTable />} />
                <Route path="/tickets" element={<Tickets />} />
                {/* Wallet recharge request action pages - redirect to Django backend */}
                <Route path="/wallet/recharge-requests/:requestId" element={<WalletRechargeRequestAction />} />
                <Route path="/wallet/recharge-requests/:requestId/approve" element={<WalletRechargeRequestAction />} />
                <Route path="/wallet/recharge-requests/:requestId/reject" element={<WalletRechargeRequestAction />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </NotificationProvider>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
