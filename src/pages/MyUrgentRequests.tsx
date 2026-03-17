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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import { ArrowLeft, Loader2, AlertCircle, Clock, CheckCircle, XCircle, HelpCircle } from "lucide-react";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { toast } from "sonner";

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
  NO_SLOT: "Unable to get slot despite repeated trials",
  REVIEWER_URGENT: "Urgent comment from reviewer",
};

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
  const [urgentEquipmentList, setUrgentEquipmentList] = useState<Array<{ equipment_id: number; code: string; name: string }>>([]);
  const [loadingUrgentEquipments, setLoadingUrgentEquipments] = useState(false);
  const [urgentSelectedEquipmentId, setUrgentSelectedEquipmentId] = useState<string>("");
  const [urgentRequestType, setUrgentRequestType] = useState<"NO_SLOT" | "REVIEWER_URGENT">("NO_SLOT");
  const [urgentDisclaimerAccepted, setUrgentDisclaimerAccepted] = useState(false);
  const [urgentEvidenceFile, setUrgentEvidenceFile] = useState<File | null>(null);
  const [urgentSubmitting, setUrgentSubmitting] = useState(false);
  const [urgentHoldBookingId, setUrgentHoldBookingId] = useState<number | null>(null);
  const [myUnsuccessfulAttempts, setMyUnsuccessfulAttempts] = useState<Array<{ id: number; requested_at: string | null; outcome: string; failure_reason: string; number_of_samples: number; slots_requested: number }>>([]);
  const [myUnsuccessfulAttemptsLoading, setMyUnsuccessfulAttemptsLoading] = useState(false);
  const [slotsAvailableThisWeek, setSlotsAvailableThisWeek] = useState<boolean | null>(null);
  const [loadingSlotsAvailable, setLoadingSlotsAvailable] = useState(false);

  // Pre-fill from URL when returning from book-equipment (Hold slots and return)
  useEffect(() => {
    const eqId = searchParams.get("urgent_equipment_id");
    const holdId = searchParams.get("hold_booking_id");
    if (eqId) setUrgentSelectedEquipmentId(eqId);
    if (holdId) setUrgentHoldBookingId(parseInt(holdId, 10) || null);
    if (eqId || holdId) {
      setSearchParams((prev) => {
        const p = new URLSearchParams(prev);
        p.delete("urgent_equipment_id");
        p.delete("hold_booking_id");
        return p;
      }, { replace: true });
    }
  }, []);

  // Load equipment list for dropdown
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    setLoadingUrgentEquipments(true);
    apiClient
      .getEquipments(undefined, "ACTIVE")
      .then((res) => {
        const raw = (res as { data?: unknown })?.data ?? res;
        const data = Array.isArray(raw) ? raw : (raw as { equipments?: unknown[] })?.equipments ?? (raw as { results?: unknown[] })?.results ?? [];
        setUrgentEquipmentList(
          (data as Array<{ equipment_id?: number; id?: number; code?: string; equipment_code?: string; name?: string; equipment_name?: string }>).map((e) => ({
            equipment_id: e.equipment_id ?? e.id ?? 0,
            code: e.code ?? e.equipment_code ?? "",
            name: e.name ?? e.equipment_name ?? "",
          }))
        );
      })
      .catch(() => setUrgentEquipmentList([]))
      .finally(() => setLoadingUrgentEquipments(false));
  }, [isAuthenticated, user]);

  // Load unsuccessful attempts when equipment selected and reason is NO_SLOT
  useEffect(() => {
    if (!urgentSelectedEquipmentId || urgentRequestType !== "NO_SLOT") {
      setMyUnsuccessfulAttempts([]);
      return;
    }
    const id = parseInt(urgentSelectedEquipmentId, 10);
    if (Number.isNaN(id)) return;
    setMyUnsuccessfulAttemptsLoading(true);
    apiClient
      .getMyUnsuccessfulBookingAttempts(id)
      .then((res) => {
        if (res.data?.entries) setMyUnsuccessfulAttempts(res.data.entries);
        else setMyUnsuccessfulAttempts([]);
      })
      .catch(() => setMyUnsuccessfulAttempts([]))
      .finally(() => setMyUnsuccessfulAttemptsLoading(false));
  }, [urgentSelectedEquipmentId, urgentRequestType]);

  const noSlotNoAttempts = urgentRequestType === "NO_SLOT" && !myUnsuccessfulAttemptsLoading && myUnsuccessfulAttempts.length === 0;

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
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const startStr = format(weekStart, "yyyy-MM-dd");
    const endStr = format(weekEnd, "yyyy-MM-dd");
    apiClient
      .getEquipmentSlots(id, startStr, endStr)
      .then((res) => {
        const slots = (res as { data?: { slots?: Array<{ status?: string }> } })?.data?.slots ?? [];
        const hasAvailable = slots.some((s) => (s.status || "").toUpperCase() === "AVAILABLE");
        setSlotsAvailableThisWeek(hasAvailable);
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
  }, [navigate, isAuthenticated, user, authLoading]);

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
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
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
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">Submit new urgent request</CardTitle>
            <CardDescription>Select equipment, choose reason, and submit. You may select slots on the booking page first and return here to complete.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Select equipment</Label>
              <Select
                value={urgentSelectedEquipmentId || "__none__"}
                onValueChange={(v) => {
                  setUrgentSelectedEquipmentId(v === "__none__" ? "" : v);
                  setUrgentRequestType("NO_SLOT");
                  setUrgentDisclaimerAccepted(false);
                  setUrgentEvidenceFile(null);
                  setUrgentHoldBookingId(null);
                }}
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
                {loadingSlotsAvailable && (
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Checking slot availability…
                  </p>
                )}
                {!loadingSlotsAvailable && slotsAvailableThisWeek === true && (
                  <div className="rounded-lg border-2 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 p-4 space-y-3">
                    <p className="text-sm font-medium text-green-800 dark:text-green-200">
                      Slots are available in the current week for this equipment. Please book normally instead of raising an urgent request.
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
                {!loadingSlotsAvailable && slotsAvailableThisWeek !== true && (
                <div className="space-y-4">
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Reason</Label>
                  <RadioGroup
                    value={urgentRequestType}
                    onValueChange={(v) => {
                      setUrgentRequestType(v as "NO_SLOT" | "REVIEWER_URGENT");
                      setUrgentDisclaimerAccepted(false);
                      setUrgentEvidenceFile(null);
                    }}
                    className="flex flex-col gap-2"
                  >
                    <div className="flex items-center space-x-3 rounded-lg border p-3">
                      <RadioGroupItem value="NO_SLOT" id="urgent-no-slot-page" className="h-4 w-4" />
                      <Label htmlFor="urgent-no-slot-page" className="flex-1 cursor-pointer text-sm">
                        Unable to get slot despite repeated trials (reviewed by Admin/OIC)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-3 rounded-lg border p-3">
                      <RadioGroupItem value="REVIEWER_URGENT" id="urgent-reviewer-page" className="h-4 w-4" />
                      <Label htmlFor="urgent-reviewer-page" className="flex-1 cursor-pointer text-sm">
                        Urgent comment from reviewer (upload evidence; Supervisor then Admin/OIC)
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={noSlotNoAttempts}
                    onClick={() => navigate(`/book-equipment?equipment_id=${urgentSelectedEquipmentId}&urgent=1&return_to=my-urgent-requests`)}
                  >
                    Select Slot
                  </Button>
                  <p className="text-xs text-muted-foreground">Pick slot(s) on the booking page, then return here to submit. Slots are held when you submit below.</p>
                  {urgentHoldBookingId != null && (
                    <p className="text-xs text-green-600 dark:text-green-500 font-medium">Slot held (Booking #{urgentHoldBookingId}).</p>
                  )}
                </div>

                {urgentRequestType === "NO_SLOT" && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground bg-muted/30 rounded p-3 border">I am unable to get any booking despite repeated trials and my requirement is genuine and urgent.</p>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="urgent-disclaimer-page"
                        checked={urgentDisclaimerAccepted}
                        onChange={(e) => setUrgentDisclaimerAccepted(e.target.checked)}
                        disabled={noSlotNoAttempts}
                        className="h-4 w-4 rounded border-input"
                      />
                      <Label htmlFor="urgent-disclaimer-page" className={`text-sm cursor-pointer ${noSlotNoAttempts ? "opacity-60" : ""}`}>I confirm the above.</Label>
                    </div>
                    <div className="space-y-2 mt-3">
                      <p className="text-sm font-medium">Your unsuccessful booking attempts for this equipment (past 2 weeks)</p>
                      {myUnsuccessfulAttemptsLoading ? (
                        <p className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Loading…</p>
                      ) : myUnsuccessfulAttempts.length > 0 ? (
                        <div className="border rounded overflow-hidden max-h-36 overflow-y-auto">
                          <table className="w-full text-xs">
                            <thead className="bg-muted/50 sticky top-0">
                              <tr>
                                <th className="text-left p-2 font-medium">Date</th>
                                <th className="text-left p-2 font-medium">Time</th>
                                <th className="text-left p-2 font-medium">Slots</th>
                                <th className="text-left p-2 font-medium max-w-[100px] truncate">Reason</th>
                              </tr>
                            </thead>
                            <tbody>
                              {myUnsuccessfulAttempts.map((e) => {
                                const d = e.requested_at ? new Date(e.requested_at) : null;
                                return (
                                  <tr key={e.id} className="border-t">
                                    <td className="p-2">{d ? format(d, "dd MMM yyyy") : "—"}</td>
                                    <td className="p-2">{d ? format(d, "HH:mm") : "—"}</td>
                                    <td className="p-2">{e.slots_requested}</td>
                                    <td className="p-2 text-muted-foreground truncate max-w-[100px]" title={e.failure_reason}>{e.failure_reason || "—"}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">No unsuccessful attempts in the past 2 weeks.</p>
                      )}
                    </div>
                  </div>
                )}

                {urgentRequestType === "REVIEWER_URGENT" && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground border border-amber-200 dark:border-amber-800 rounded p-3 bg-amber-50/50 dark:bg-amber-950/20">Upload documentary evidence. Supervisor approves first, then Admin/OIC.</p>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="urgent-disclaimer-reviewer-page"
                        checked={urgentDisclaimerAccepted}
                        onChange={(e) => setUrgentDisclaimerAccepted(e.target.checked)}
                        className="h-4 w-4 rounded border-input"
                      />
                      <Label htmlFor="urgent-disclaimer-reviewer-page" className="text-sm cursor-pointer">I have read and will upload genuine evidence.</Label>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="urgent-evidence-page" className="text-sm">Evidence (required) *</Label>
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
                )}

                <Button
                  size="sm"
                  className="bg-amber-600 hover:bg-amber-700"
                  disabled={
                    loadingSlotsAvailable ||
                    slotsAvailableThisWeek === true ||
                    !urgentDisclaimerAccepted ||
                    urgentSubmitting ||
                    (urgentRequestType === "REVIEWER_URGENT" && !urgentEvidenceFile) ||
                    noSlotNoAttempts
                  }
                  onClick={async () => {
                    const eqId = parseInt(urgentSelectedEquipmentId, 10);
                    if (Number.isNaN(eqId)) return;
                    if (urgentRequestType === "REVIEWER_URGENT" && !urgentEvidenceFile) {
                      toast.error("Please upload documentary evidence.");
                      return;
                    }
                    setUrgentSubmitting(true);
                    try {
                      const res = await apiClient.createUrgentBookingRequest({
                        equipment_id: eqId,
                        request_type: urgentRequestType,
                        disclaimer_accepted: true,
                        number_of_samples: 1,
                        slots_requested: 1,
                        evidence_file: urgentRequestType === "REVIEWER_URGENT" ? urgentEvidenceFile ?? undefined : undefined,
                        evidence_original_name: urgentEvidenceFile?.name,
                        hold_booking_id: urgentHoldBookingId ?? undefined,
                      });
                      if (res.error) {
                        toast.error(res.error);
                        return;
                      }
                      toast.success(res.data?.message || "Urgent request submitted.");
                      setUrgentHoldBookingId(null);
                      setUrgentRequestType("NO_SLOT");
                      setUrgentDisclaimerAccepted(false);
                      setUrgentEvidenceFile(null);
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
                  Submit request
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
