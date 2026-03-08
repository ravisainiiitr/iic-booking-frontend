import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import DashboardHeader from "@/components/DashboardHeader";
import { ArrowLeft, Loader2, Check, X, FileText, ExternalLink, Clock } from "lucide-react";
import { format } from "date-fns";

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

type UrgentRequestRow = {
  id: number;
  request_type: string;
  user_id: number;
  user_name: string;
  user_email: string;
  equipment_id: number;
  equipment_code: string;
  equipment_name: string;
  requested_at: string;
  disclaimer_accepted: boolean;
  number_of_samples: number;
  slots_requested: number;
  duration_minutes: number | null;
  evidence_file_url: string | null;
  evidence_original_name: string;
  wallet_approved_at: string | null;
  wallet_approved_by_name: string | null;
  wallet_notes: string;
  pending_wallet_approval: boolean;
  status: string;
  admin_notes: string;
  decided_at: string | null;
  decided_by_name: string | null;
  expiry_at: string | null;
  no_slot_log_count: number;
  no_slot_log_entries: Array<{
    requested_at: string;
    number_of_samples: number;
    slots_requested: number;
    duration_minutes: number | null;
  }>;
  requester_approved_urgent_last_6_months?: Array<{
    id: number;
    requested_at: string | null;
    decided_at: string | null;
  }>;
  hold_booking_id: number | null;
  hold_booking_summary: {
    booking_id: number;
    total_charge: string | null;
    total_time_minutes: number;
    slot_times: Array<{ start: string | null; end: string | null; label?: string | null }>;
    input_values: Record<string, unknown>;
    charge_breakdown?: Array<{ description: string; amount: number }> | null;
  } | null;
};

