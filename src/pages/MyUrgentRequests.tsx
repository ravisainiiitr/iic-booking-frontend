import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import DashboardHeader from "@/components/DashboardHeader";
import DepartmentFilter, { type DepartmentFilterValue } from "@/components/DepartmentFilter";
import { ArrowLeft, Loader2, AlertCircle, Clock, CheckCircle, XCircle, HelpCircle } from "lucide-react";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { toast } from "sonner";
import { isExternalBookingUserType } from "@/lib/userTypes";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type MyUrgentRequestRow = {
  id: number;
  equipment_id: number;
  equipment_code: string;
  equipment_name: string;
  request_type: string;
  status: string;
  requested_at: string | null;
  decided_at: string | null;
  expiry_at: string | null;
  pending_wallet_approval: boolean;
};

const REQUEST_TYPE_LABELS: Record<string, string> = {
  NO_SLOT: "Type A — Rush relief (no surcharge)",
  REVIEWER_URGENT: "Type B — Urgent with reason (50% surcharge, OIC review)",
};

/** Must match RUSH_RELIEF_MIN_PEAK_FAILED_ATTEMPTS in backend api_views. */
const RUSH_RELIEF_MIN_PEAK_ATTEMPTS = 2;

/** Format seconds as HH:MM:SS (e.g. 3665 -> "01:01:05"). */
function formatTimeRemaining(totalSeconds: number): string {
  if (totalSeconds <= 0) return "00:00:00";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Returns seconds until expiry (positive), or 0 if already expired. */
function getSecondsRemaining(expiryAtIso: string | null): number {
  if (!expiryAtIso) return 0;
  const expiry = new Date(expiryAtIso).getTime();
  const now = Date.now();
  return Math.max(0, Math.floor((expiry - now) / 1000));
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
};

const MyUrgentRequests = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [list, setList] = useState<MyUrgentRequestRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  // Submit new request form state
  const [urgentDepartmentId, setUrgentDepartmentId] = useState<DepartmentFilterValue>("all");
  const [urgentDepartmentReady, setUrgentDepartmentReady] = useState(false);
  const [urgentEquipmentList, setUrgentEquipmentList] = useState<Array<{ equipment_id: number; code: string; name: string }>>([]);
  const [loadingUrgentEquipments, setLoadingUrgentEquipments] = useState(false);
  const [urgentSelectedEquipmentId, setUrgentSelectedEquipmentId] = useState<string>("");
  const [urgentRequestType, setUrgentRequestType] = useState<"" | "NO_SLOT" | "REVIEWER_URGENT">("");
  const [urgentDisclaimerAccepted, setUrgentDisclaimerAccepted] = useState(false);
  const [urgentEvidenceFile, setUrgentEvidenceFile] = useState<File | null>(null);
  const [urgentReviewerComment, setUrgentReviewerComment] = useState("");
  const [urgentSubmitting, setUrgentSubmitting] = useState(false);
  const [urgentHoldBookingId, setUrgentHoldBookingId] = useState<number | null>(null);
  const [urgentHoldVirtualBookingId, setUrgentHoldVirtualBookingId] = useState<string | null>(null);
  const [myUnsuccessfulAttempts, setMyUnsuccessfulAttempts] = useState<Array<{ id: number; requested_at: string | null; outcome: string; failure_reason: string; number_of_samples: number; slots_requested: number }>>([]);
  const [myUnsuccessfulAttemptsLoading, setMyUnsuccessfulAttemptsLoading] = useState(false);
  const [rushReliefQualified, setRushReliefQualified] = useState(false);
  const [peakQualifiedAttempts, setPeakQualifiedAttempts] = useState(0);
  const [slotsAvailableThisWeek, setSlotsAvailableThisWeek] = useState<boolean | null>(null);
  const [loadingSlotsAvailable, setLoadingSlotsAvailable] = useState(false);
  const [noAttemptsDialogOpen, setNoAttemptsDialogOpen] = useState(false);

  // Pre-fill from URL when returning from book-equipment (Hold slots and return)
  useEffect(() => {
    const eqId = searchParams.get("urgent_equipment_id");
    const holdId = searchParams.get("hold_booking_id");
    const holdVirtualId = searchParams.get("hold_virtual_booking_id");
    if (eqId) setUrgentSelectedEquipmentId(eqId);
    if (holdId) {
      setUrgentHoldBookingId(parseInt(holdId, 10) || null);
      setUrgentRequestType("REVIEWER_URGENT");
    }
    if (holdVirtualId) setUrgentHoldVirtualBookingId(holdVirtualId);
    if (eqId || holdId || holdVirtualId) {
      setSearchParams((prev) => {
        const p = new URLSearchParams(prev);
        p.delete("urgent_equipment_id");
        p.delete("hold_booking_id");
        p.delete("hold_virtual_booking_id");
        return p;
      }, { replace: true });
    }
  }, []);

  // Load equipment list for dropdown (filtered by selected department)
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    if (!urgentDepartmentReady) return;
    setLoadingUrgentEquipments(true);
    const deptArg =
      urgentDepartmentId === "all" ? undefined : urgentDepartmentId;
    apiClient
      .getEquipments(undefined, "ACTIVE", undefined, false, deptArg)
      .then((res) => {
        const raw = (res as { data?: unknown })?.data ?? res;
        const data = Array.isArray(raw) ? raw : (raw as { equipments?: unknown[] })?.equipments ?? (raw as { results?: unknown[] })?.results ?? [];
        const list = (data as Array<{ equipment_id?: number; id?: number; code?: string; equipment_code?: string; name?: string; equipment_name?: string }>).map((e) => ({
          equipment_id: e.equipment_id ?? e.id ?? 0,
          code: e.code ?? e.equipment_code ?? "",
          name: e.name ?? e.equipment_name ?? "",
        }));
        setUrgentEquipmentList(list);
        setUrgentSelectedEquipmentId((prev) => {
          if (!prev) return prev;
          const stillThere = list.some((eq) => String(eq.equipment_id) === prev);
          return stillThere ? prev : "";
        });
      })
      .catch(() => setUrgentEquipmentList([]))
      .finally(() => setLoadingUrgentEquipments(false));
  }, [isAuthenticated, user?.id, urgentDepartmentId, urgentDepartmentReady]);

  const isExternalUser = isExternalBookingUserType(user?.user_type);
  const isInternalForTypeA = Boolean(user) && !isExternalUser;

  // Evaluate Type A eligibility whenever equipment is selected
  useEffect(() => {
    if (!urgentSelectedEquipmentId) {
      setMyUnsuccessfulAttempts([]);
      setRushReliefQualified(false);
      setPeakQualifiedAttempts(0);
      return;
    }
    const id = parseInt(urgentSelectedEquipmentId, 10);
    if (Number.isNaN(id)) return;
    setMyUnsuccessfulAttemptsLoading(true);
    apiClient
      .getMyUnsuccessfulBookingAttempts(id)
      .then((res) => {
        const entries = res.data?.entries ?? [];
        setMyUnsuccessfulAttempts(entries);
        const peak =
          typeof res.data?.peak_qualified_attempts === "number"
            ? res.data.peak_qualified_attempts
            : entries.length;
        setPeakQualifiedAttempts(peak);
        const qualified =
          typeof res.data?.rush_relief_qualified === "boolean"
            ? res.data.rush_relief_qualified
            : peak >= RUSH_RELIEF_MIN_PEAK_ATTEMPTS;
        setRushReliefQualified(qualified);
      })
      .catch(() => {
        setMyUnsuccessfulAttempts([]);
        setRushReliefQualified(false);
        setPeakQualifiedAttempts(0);
      })
      .finally(() => setMyUnsuccessfulAttemptsLoading(false));
  }, [urgentSelectedEquipmentId]);

  const typeAEligible =
    Boolean(urgentSelectedEquipmentId) &&
    slotsAvailableThisWeek === false &&
    isInternalForTypeA &&
    !myUnsuccessfulAttemptsLoading &&
    rushReliefQualified;

  const showTypeBForm =
    Boolean(urgentSelectedEquipmentId) &&
    slotsAvailableThisWeek === false &&
    !myUnsuccessfulAttemptsLoading &&
    !typeAEligible;

  // Check if slots are available in the current week for the selected equipment (urgent request not allowed if yes)
  useEffect(() => {
    if (!urgentSelectedEquipmentId) {
      setSlotsAvailableThisWeek(null);
      return;
    }
    const id = parseInt(urgentSelectedEquipmentId, 10);
    if (Number.isNaN(id)) {
      setSlotsAvailableThisWeek(null);
      return;
    }
    setLoadingSlotsAvailable(true);
    setSlotsAvailableThisWeek(null);
    const now = new Date();
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const startStr = format(now, "yyyy-MM-dd");
    const endStr = format(weekEnd, "yyyy-MM-dd");
    apiClient
      .getEquipmentSlots(id, startStr, endStr)
      .then((res) => {
        const data = (res as { data?: { slots?: Array<{ status?: string; start_datetime?: string; available_for_external?: boolean }>; slot_window_max_date?: string | null } })?.data;
        const firstPassSlots = data?.slots ?? [];
        const maxDate = data?.slot_window_max_date;
        const currentWeekEndStr = endStr;
        const nowMs = Date.now();
        const hasAvailableIn = (slots: Array<{ status?: string; start_datetime?: string; available_for_external?: boolean }>) =>
          slots.some((s) => {
            // Externals and internals: AVAILABLE slots (available_for_external is also treated as bookable)
            if (!((s.status || "").toUpperCase() === "AVAILABLE" || s.available_for_external === true)) return false;
            if (!s.start_datetime) return false;
            const slotStartMs = new Date(s.start_datetime).getTime();
            if (Number.isNaN(slotStartMs)) return false;
            return slotStartMs >= nowMs;
          });

        // If booking navigation allows a later end date, re-check availability until that end date.
        if (maxDate && maxDate > currentWeekEndStr) {
          return apiClient.getEquipmentSlots(id, startStr, maxDate).then((res2) => {
            const secondSlots = (res2 as { data?: { slots?: Array<{ status?: string; start_datetime?: string; available_for_external?: boolean }> } })?.data?.slots ?? [];
            setSlotsAvailableThisWeek(hasAvailableIn(secondSlots));
          });
        }

        setSlotsAvailableThisWeek(hasAvailableIn(firstPassSlots));
      })
      .catch(() => setSlotsAvailableThisWeek(null))
      .finally(() => setLoadingSlotsAvailable(false));
  }, [urgentSelectedEquipmentId]);

  // Update every second for Time Remaining countdown
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !user) {
      navigate("/auth");
      return;
    }
    let cancelled = false;
    setLoading(true);
    apiClient
      .listMyUrgentBookingRequests({ limit: 50, offset: 0 })
      .then((res) => {
        if (cancelled) return;
        if (res.data?.urgent_requests) {
          setList(res.data.urgent_requests);
          setTotalCount(res.data.total_count ?? res.data.urgent_requests.length);
        } else {
          setList([]);
          setTotalCount(0);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setList([]);
          setTotalCount(0);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [navigate, isAuthenticated, user?.id, authLoading]);

  const getStatusBadge = (row: MyUrgentRequestRow) => {
    const status = (row.status || "").toUpperCase();
    const timeExpired = getSecondsRemaining(row.expiry_at) <= 0;
    if (status === "PENDING" && timeExpired && row.expiry_at) {
      return (
        <Badge variant="secondary" className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
          <HelpCircle className="h-3 w-3 mr-1" />
          {STATUS_LABELS.EXPIRED}
        </Badge>
      );
    }
    if (row.pending_wallet_approval) {
      return (
        <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
          <Clock className="h-3 w-3 mr-1" />
          Awaiting Supervisor
        </Badge>
      );
    }
    switch (status) {
      case "PENDING":
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200">
            <Clock className="h-3 w-3 mr-1" />
            {STATUS_LABELS.PENDING}
          </Badge>
        );
      case "APPROVED":
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200">
            <CheckCircle className="h-3 w-3 mr-1" />
            {STATUS_LABELS.APPROVED}
          </Badge>
        );
      case "REJECTED":
        return (
          <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200">
            <XCircle className="h-3 w-3 mr-1" />
            {STATUS_LABELS.REJECTED}
          </Badge>
        );
      case "EXPIRED":
        return (
          <Badge variant="secondary" className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
            <HelpCircle className="h-3 w-3 mr-1" />
            {STATUS_LABELS.EXPIRED}
          </Badge>
        );
      default:
        return <Badge variant="outline">{STATUS_LABELS[status] || row.status}</Badge>;
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="page-shell">
      <AlertDialog
        open={noAttemptsDialogOpen}
        onOpenChange={(open) => {
          setNoAttemptsDialogOpen(open);
          if (!open) {
            setUrgentDisclaimerAccepted(false);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Not eligible for this reason</AlertDialogTitle>
            <AlertDialogDescription className="text-left">
              No booking attempts were found in the last two weeks for this equipment. You are not entitled to raise an urgent
              request under this category.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <DashboardHeader />
      <main className="container mx-auto px-4 py-5">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} aria-label="Back to dashboard">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Urgent booking request</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Submit a new urgent request or view the status of your submitted requests
              </p>
            </div>
          </div>
        </div>

        {/* Submit new urgent request */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">Submit new urgent request</CardTitle>
            <CardDescription>
              Select department and equipment. Type A eligibility is checked automatically. Both types require that no slots are available in the current search.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 px-3 py-3 text-sm text-amber-950 dark:text-amber-100">
              <p className="font-semibold">Urgent booking rules</p>
              <p className="mt-1 leading-relaxed">
                Type A and Type B are available only when <strong>no slots are available</strong> in the current booking search window.
              </p>
              <ul className="mt-2 list-disc pl-5 space-y-1.5 leading-relaxed">
                <li>
                  <strong>Type A — Rush relief (internal IIT Roorkee users only):</strong> if you have at least {RUSH_RELIEF_MIN_PEAK_ATTEMPTS} unsuccessful
                  peak-window booking attempts for this equipment in the last 14 days (since your last Type A use), you can book the
                  <strong> next available / advance week at normal rates</strong> (no 50% surcharge). After a Type A booking is completed, the 14-day attempt window <strong>resets</strong>.
                  External users are not eligible for Type A.
                </li>
                <li>
                  <strong>Type B — Urgent with reason (50% surcharge):</strong> if you are not Type A eligible, raise a request with a short reason.
                  Selected slots are <strong>not auto-confirmed</strong>. OIC or main Admin will review and may accept, reject, or
                  <strong> reschedule</strong> (including Saturdays/Sundays) based on operator availability. Once approved, submit your sample at the earliest.
                </li>
              </ul>
            </div>
            <DepartmentFilter
              value={urgentDepartmentId}
              onChange={(next) => {
                setUrgentDepartmentId(next);
                setUrgentSelectedEquipmentId("");
                setUrgentRequestType("");
                setRushReliefQualified(false);
                setPeakQualifiedAttempts(0);
                setUrgentDisclaimerAccepted(false);
                setUrgentEvidenceFile(null);
                setUrgentReviewerComment("");
                setUrgentHoldBookingId(null);
                setNoAttemptsDialogOpen(false);
              }}
              defaultDepartmentName="Institute Instrumentation Centre"
              onResolved={(resolved) => {
                setUrgentDepartmentId(resolved);
                setUrgentDepartmentReady(true);
              }}
              className="max-w-xl"
              triggerClassName="max-w-md"
            />
            <div className="space-y-2">
              <Label className="text-sm font-medium">Select equipment</Label>
              <Select
                value={urgentSelectedEquipmentId || "__none__"}
                onValueChange={(v) => {
                  setUrgentSelectedEquipmentId(v === "__none__" ? "" : v);
                  setUrgentRequestType("");
                setRushReliefQualified(false);
                setPeakQualifiedAttempts(0);
                  setUrgentDisclaimerAccepted(false);
                  setUrgentEvidenceFile(null);
                  setUrgentReviewerComment("");
                  setUrgentHoldBookingId(null);
                  setNoAttemptsDialogOpen(false);
                }}
                disabled={!urgentDepartmentReady || loadingUrgentEquipments}
              >
                <SelectTrigger className="w-full max-w-md">
                  <SelectValue placeholder={loadingUrgentEquipments ? "Loading…" : "Choose equipment"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Select equipment —</SelectItem>
                  {urgentEquipmentList.map((eq) => (
                    <SelectItem key={eq.equipment_id} value={String(eq.equipment_id)}>
                      {eq.name} ({eq.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {urgentSelectedEquipmentId && (
              <div className="space-y-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/20 p-4">
                {(loadingSlotsAvailable || myUnsuccessfulAttemptsLoading) && (
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Checking slot availability and Type A eligibility…
                  </p>
                )}

                {!loadingSlotsAvailable && slotsAvailableThisWeek === true && (
                  <div className="rounded-lg border-2 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 p-4 space-y-3">
                    <p className="text-sm font-medium text-green-800 dark:text-green-200">
                      Slots are available in the current search for this equipment. Please book normally — urgent requests (Type A and Type B) are not available when slots exist.
                    </p>
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => navigate(`/book-equipment?equipment_id=${urgentSelectedEquipmentId}`)}
                    >
                      Book this equipment
                    </Button>
                  </div>
                )}

                {!loadingSlotsAvailable && !myUnsuccessfulAttemptsLoading && typeAEligible && (
                  <div className="rounded-lg border-2 border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 p-4 space-y-3">
                    <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                      You are eligible for Type A — Rush relief
                    </p>
                    <p className="text-sm text-emerald-900/90 dark:text-emerald-100/90 leading-relaxed">
                      {peakQualifiedAttempts} qualifying peak-window attempt{peakQualifiedAttempts === 1 ? "" : "s"} recorded (need {RUSH_RELIEF_MIN_PEAK_ATTEMPTS}).
                      You may book the <strong>next available / advance week at normal rates</strong> (no 50% surcharge).
                      Completing this booking resets the 14-day Type A attempt window.
                    </p>
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => {
                        setUrgentRequestType("NO_SLOT");
                        navigate(
                          `/book-equipment?equipment_id=${urgentSelectedEquipmentId}&urgent=1&rush_relief=1&return_to=my-urgent-requests`
                        );
                      }}
                    >
                      Book advance week (Type A — normal rates)
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Prefer Type B instead? Scroll down — Type B stays available as an alternative with 50% surcharge and OIC review.
                    </p>
                  </div>
                )}

                {!loadingSlotsAvailable && !myUnsuccessfulAttemptsLoading && showTypeBForm && (
                  <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-950/30 p-3 text-sm space-y-1">
                    <p className="font-medium text-amber-950 dark:text-amber-100">Not eligible for Type A rush relief</p>
                    <p className="text-amber-950/90 dark:text-amber-100/90 leading-relaxed">
                      {isExternalUser
                        ? "Type A is available only to internal IIT Roorkee users."
                        : `You have ${peakQualifiedAttempts} of ${RUSH_RELIEF_MIN_PEAK_ATTEMPTS} required peak-window unsuccessful attempts in the current 14-day window (resets after each Type A booking).`}
                      {" "}You may raise a <strong>Type B</strong> request below (50% surcharge; OIC/Admin review required).
                    </p>
                  </div>
                )}

                {!loadingSlotsAvailable && slotsAvailableThisWeek === false && (typeAEligible || showTypeBForm) && (
                  <div className="space-y-4 border-t border-amber-200/80 dark:border-amber-800 pt-4">
                    <div>
                      <p className="text-sm font-semibold">Type B — Urgent with reason (50% surcharge)</p>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        Select slots to hold, then submit. Slots are <strong>not auto-confirmed</strong>. OIC or main Admin will review and may
                        accept, reject, or reschedule (including Saturdays/Sundays) based on operator availability. After approval, submit your sample at the earliest.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setUrgentRequestType("REVIEWER_URGENT");
                          navigate(`/book-equipment?equipment_id=${urgentSelectedEquipmentId}&urgent=1&return_to=my-urgent-requests`);
                        }}
                      >
                        Select Slot
                      </Button>
                      <p className="text-xs text-muted-foreground">Pick slot(s) on the booking page, then return here to submit. Slots are held on submit.</p>
                      {urgentHoldBookingId != null && (
                        <p className="text-xs text-green-600 dark:text-green-500 font-medium">
                          Slot held ({urgentHoldVirtualBookingId || `Booking #${urgentHoldBookingId}`}).
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="urgent-disclaimer-reviewer-page"
                          checked={urgentDisclaimerAccepted}
                          onChange={(e) => {
                            setUrgentDisclaimerAccepted(e.target.checked);
                            setUrgentRequestType("REVIEWER_URGENT");
                          }}
                          className="h-4 w-4 rounded border-input"
                        />
                        <Label htmlFor="urgent-disclaimer-reviewer-page" className="text-sm cursor-pointer">
                          I confirm my reason is genuine and accept the 50% urgent surcharge and OIC/Admin review.
                        </Label>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="urgent-reviewer-comment-page" className="text-sm">Reason (required)</Label>
                        <Textarea
                          id="urgent-reviewer-comment-page"
                          value={urgentReviewerComment}
                          onChange={(e) => {
                            setUrgentReviewerComment(e.target.value);
                            setUrgentRequestType("REVIEWER_URGENT");
                          }}
                          placeholder="Why is this booking urgent? (min. 10 characters)"
                          rows={4}
                          className="max-w-xl"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="urgent-evidence-page" className="text-sm">Supporting document (optional)</Label>
                        <Input
                          id="urgent-evidence-page"
                          type="file"
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif"
                          className="h-9 text-sm max-w-md"
                          onChange={(e) => setUrgentEvidenceFile(e.target.files?.[0] ?? null)}
                        />
                        {urgentEvidenceFile && <p className="text-xs text-muted-foreground">Selected: {urgentEvidenceFile.name}</p>}
                      </div>
                    </div>

                    <Button
                      size="sm"
                      className="bg-amber-600 hover:bg-amber-700"
                      disabled={
                        !urgentDisclaimerAccepted ||
                        urgentSubmitting ||
                        urgentReviewerComment.trim().length < 10
                      }
                      onClick={async () => {
                        const eqId = parseInt(urgentSelectedEquipmentId, 10);
                        if (Number.isNaN(eqId)) return;
                        if (urgentReviewerComment.trim().length < 10) {
                          toast.error("Please enter a reason (at least 10 characters).");
                          return;
                        }
                        setUrgentSubmitting(true);
                        try {
                          const res = await apiClient.createUrgentBookingRequest({
                            equipment_id: eqId,
                            request_type: "REVIEWER_URGENT",
                            disclaimer_accepted: true,
                            number_of_samples: 1,
                            slots_requested: 1,
                            evidence_file: urgentEvidenceFile ?? undefined,
                            evidence_original_name: urgentEvidenceFile?.name,
                            reviewer_comment: urgentReviewerComment.trim(),
                            hold_booking_id: urgentHoldBookingId ?? undefined,
                          });
                          if (res.error) {
                            toast.error(res.error);
                            return;
                          }
                          toast.success(res.data?.message || "Type B urgent request submitted for review.");
                          setUrgentHoldBookingId(null);
                          setUrgentHoldVirtualBookingId(null);
                          setUrgentRequestType("");
                          setRushReliefQualified(false);
                          setPeakQualifiedAttempts(0);
                          setUrgentDisclaimerAccepted(false);
                          setUrgentEvidenceFile(null);
                          setUrgentReviewerComment("");
                          setLoading(true);
                          const listRes = await apiClient.listMyUrgentBookingRequests({ limit: 50, offset: 0 });
                          if (listRes.data?.urgent_requests) {
                            setList(listRes.data.urgent_requests);
                            setTotalCount(listRes.data.total_count ?? listRes.data.urgent_requests.length);
                          }
                          setLoading(false);
                        } catch (e: any) {
                          toast.error(e?.message || "Failed to submit request.");
                        } finally {
                          setUrgentSubmitting(false);
                        }
                      }}
                    >
                      {urgentSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Submit Type B request
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Urgent request status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Your urgent request status
            </CardTitle>
            <CardDescription>
              {totalCount === 0
                ? "You have not submitted any urgent booking requests."
                : `You have ${totalCount} urgent request${totalCount !== 1 ? "s" : ""}.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : list.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">No urgent requests</p>
                <p className="text-sm mt-1">
                  Submit a new request using the form above; it will appear here once submitted.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-semibold">Equipment</TableHead>
                    <TableHead className="font-semibold">Request type</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Time remaining</TableHead>
                    <TableHead className="font-semibold">Requested</TableHead>
                    <TableHead className="font-semibold">Decided</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((row) => {
                    const statusUpper = (row.status || "").toUpperCase();
                    const isExpired = statusUpper === "EXPIRED" || getSecondsRemaining(row.expiry_at) <= 0;
                    const secondsRemaining = getSecondsRemaining(row.expiry_at);
                    return (
                    <TableRow key={row.id}>
                      <TableCell>
                        <span className="font-medium">{row.equipment_name}</span>
                        {row.equipment_code && (
                          <span className="text-muted-foreground text-sm ml-1">({row.equipment_code})</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {REQUEST_TYPE_LABELS[row.request_type] || row.request_type}
                      </TableCell>
                      <TableCell>{getStatusBadge(row)}</TableCell>
                      <TableCell className="text-sm font-mono">
                        {statusUpper === "APPROVED" || statusUpper === "REJECTED"
                          ? "—"
                          : isExpired
                            ? "Expired"
                            : row.expiry_at
                              ? formatTimeRemaining(secondsRemaining)
                              : "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.requested_at ? format(new Date(row.requested_at), "dd MMM yyyy, HH:mm") : "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.decided_at ? format(new Date(row.decided_at), "dd MMM yyyy, HH:mm") : "—"}
                      </TableCell>
                    </TableRow>
                  );})}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default MyUrgentRequests;
