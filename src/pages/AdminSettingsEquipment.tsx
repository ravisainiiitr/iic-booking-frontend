import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Calendar,
  CalendarDays,
  ChevronRight,
  Clock,
  FileText,
  FolderTree,
  Layers,
  Package,
  RotateCcw,
} from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";

type SubCard = {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  path?: string;
  onClick?: () => void;
};

const EQUIPMENT_SUB_CARDS: SubCard[] = [
  {
    key: "bookingAttemptLogs",
    label: "Booking requests log",
    description: "View success and failure logs for booking attempts",
    icon: <FileText className="h-6 w-6" />,
    path: "/booking-attempt-logs",
  },
  {
    key: "bookings",
    label: "Bookings",
    description: "Manage all equipment bookings",
    icon: <Calendar className="h-6 w-6" />,
    path: "/admin/section/bookings",
  },
  {
    key: "repeatSampleRequests",
    label: "Repeat sample requests",
    description: "View and approve/reject repeat sample requests (mirrors Django admin)",
    icon: <RotateCcw className="h-6 w-6" />,
    path: "/admin/section/repeatSampleRequests",
  },
  {
    key: "dailySlots",
    label: "Daily Slots",
    description: "View and edit daily slot status",
    icon: <CalendarDays className="h-6 w-6" />,
    path: "/admin/section/dailySlots",
  },
  {
    key: "equipment",
    label: "Equipment",
    description: "List, add and edit equipment",
    icon: <Package className="h-6 w-6" />,
    path: "/admin/section/equipment",
  },
  {
    key: "equipmentCategories",
    label: "Equipment Categories",
    description: "Manage equipment categories",
    icon: <FolderTree className="h-6 w-6" />,
    path: "/admin/section/equipmentCategories",
  },
  {
    key: "equipmentGroups",
    label: "Equipment Groups",
    description: "Manage equipment groups and quotas",
    icon: <Layers className="h-6 w-6" />,
    path: "/admin/section/equipmentGroups",
  },
  {
    key: "holidays",
    label: "Holidays",
    description: "Manage holidays and closures",
    icon: <Calendar className="h-6 w-6" />,
    path: "/admin/section/holidays",
  },
];

const AdminSettingsEquipment = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const userTypeStr = user?.user_type != null ? String(user.user_type).toLowerCase() : "";
  const isAdmin = userTypeStr === "admin";

  const [slotWindowDialogOpen, setSlotWindowDialogOpen] = useState(false);
  const [slotWindowWeekday, setSlotWindowWeekday] = useState<number | null>(null);
  const [slotWindowTime, setSlotWindowTime] = useState<string>("");
  const [slotWindowSaving, setSlotWindowSaving] = useState(false);
  const [slotWindowLoading, setSlotWindowLoading] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !user) {
      navigate("/auth");
      return;
    }
    if (!isAdmin) {
      toast.error("Only admin can access Equipment settings.");
      navigate("/admin-settings");
      return;
    }
  }, [navigate, isAuthenticated, user, isAdmin, authLoading]);

  useEffect(() => {
    if (!slotWindowDialogOpen || !isAdmin) return;
    setSlotWindowLoading(true);
    apiClient
      .getInternalSlotWindow()
      .then((res) => {
        if (res.data) {
          setSlotWindowWeekday(res.data.reference_weekday ?? null);
          setSlotWindowTime(res.data.reference_time ?? "");
        }
      })
      .catch(() => toast.error("Failed to load slot window setting"))
      .finally(() => setSlotWindowLoading(false));
  }, [slotWindowDialogOpen, isAdmin]);

  const handleSaveSlotWindow = () => {
    setSlotWindowSaving(true);
    apiClient
      .updateInternalSlotWindow({
        reference_weekday: slotWindowWeekday,
        reference_time: slotWindowTime.trim() || null,
      })
      .then((res) => {
        if (res.data) {
          setSlotWindowWeekday(res.data.reference_weekday ?? null);
          setSlotWindowTime(res.data.reference_time ?? "");
          toast.success("Slot window updated.");
          setSlotWindowDialogOpen(false);
        } else {
          toast.error(res.error || "Failed to update.");
        }
      })
      .catch(() => toast.error("Failed to update slot window"))
      .finally(() => setSlotWindowSaving(false));
  };

  if (!isAdmin && !authLoading) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/20">
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
            <h1 className="text-3xl font-bold">Equipment</h1>
            <p className="text-muted-foreground mt-1">
              Booking requests log, bookings, repeat sample requests, daily slots, equipment, categories, groups and holidays.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card
            className="cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5 border-border hover:border-primary/30"
            onClick={() => setSlotWindowDialogOpen(true)}
          >
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Clock className="h-6 w-6" />
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
              </div>
              <CardTitle className="text-base mt-3">Slot window (internal users)</CardTitle>
              <CardDescription className="text-sm">
                Set day and time when the next week becomes visible for internal users (common for all equipment).
              </CardDescription>
            </CardHeader>
          </Card>
          {EQUIPMENT_SUB_CARDS.map((item) => (
            <Card
              key={item.key}
              className="cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5 border-border hover:border-primary/30"
              onClick={() => navigate(item.path!)}
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

        <Dialog open={slotWindowDialogOpen} onOpenChange={setSlotWindowDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Slot window (internal users)</DialogTitle>
              <DialogDescription>
                Common setting for all equipment. Before this day and time, internal users see only the current week; on
                or after it, they see the current and next week. Leave both empty for no restriction.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="slot-window-weekday">Day</Label>
                <Select
                  value={slotWindowWeekday != null ? String(slotWindowWeekday) : "__none__"}
                  onValueChange={(v) => setSlotWindowWeekday(v === "__none__" ? null : parseInt(v, 10))}
                  disabled={slotWindowLoading}
                >
                  <SelectTrigger id="slot-window-weekday">
                    <SelectValue placeholder="No restriction" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No restriction</SelectItem>
                    <SelectItem value="0">Monday</SelectItem>
                    <SelectItem value="1">Tuesday</SelectItem>
                    <SelectItem value="2">Wednesday</SelectItem>
                    <SelectItem value="3">Thursday</SelectItem>
                    <SelectItem value="4">Friday</SelectItem>
                    <SelectItem value="5">Saturday</SelectItem>
                    <SelectItem value="6">Sunday</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="slot-window-time">Time (24h)</Label>
                <Input
                  id="slot-window-time"
                  type="time"
                  value={slotWindowTime}
                  onChange={(e) => setSlotWindowTime(e.target.value)}
                  disabled={slotWindowLoading}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSlotWindowDialogOpen(false)} disabled={slotWindowSaving}>
                Cancel
              </Button>
              <Button onClick={handleSaveSlotWindow} disabled={slotWindowSaving || slotWindowLoading}>
                {slotWindowSaving ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default AdminSettingsEquipment;
