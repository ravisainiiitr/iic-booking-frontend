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
  CalendarRange,
  ChevronRight,
  Clock,
  FileText,
  FlaskConical,
  FolderTree,
  GraduationCap,
  Layers,
  Layers3,
  Package,
  PackagePlus,
  Receipt,
  RotateCcw,
  Timer,
} from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import { useAuth } from "@/contexts/AuthContext";
import { hasAdminModule } from "@/lib/adminPanelAccess";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";

type SubCard = {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  path?: string;
  onClick?: () => void;
  /** Institute-wide setting; Main Admin only, hidden for Department Admin. */
  mainAdminOnly?: boolean;
  /** Admin Settings module key (registry) this card maps to, for the module-based access system. */
  moduleKey?: string;
};

const EQUIPMENT_SUB_CARDS: SubCard[] = [
  {
    key: "equipmentAdditionRequests",
    label: "Equipment addition requests",
    description: "Review public proposals and approve or reject before creating equipment",
    icon: <PackagePlus className="h-6 w-6" />,
    path: "/admin/equipment-addition-requests",
    moduleKey: "admin_settings.equipment.addition_requests",
  },
  {
    key: "bookingAttemptLogs",
    label: "Booking requests log",
    description: "View success and failure logs for booking attempts",
    icon: <FileText className="h-6 w-6" />,
    path: "/booking-attempt-logs",
    moduleKey: "admin_settings.equipment.booking_attempt_logs",
  },
  {
    key: "bookings",
    label: "Bookings",
    description: "Manage all equipment bookings",
    icon: <Calendar className="h-6 w-6" />,
    path: "/admin/section/bookings",
    moduleKey: "admin_settings.equipment.bookings",
  },
  {
    key: "repeatSampleRequests",
    label: "Repeat sample requests",
    description: "View and approve/reject repeat sample requests (mirrors Django admin)",
    icon: <RotateCcw className="h-6 w-6" />,
    path: "/admin/section/repeatSampleRequests",
    moduleKey: "admin_settings.equipment.repeat_sample_requests",
  },
  {
    key: "dailySlots",
    label: "Daily Slots",
    description: "View and edit daily slot status",
    icon: <CalendarDays className="h-6 w-6" />,
    path: "/admin/section/dailySlots",
    moduleKey: "admin_settings.equipment.daily_slots",
  },
  {
    key: "equipment",
    label: "Equipment",
    description: "List, add and edit equipment",
    icon: <Package className="h-6 w-6" />,
    path: "/admin/section/equipment",
    moduleKey: "admin_settings.equipment.equipment",
  },
  {
    key: "equipmentCategories",
    label: "Equipment Categories",
    description: "Manage equipment categories",
    icon: <FolderTree className="h-6 w-6" />,
    path: "/admin/section/equipmentCategories",
    moduleKey: "admin_settings.equipment.categories",
  },
  {
    key: "equipmentGroups",
    label: "Equipment Groups",
    description: "Manage equipment groups and quotas",
    icon: <Layers className="h-6 w-6" />,
    path: "/admin/section/equipmentGroups",
    moduleKey: "admin_settings.equipment.groups",
  },
  {
    key: "holidays",
    label: "Holidays",
    description: "Manage holidays and closures",
    icon: <Calendar className="h-6 w-6" />,
    path: "/admin/section/holidays",
    moduleKey: "admin_settings.equipment.holidays",
  },
  {
    key: "semesters",
    label: "Semesters",
    description: "Manage academic semesters used for TA calls and student nominations",
    icon: <CalendarRange className="h-6 w-6" />,
    path: "/admin-settings/equipment/semesters",
    mainAdminOnly: true,
    moduleKey: "admin_settings.equipment.semesters",
  },
  {
    key: "studentEquipmentNominations",
    label: "Student Equipment Operating Nominations",
    description: "View supervisor-nominated students allowed to operate equipment, by semester",
    icon: <GraduationCap className="h-6 w-6" />,
    path: "/admin-settings/equipment/student-nominations",
    moduleKey: "admin_settings.equipment.student_nominations",
  },
  {
    key: "icpmsStandards",
    label: "ICPMS Standard Sample Database",
    description: "Manage ICPMS calibration standard samples and element coverage",
    icon: <FlaskConical className="h-6 w-6" />,
    path: "/admin-settings/equipment/icpms-standards",
    mainAdminOnly: true,
    moduleKey: "admin_settings.equipment.icpms_standards",
  },
  {
    key: "equipmentModeSchedules",
    label: "Equipment Mode Schedule",
    description: "Date-ranged activation of child modes under multi-mode parent instruments",
    icon: <Layers3 className="h-6 w-6" />,
    path: "/admin-settings/equipment/mode-schedules",
    moduleKey: "admin_settings.equipment.mode_schedules",
  },
  {
    key: "bookingChargeSettings",
    label: "Booking Charge Settings",
    description: "Key-value booking charge settings (e.g. external user GST %)",
    icon: <Receipt className="h-6 w-6" />,
    path: "/admin-settings/equipment/booking-charge-settings",
    mainAdminOnly: true,
    moduleKey: "admin_settings.equipment.booking_charge_settings",
  },
  {
    key: "bookingBufferConfig",
    label: "Booking Buffer Configuration",
    description: "Buffer days for the Booking Not Utilized check and sample auto-archive",
    icon: <Timer className="h-6 w-6" />,
    path: "/admin-settings/equipment/booking-buffer-config",
    mainAdminOnly: true,
    moduleKey: "admin_settings.equipment.booking_buffer_config",
  },
];

const AdminSettingsEquipment = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const userTypeStr = user?.user_type != null ? String(user.user_type).toLowerCase() : "";
  const isAdmin = userTypeStr === "admin";
  const canAccess = isAdmin || hasAdminModule(user, "admin_settings.equipment");
  const visibleSubCards = isAdmin
    ? EQUIPMENT_SUB_CARDS
    : EQUIPMENT_SUB_CARDS.filter((item) => {
        if (item.mainAdminOnly) return false;
        if (item.moduleKey) return hasAdminModule(user, item.moduleKey);
        return hasAdminModule(user, "admin_settings.equipment");
      });

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
    if (!canAccess) {
      toast.error("Only Main Admin or Department Admin can access Equipment settings.");
      navigate("/admin-settings");
      return;
    }
  }, [navigate, isAuthenticated, user, canAccess, authLoading]);

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
            <h1 className="text-3xl font-bold">Equipment</h1>
            <p className="text-muted-foreground mt-1">
              Booking requests log, addition proposals, bookings, slots, equipment, categories, groups and holidays.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {isAdmin && (
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
          )}
          {visibleSubCards.map((item) => (
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
