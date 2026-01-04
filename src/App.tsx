import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { NotificationProvider } from "@/contexts/NotificationContext";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import EmailVerificationCallback from "./pages/EmailVerificationCallback";
import Dashboard from "./pages/Dashboard";
import BookEquipment from "./pages/BookEquipment";
import MyBookings from "./pages/MyBookings";
import Wallet from "./pages/Wallet";
import Reports from "./pages/Reports";
import AdminPanel from "./pages/AdminPanel";
import UserManagement from "./pages/UserManagement";
import SetupTestUsers from "./pages/SetupTestUsers";
import Profile from "./pages/Profile";
import PeriodicTable from "./pages/PeriodicTable";
import EquipmentProfile from "./pages/EquipmentProfile";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <NotificationProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/auth/verify-email" element={<EmailVerificationCallback />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/book-equipment" element={<BookEquipment />} />
            <Route path="/equipment/:id" element={<EquipmentProfile />} />
            <Route path="/my-bookings" element={<MyBookings />} />
            <Route path="/wallet" element={<Wallet />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="/user-management" element={<UserManagement />} />
            <Route path="/setup-test-users" element={<SetupTestUsers />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/periodic-table" element={<PeriodicTable />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </NotificationProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