const UrgentRequests = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [list, setList] = useState<UrgentRequestRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [detailRow, setDetailRow] = useState<UrgentRequestRow | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");
  const [viewParamsOpen, setViewParamsOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [validityDays, setValidityDays] = useState<number>(1);
  const [validityDaysEditing, setValidityDaysEditing] = useState(false);
  const [validityDaysSaving, setValidityDaysSaving] = useState(false);
  const [validityDaysInput, setValidityDaysInput] = useState("1");
  const [tick, setTick] = useState(0);

  // Update every second for Time remaining countdown
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const userType = user?.user_type ? String(user.user_type).toLowerCase() : "";
  const canAccess = userType === "admin" || userType === "manager" || userType === "operator";

  // When Pending is selected: show only non-expired and "Pending your decision" (actionable by admin/OIC)
  const displayedList =
    statusFilter === "PENDING"
      ? list.filter(
          (r) =>
            r.status === "PENDING" &&
            getSecondsRemaining(r.expiry_at ?? null) > 0 &&
            !r.pending_wallet_approval
        )
      : list;
  const displayCount = statusFilter === "PENDING" ? displayedList.length : totalCount;

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !user) {
      navigate("/auth");
      return;
    }
    if (!canAccess) {
      toast.error("Only Admin and Officer in charge can access Urgent Requests.");
      navigate("/dashboard");
      return;
    }
    fetchList();
    fetchHoldExpiryConfig();
  }, [navigate, isAuthenticated, user, canAccess, authLoading, statusFilter]);

  const fetchHoldExpiryConfig = async () => {
    try {
      const res = await apiClient.getUrgentHoldExpiryConfig();
      if (res.data?.urgent_booking_validity_days != null && res.data.urgent_booking_validity_days >= 1) {
        setValidityDays(res.data.urgent_booking_validity_days);
        setValidityDaysInput(String(res.data.urgent_booking_validity_days));
      } else {
        setValidityDays(1);
        setValidityDaysInput("1");
      }
    } catch {
      /* ignore */
    }
  };

  const fetchList = async () => {
    setLoading(true);
    try {
      const res = await apiClient.listUrgentBookingRequests({
        status: statusFilter || undefined,
        limit: 100,
        offset: 0,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      const data = res.data as { urgent_requests: UrgentRequestRow[]; total_count: number };
      setList(data.urgent_requests || []);
      setTotalCount(data.total_count ?? 0);
    } catch (e) {
      toast.error("Failed to load urgent requests");
    } finally {
      setLoading(false);
    }
  };

  const handleApproveReject = async (id: number, newStatus: "APPROVED" | "REJECTED") => {
    setActionLoading(true);
    try {
      const res = await apiClient.updateUrgentBookingRequest(id, {
        status: newStatus,
        admin_notes: adminNotes,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(newStatus === "APPROVED" ? "Request approved." : "Request rejected. Hold released and slots freed.");
      setDetailRow(null);
      setAdminNotes("");
      fetchList();
    } catch (e) {
      toast.error("Failed to update request");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    setDeleteLoading(true);
    try {
      const res = await apiClient.deleteUrgentBookingRequest(id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Request deleted.");
      setDetailRow(null);
      fetchList();
    } catch (e) {
      toast.error("Failed to delete request");
    } finally {
      setDeleteLoading(false);
    }
  };

  if (!canAccess) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100/80 dark:from-background dark:via-background dark:to-accent/10">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Page header */}
        <div className="mb-6">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground mb-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/booking-management")} className="-ml-2">
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Booking Management
            </Button>
            <span className="text-muted-foreground/60">/</span>
            <Button variant="ghost" size="sm" onClick={() => navigate("/booking-attempt-logs")}>
              Booking attempt log
            </Button>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Urgent Requests</h1>
          <p className="text-muted-foreground mt-1 text-sm max-w-2xl">
            Review urgent booking requests. For &quot;Urgent comment from reviewer&quot; type, the supervisor must approve first; then you may approve or reject. View the attachment at every level to verify genuineness.
          </p>
          {/* Validity config */}
          <div className="flex flex-wrap items-center gap-2 mt-4 text-sm rounded-lg bg-muted/40 dark:bg-muted/20 border border-border/50 px-4 py-3 max-w-2xl">
            <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">Urgent booking validity:</span>
            {validityDaysEditing ? (
              <>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={validityDaysInput}
                  onChange={(e) => setValidityDaysInput(e.target.value)}
                  className="w-20 rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <span className="text-muted-foreground">days</span>
                <Button
                  size="sm"
                  disabled={validityDaysSaving}
                  onClick={async () => {
                    const v = parseInt(validityDaysInput, 10);
                    if (Number.isNaN(v) || v < 1) {
                      toast.error("Enter a number (min 1).");
                      return;
                    }
                    setValidityDaysSaving(true);
                    try {
                      const res = await apiClient.updateUrgentHoldExpiryConfig({
                        urgent_booking_validity_days: v,
                      });
                      if (res.error) {
                        toast.error(res.error);
                        return;
                      }
                      setValidityDays(res.data!.urgent_booking_validity_days);
                      setValidityDaysInput(String(res.data!.urgent_booking_validity_days));
                      setValidityDaysEditing(false);
                      toast.success("Urgent booking validity updated.");
                    } catch (e) {
                      toast.error("Failed to update");
                    } finally {
                      setValidityDaysSaving(false);
                    }
                  }}
                >
                  {validityDaysSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setValidityDaysEditing(false); setValidityDaysInput(String(validityDays)); }}>
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <span className="font-medium text-foreground">{validityDays} day(s)</span>
                <span className="text-muted-foreground">— after this period the request expires and any hold is released</span>
                <Button variant="ghost" size="sm" onClick={() => { setValidityDaysEditing(true); setValidityDaysInput(String(validityDays)); }}>
                  Edit
                </Button>
              </>
            )}
          </div>
        </div>

        <Card className="border border-border/60 shadow-sm rounded-xl overflow-hidden bg-card">
          <CardHeader className="pb-4 space-y-4 border-b border-border/40 bg-muted/20 dark:bg-muted/10">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-lg font-medium">Requests</CardTitle>
                <CardDescription className="mt-1">
                  {statusFilter === "PENDING"
                    ? "Awaiting your decision (non-expired only). "
                    : "No-slot log or reviewer-urgent (supervisor approves first for reviewer type). "}
                  Showing: {displayCount}
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { value: "", label: "All" },
                  { value: "PENDING", label: "Pending" },
                  { value: "APPROVED", label: "Approved" },
                  { value: "REJECTED", label: "Rejected" },
                  { value: "EXPIRED", label: "Expired" },
                ].map(({ value, label }) => (
                  <Button
                    key={value || "all"}
                    variant={statusFilter === value ? "default" : "outline"}
                    size="sm"
                    className="rounded-full"
                    onClick={() => setStatusFilter(value)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : list.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-muted-foreground">No urgent requests found.</p>
              </div>
            ) : displayedList.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-muted-foreground">
                  {statusFilter === "PENDING"
                    ? "No requests currently awaiting your decision, or all pending requests have expired."
                    : "No matching requests."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b border-border/60">
                    <TableHead className="font-medium text-muted-foreground">Type</TableHead>
                    <TableHead className="font-medium text-muted-foreground">User</TableHead>
                    <TableHead className="font-medium text-muted-foreground">Equipment</TableHead>
                    <TableHead className="font-medium text-muted-foreground">Requested at</TableHead>
                    <TableHead className="font-medium text-muted-foreground">Time remaining</TableHead>
                    <TableHead className="font-medium text-muted-foreground">Status</TableHead>
                    <TableHead className="font-medium text-muted-foreground w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedList.map((row) => (
                    <TableRow key={row.id} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                      <TableCell className="py-3 text-xs">
                        {row.request_type === "REVIEWER_URGENT" ? "Reviewer urgent" : "No slot"}
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="font-medium">{row.user_name}</div>
                        <div className="text-xs text-muted-foreground">{row.user_email}</div>
                      </TableCell>
                      <TableCell className="py-3">
                        <div>{row.equipment_name}</div>
                        <div className="text-xs text-muted-foreground">{row.equipment_code}</div>
                      </TableCell>
                      <TableCell className="py-3 whitespace-nowrap text-sm text-muted-foreground">
                        {row.requested_at ? format(new Date(row.requested_at), "dd MMM yyyy, HH:mm") : "—"}
                      </TableCell>
                      <TableCell className="py-3 text-sm font-mono tabular-nums">
                        {row.status === "APPROVED" || row.status === "REJECTED"
                          ? "—"
                          : getSecondsRemaining(row.expiry_at ?? null) <= 0 && row.expiry_at
                            ? "Expired"
                            : row.expiry_at
                              ? formatTimeRemaining(getSecondsRemaining(row.expiry_at))
                              : "—"}
                      </TableCell>
                      <TableCell className="py-3">
                        {row.status !== "PENDING" && row.status !== "EXPIRED" ? (
                          <Badge
                            className={
                              row.status === "APPROVED"
                                ? "bg-green-600"
                                : "bg-red-600"
                            }
                          >
                            {row.status}
                          </Badge>
                        ) : row.status === "EXPIRED" ? (
                          <Badge className="bg-gray-500">Expired</Badge>
                        ) : row.request_type === "REVIEWER_URGENT" && row.pending_wallet_approval ? (
                          <Badge className="bg-amber-500">Pending supervisor approval</Badge>
                        ) : row.request_type === "REVIEWER_URGENT" && row.wallet_approved_at ? (
                          <Badge className="bg-blue-600">Pending your decision</Badge>
                        ) : (
                          <Badge className="bg-amber-500">Pending your decision</Badge>
                        )}
                      </TableCell>
                      <TableCell className="py-3">
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-md"
                          onClick={() => {
                            setDetailRow(row);
                            setAdminNotes(row.admin_notes || "");
                          }}
                          title={
                            row.request_type === "REVIEWER_URGENT" && row.pending_wallet_approval
                              ? "Supervisor must approve before you can approve"
                              : undefined
                          }
                        >
                          {row.status !== "PENDING"
                            ? "View"
                            : row.request_type === "REVIEWER_URGENT" && row.pending_wallet_approval
                              ? "View only"
                              : "View / Decide"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={!!detailRow} onOpenChange={(open) => { if (!open) { setDetailRow(null); setViewParamsOpen(false); } }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Urgent request details</DialogTitle>
              <DialogDescription>
                {detailRow?.status === "EXPIRED"
                  ? "This request has expired (no action was taken within the hold expiry time). The hold was released and slots are free. No further action is possible except delete."
                  : detailRow?.request_type === "REVIEWER_URGENT"
                    ? detailRow?.pending_wallet_approval
                      ? "Urgent comment from reviewer: supervisor must approve first. You may view the attachment and reject; Approve will be enabled after supervisor approval."
                      : "Urgent comment from reviewer: Supervisor has approved. View the attachment if needed and approve or reject."
                    : "Unable to get slot despite trials: no supervisor approval required. Review the no-slot log and approve or reject."}
              </DialogDescription>
            </DialogHeader>
            {detailRow && (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground rounded-md border bg-muted/30 p-2">
                  {detailRow.request_type === "REVIEWER_URGENT"
                    ? "For reviewer-urgent requests, you may approve only after the supervisor has approved. You may view the attachment and reject at any time."
                    : "For no-slot requests there is no wallet step; you may approve or reject directly."}
                </p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Type:</span>{" "}
                    {detailRow.request_type === "REVIEWER_URGENT" ? "Urgent comment from reviewer" : "Unable to get slot despite trials"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">User:</span> {detailRow.user_name} ({detailRow.user_email})
                  </div>
                  <div>
                    <span className="text-muted-foreground">Equipment:</span> {detailRow.equipment_name} ({detailRow.equipment_code})
                  </div>
                  <div>
                    <span className="text-muted-foreground">Requested at:</span>{" "}
                    {detailRow.requested_at ? format(new Date(detailRow.requested_at), "dd MMM yyyy, HH:mm") : "—"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Samples / Slots:</span> {detailRow.number_of_samples} / {detailRow.slots_requested}
                    {detailRow.duration_minutes != null ? `, ${detailRow.duration_minutes} min` : ""}
                  </div>
                  {detailRow.request_type === "REVIEWER_URGENT" && (
                    <>
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Supervisor approval:</span>{" "}
                        {detailRow.pending_wallet_approval
                          ? "Pending supervisor approval — Approve will be enabled after they approve."
                          : detailRow.wallet_approved_at
                            ? `Approved by ${detailRow.wallet_approved_by_name || "—"} on ${format(new Date(detailRow.wallet_approved_at), "dd MMM yyyy")}. You may now approve or reject.`
                            : "—"}
                        {detailRow.wallet_notes && (
                          <p className="text-muted-foreground text-xs mt-1">Note: {detailRow.wallet_notes}</p>
                        )}
                      </div>
                      <div className="col-span-2 flex items-center gap-2">
                        <span className="text-muted-foreground">Evidence:</span>
                        {detailRow.evidence_file_url || detailRow.evidence_original_name ? (
                          <Button
                            type="button"
                            variant="link"
                            className="h-auto p-0 text-primary inline-flex items-center gap-1"
                            disabled={evidenceLoading}
                            onClick={async () => {
                              setEvidenceLoading(true);
                              try {
                                const blobUrl = await apiClient.fetchUrgentRequestEvidenceBlobUrl(detailRow.id);
                                window.open(blobUrl, "_blank", "noopener");
                                setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
                              } catch (e) {
                                toast.error(e instanceof Error ? e.message : "Failed to open evidence");
                              } finally {
                                setEvidenceLoading(false);
                              }
                            }}
                          >
                            {evidenceLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                            {detailRow.evidence_original_name || "View attachment"}
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        ) : (
                          "—"
                        )}
                      </div>
                    </>
                  )}
                </div>
                {/* Requests approved in last 6 months (this requester, this equipment) */}
                <div>
                  <Label className="text-sm font-medium">Requests approved in last 6 months</Label>
                  <p className="text-xs text-muted-foreground mt-0.5 mb-2">Urgent requests approved for this requester on this equipment.</p>
                  <div className="border rounded-md overflow-hidden">
                    {(detailRow.requester_approved_urgent_last_6_months ?? []).length === 0 ? (
                      <p className="text-sm text-muted-foreground px-4 py-3">None</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="font-medium text-muted-foreground">#</TableHead>
                            <TableHead className="font-medium text-muted-foreground">Requested at</TableHead>
                            <TableHead className="font-medium text-muted-foreground">Approved on</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(detailRow.requester_approved_urgent_last_6_months ?? []).map((a, i) => (
                            <TableRow key={a.id}>
                              <TableCell className="text-sm">{i + 1}</TableCell>
                              <TableCell className="text-sm">
                                {a.requested_at ? format(new Date(a.requested_at), "dd MMM yyyy, HH:mm") : "—"}
                              </TableCell>
                              <TableCell className="text-sm font-medium">
                                {a.decided_at ? format(new Date(a.decided_at), "dd MMM yyyy") : "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </div>
                {detailRow.hold_booking_id != null && detailRow.hold_booking_summary && (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setViewParamsOpen(true)}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      View user parameters
                    </Button>
                    <span className="text-xs text-muted-foreground">Slot(s) and inputs selected by the user for this request.</span>
                  </div>
                )}
                <div>
                  <Label className="text-sm font-medium">Booking requests by users ({detailRow.no_slot_log_entries?.length ?? 0} recent)</Label>
                  <div className="mt-2 border rounded-md overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Time</TableHead>
                          <TableHead>Samples</TableHead>
                          <TableHead>Slots</TableHead>
                          <TableHead>Duration (min)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(detailRow.no_slot_log_entries || []).map((e, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-sm">
                              {e.requested_at ? format(new Date(e.requested_at), "dd MMM HH:mm") : "—"}
                            </TableCell>
                            <TableCell>{e.number_of_samples}</TableCell>
                            <TableCell>{e.slots_requested}</TableCell>
                            <TableCell>{e.duration_minutes ?? "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-notes">Admin / OIC notes</Label>
                  <Textarea
                    id="admin-notes"
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Optional notes for this decision"
                    rows={3}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDetailRow(null)}>
                Close
              </Button>
              <Button
                variant="outline"
                className="text-red-600 border-red-600 hover:bg-red-50"
                disabled={deleteLoading}
                onClick={() => detailRow && handleDelete(detailRow.id)}
              >
                {deleteLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Delete
              </Button>
              {detailRow?.status === "PENDING" && (
                <>
                  <Button
                    variant="outline"
                    className="text-red-600 border-red-600 hover:bg-red-50"
                    disabled={actionLoading}
                    onClick={() => detailRow && handleApproveReject(detailRow.id, "REJECTED")}
                  >
                    {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <X className="h-4 w-4 mr-2" />}
                    Reject
                  </Button>
                  <Button
                    disabled={actionLoading || (detailRow.request_type === "REVIEWER_URGENT" && detailRow.pending_wallet_approval)}
                    onClick={() => detailRow && handleApproveReject(detailRow.id, "APPROVED")}
                    title={detailRow.request_type === "REVIEWER_URGENT" && detailRow.pending_wallet_approval ? "Supervisor must approve first" : undefined}
                  >
                    {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                    Approve
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={viewParamsOpen} onOpenChange={setViewParamsOpen}>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg">User slot & parameters</DialogTitle>
              <DialogDescription>
                Parameters and slot(s) selected by the user when they used &quot;Select Slot&quot; for this urgent request.
              </DialogDescription>
            </DialogHeader>
            {detailRow?.hold_booking_summary && (() => {
              const summary = detailRow.hold_booking_summary;
              const inputValues = summary.input_values || {};
              const chargeBreakdown = summary.charge_breakdown || [];
              const slotTimes = summary.slot_times || [];
              const totalCharge = summary.total_charge != null ? Number(summary.total_charge) : null;
              return (
                <div className="space-y-6 text-base">
                  {/* User Inputs section - same style as Booking details card */}
                  {Object.keys(inputValues).length > 0 && (
                    <div className="rounded-xl bg-muted/30 dark:bg-muted/20 border border-border/60 shadow-sm overflow-hidden">
                      <div className="flex items-center gap-2.5 px-5 py-4 bg-primary/5 dark:bg-primary/10 border-b border-border/60">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 dark:bg-primary/20 text-primary">
                          <FileText className="h-5 w-5" />
                        </div>
                        <p className="text-base font-semibold text-foreground tracking-tight">User Inputs</p>
                      </div>
                      <ul className="divide-y divide-border/50">
                        {Object.entries(inputValues).map(([label, value]) => (
                          <li key={label} className="flex items-center justify-between gap-4 px-5 py-4 bg-background/50 dark:bg-background/30">
                            <span className="text-sm font-semibold text-muted-foreground shrink-0">{label}</span>
                            <span className="text-base font-medium text-foreground text-right break-words">
                              {value === undefined || value === null ? "—" : Array.isArray(value) ? (value as unknown[]).join(", ") : String(value)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {/* Charge Breakdown */}
                  <div>
                    <p className="text-base font-medium mb-2">Charge Breakdown:</p>
                    {chargeBreakdown.length > 0 ? (
                      <ul className="space-y-1">
                        {chargeBreakdown
                          .filter((c) => String(c.description || "").trim().toLowerCase() !== "total")
                          .map((charge, index) => (
                            <li key={index} className="text-base text-muted-foreground flex justify-between">
                              <span>{charge.description}</span>
                              <span>{charge.amount >= 0 ? `₹${Number(charge.amount).toFixed(2)}` : `-₹${Number(-charge.amount).toFixed(2)}`}</span>
                            </li>
                          ))}
                        <li className="text-base font-medium flex justify-between pt-2 mt-2 border-t border-border/60">
                          <span>Total</span>
                          <span className="text-primary">{totalCharge != null ? `₹${totalCharge.toFixed(2)}` : "—"}</span>
                        </li>
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Total: {totalCharge != null ? `₹${totalCharge.toFixed(2)}` : "—"}
                        {summary.total_time_minutes != null && ` · ${summary.total_time_minutes} min`}
                      </p>
                    )}
                  </div>
                  {/* Booked Slots - pill tags */}
                  <div>
                    <p className="text-base font-medium mb-2">Booked Slots:</p>
                    <div className="flex flex-wrap gap-2">
                      {slotTimes.length > 0 ? (
                        slotTimes.map((st, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center rounded-full border border-border/80 bg-muted/50 px-4 py-1.5 text-sm font-medium text-foreground"
                          >
                            {st.label || (st.start && st.end ? `${format(new Date(st.start), "dd MMM HH:mm")} – ${format(new Date(st.end), "HH:mm")}` : "—")}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default UrgentRequests;
