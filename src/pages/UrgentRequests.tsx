import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiClient } from "@/lib/api";
import UrgentAllocateDialog, { type UrgentAllocateTarget } from "@/components/UrgentAllocateDialog";
import { UrgentRequestDetailDialog, urgentDecisionFacts, type UrgentRequestDetailData } from "@/components/urgent/UrgentRequestDetailDialog";
import { slotSpanLabel } from "@/lib/slotTimeRange";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { StandaloneOnly } from "@/components/PageShell";
import { RequesterIdentityButton } from "@/components/UserIdentityCardDialog";
import { StaffListFilterRow, useStaffListFilters, type StaffEquipmentOption } from "@/components/StaffListFilters";
import { ExportMenu } from "@/components/ExportMenu";
import { ArrowLeft, Loader2, Check, X, Clock } from "lucide-react";
import { format } from "date-fns";
import { SampleRequirementsTable } from "@/components/booking/SampleRequirementsTable";
import { InlineDateTime, StackedDateTime } from "@/components/StaffListCells";
import { useElementWidth } from "@/hooks/use-element-width";
import { cn } from "@/lib/utils";

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

type UrgentRequestRow = UrgentRequestDetailData & {
  disclaimer_accepted: boolean;
  no_slot_log_count: number;
  no_slot_log_entries: Array<{
    requested_at: string;
    number_of_samples: number;
    slots_requested: number;
    duration_minutes: number | null;
  }>;
};

/** Type B request whose slots the OIC still has to choose (no held slots). */
const needsSlotAllocation = (row: Pick<UrgentRequestRow, "requires_slot_allocation" | "hold_booking_id">) =>
  !!row.requires_slot_allocation && row.hold_booking_id == null;

type UrgentView = "needs_action" | "awaiting_supervisor" | "approved" | "rejected" | "expired" | "all";

const URGENT_VIEWS: Array<{ value: UrgentView; label: string; status: string }> = [
  { value: "needs_action", label: "Needs action", status: "PENDING" },
  { value: "awaiting_supervisor", label: "Awaiting supervisor", status: "PENDING" },
  { value: "approved", label: "Approved", status: "APPROVED" },
  { value: "rejected", label: "Rejected", status: "REJECTED" },
  { value: "expired", label: "Expired", status: "EXPIRED" },
  { value: "all", label: "All", status: "" },
];

const PAGE_SIZE = 100;

/** Below this list width the requests are shown as stacked cards instead of a table. */
const URGENT_TABLE_MIN_WIDTH = 700;

const REQUEST_TYPE_LABELS: Record<string, string> = {
  NO_SLOT: "Type A · rush relief",
  REVIEWER_URGENT: "Type B · 50% surcharge",
};

const UrgentRequests = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [list, setList] = useState<UrgentRequestRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const listFilters = useStaffListFilters();
  const { departmentReady, reconcileEquipment } = listFilters;
  const { departmentId, equipmentId } = listFilters.query;
  const [equipmentOptions, setEquipmentOptions] = useState<StaffEquipmentOption[]>([]);
  const loadSeq = useRef(0);
  const [viewFilter, setViewFilter] = useState<UrgentView>("needs_action");
  const statusFilter = URGENT_VIEWS.find((v) => v.value === viewFilter)?.status ?? "";
  const [detailRow, setDetailRow] = useState<UrgentRequestRow | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");
  const [viewParamsOpen, setViewParamsOpen] = useState(false);
  const [allocateTarget, setAllocateTarget] = useState<UrgentAllocateTarget | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [validityDays, setValidityDays] = useState<number>(1);
  const [validityDaysEditing, setValidityDaysEditing] = useState(false);
  const [validityDaysSaving, setValidityDaysSaving] = useState(false);
  const [validityDaysInput, setValidityDaysInput] = useState("1");
  const [listRef, listWidth] = useElementWidth();

  const userType = user?.user_type ? String(user.user_type).toLowerCase() : "";
  const canAccess = ["admin", "dept_admin", "manager", "operator"].includes(userType);
  /** Main / Department Administrator: every urgent request (Type A and Type B), not only Type B decisions. */
  const isAdminView = userType === "admin" || userType === "dept_admin";
  /** The expiry applies to the whole portal, so only the Main Administrator can change it (enforced by the server). */
  const canChangeValidity = userType === "admin";

  const displayedList =
    viewFilter === "needs_action"
      ? list.filter(
          (r) =>
            r.status === "PENDING" &&
            getSecondsRemaining(r.expiry_at ?? null) > 0 &&
            !r.pending_wallet_approval
        )
      : viewFilter === "awaiting_supervisor"
        ? list.filter((r) => r.status === "PENDING" && r.pending_wallet_approval)
        : list;
  const displayCount = displayedList.length;

  const fetchList = useCallback(
    async (append = false, offset = 0) => {
      const seq = ++loadSeq.current;
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        const res = await apiClient.listUrgentBookingRequests({
          status: statusFilter || undefined,
          requestType: isAdminView ? undefined : "REVIEWER_URGENT",
          departmentId,
          equipmentId,
          limit: PAGE_SIZE,
          offset,
        });
        if (seq !== loadSeq.current) return;
        if (res.error || !res.data) {
          toast.error(res.error || "Failed to load urgent requests");
          return;
        }
        const rows = (res.data.urgent_requests || []) as UrgentRequestRow[];
        setList((prev) => (append ? [...prev, ...rows] : rows));
        setTotalCount(res.data.total_count ?? 0);
        const meta = res.data.filters;
        if (meta) {
          setEquipmentOptions(meta.equipment_options);
          reconcileEquipment(meta.equipment_options);
        }
      } catch (e) {
        if (seq === loadSeq.current) toast.error("Failed to load urgent requests");
      } finally {
        if (seq === loadSeq.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [statusFilter, isAdminView, departmentId, equipmentId, reconcileEquipment],
  );

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !user) {
      navigate("/auth");
      return;
    }
    if (!canAccess) {
      toast.error("Only the Main Administrator, Department Administrators and Officers in charge can access urgent requests.");
      navigate("/dashboard");
      return;
    }
    fetchHoldExpiryConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, isAuthenticated, user?.id, canAccess, authLoading]);

  useEffect(() => {
    if (authLoading || !isAuthenticated || !canAccess || !departmentReady) return;
    void fetchList();
  }, [authLoading, isAuthenticated, canAccess, departmentReady, fetchList]);

  /** ?request=<id> (sign-in list, OIC emails): open that request's details straight away. */
  const [searchParams, setSearchParams] = useSearchParams();
  const linkedRequestId = Number(searchParams.get("request")) || null;
  useEffect(() => {
    if (authLoading || !isAuthenticated || !canAccess || !linkedRequestId) return;
    let cancelled = false;
    void (async () => {
      const res = await apiClient.getUrgentRequestDetail(linkedRequestId);
      if (cancelled) return;
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("request");
          return next;
        },
        { replace: true },
      );
      if (res.error || !res.data) {
        toast.error(res.error || "Could not open that urgent request.");
        return;
      }
      const row = res.data as unknown as UrgentRequestRow;
      setDetailRow(row);
      setAdminNotes(row.admin_notes || "");
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated, canAccess, linkedRequestId, setSearchParams]);

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
      const noHold = detailRow?.id === id && detailRow.hold_booking_id == null;
      toast.success(
        newStatus === "APPROVED"
          ? "Request approved."
          : noHold
            ? "Request rejected. No charge was made."
            : "Request rejected. Hold released and slots freed."
      );
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

  const rowView = (row: UrgentRequestRow) => {
    const secondsLeft = getSecondsRemaining(row.expiry_at ?? null);
    const expired = row.status === "EXPIRED" || (!!row.expiry_at && secondsLeft <= 0);
    const timeLeft =
      row.status === "APPROVED" || row.status === "REJECTED"
        ? "—"
        : secondsLeft <= 0 && row.expiry_at
          ? "Expired"
          : row.expiry_at
            ? formatTimeRemaining(secondsLeft)
            : "—";
    const badge =
      row.status === "APPROVED" ? (
        <Badge className="whitespace-nowrap bg-green-700 text-white hover:bg-green-700">Approved</Badge>
      ) : row.status === "REJECTED" ? (
        <Badge className="whitespace-nowrap bg-red-600 hover:bg-red-600">Rejected</Badge>
      ) : expired ? (
        <Badge className="whitespace-nowrap bg-gray-500 hover:bg-gray-500">Expired</Badge>
      ) : row.pending_wallet_approval ? (
        <Badge variant="outline" className="whitespace-nowrap border-amber-500 text-amber-700 dark:text-amber-300">
          Awaiting supervisor
        </Badge>
      ) : (
        <Badge className="whitespace-nowrap bg-amber-500 text-amber-950 dark:text-amber-950 hover:bg-amber-500">Needs your decision</Badge>
      );
    return {
      timeLeft,
      badge,
      actionable: row.status === "PENDING" && !row.pending_wallet_approval && secondsLeft > 0,
    };
  };

  const renderEquipment = (row: UrgentRequestRow) => (
    <div className="min-w-0">
      <div className="line-clamp-2 text-sm leading-snug" title={row.equipment_name}>
        {row.equipment_name}
      </div>
      <div className="truncate text-xs text-muted-foreground">{row.equipment_code}</div>
    </div>
  );

  const renderType = (row: UrgentRequestRow) => {
    const [code, note] = (REQUEST_TYPE_LABELS[row.request_type] ?? row.request_type).split(" · ");
    return (
      <div className="leading-tight">
        <div className="whitespace-nowrap font-medium">{code}</div>
        {note ? <div className="whitespace-nowrap text-xs text-muted-foreground">{note}</div> : null}
        {needsSlotAllocation(row) ? (
          <div className="whitespace-nowrap text-xs font-medium text-amber-700 dark:text-amber-300">No slots · you allocate</div>
        ) : null}
      </div>
    );
  };

  /** Opens the list row straight away, then fills in the detail-only facts (wallet check, supervisor decision date). */
  const openDetail = (row: UrgentRequestRow) => {
    setDetailRow(row);
    setAdminNotes(row.admin_notes || "");
    void apiClient.getUrgentRequestDetail(row.id).then((res) => {
      if (!res.data) return;
      const full = res.data as unknown as Partial<UrgentRequestRow>;
      setDetailRow((current) => (current?.id === row.id ? { ...current, ...full } : current));
    });
  };

  const openEvidence = async (row: UrgentRequestRow) => {
    setEvidenceLoading(true);
    try {
      const blobUrl = await apiClient.fetchUrgentRequestEvidenceBlobUrl(row.id);
      window.open(blobUrl, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to open evidence");
    } finally {
      setEvidenceLoading(false);
    }
  };

  const renderOpenButton = (row: UrgentRequestRow, actionable: boolean, className?: string) => (
    <Button
      variant={actionable ? "default" : "outline"}
      size="sm"
      className={cn("h-8", className)}
      onClick={() => openDetail(row)}
    >
      {actionable ? "Review" : "View"}
    </Button>
  );

  if (!canAccess) return null;

  return (
    <div className="page-shell">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-6 max-w-7xl">
        <StandaloneOnly>
          <div className="mb-5">
            <Button variant="ghost" size="sm" onClick={() => navigate("/booking-management")} className="-ml-2 mb-2">
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              {userType === "dept_admin" ? "Manage bookings" : "View Booking"}
            </Button>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {isAdminView ? "Urgent Requests" : "Urgent Booking"}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {isAdminView
                ? "All urgent requests (Type A rush relief and Type B with the 50% surcharge) for the selected department and equipment."
                : "Type B urgent requests (50% surcharge) from users of your equipment, waiting for your decision."}
            </p>
          </div>
        </StandaloneOnly>

        {/* Bottom margin keeps the last row clear of the floating Booking Assistant button. */}
        <Card className="mb-20 overflow-hidden rounded-xl border border-border/60 shadow-sm">
          <CardHeader className="space-y-3 border-b border-border/40 bg-muted/20 px-4 py-3 dark:bg-muted/10">
            <StaffListFilterRow filters={listFilters} equipmentOptions={equipmentOptions}>
              <ExportMenu
                report="urgent-requests"
                noun="requests"
                className="sm:ml-auto"
                description="All urgent requests in this view and filter"
                getParams={() => ({
                  status: statusFilter || undefined,
                  request_type: isAdminView ? undefined : "REVIEWER_URGENT",
                  department_id: departmentId,
                  equipment_id: equipmentId,
                })}
              />
            </StaffListFilterRow>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter urgent requests">
                {URGENT_VIEWS.map(({ value, label }) => (
                  <Button
                    key={value}
                    role="tab"
                    aria-selected={viewFilter === value}
                    variant={viewFilter === value ? "default" : "outline"}
                    size="sm"
                    className="h-8 rounded-full px-3"
                    onClick={() => setViewFilter(value)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {validityDaysEditing ? (
                  <>
                    <span>Validity</span>
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={validityDaysInput}
                      onChange={(e) => setValidityDaysInput(e.target.value)}
                      aria-label="Urgent request validity in days"
                      className="h-7 w-16 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <span>days</span>
                    <Button
                      size="sm"
                      className="h-7 px-2 text-xs"
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
                          if (res.error || !res.data) {
                            toast.error(res.error || "Failed to update");
                            return;
                          }
                          setValidityDays(res.data.urgent_booking_validity_days);
                          setValidityDaysInput(String(res.data.urgent_booking_validity_days));
                          setValidityDaysEditing(false);
                          toast.success("Urgent request validity updated.");
                        } catch {
                          toast.error("Failed to update");
                        } finally {
                          setValidityDaysSaving(false);
                        }
                      }}
                    >
                      {validityDaysSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => {
                        setValidityDaysEditing(false);
                        setValidityDaysInput(String(validityDays));
                      }}
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <span title="Requests not decided within this period expire and their held slots are released.">
                      Requests expire after <span className="font-medium text-foreground">{validityDays} day(s)</span>
                    </span>
                    {canChangeValidity ? (
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-xs"
                        onClick={() => {
                          setValidityDaysEditing(true);
                          setValidityDaysInput(String(validityDays));
                        }}
                      >
                        Change
                      </Button>
                    ) : (
                      <span className="text-muted-foreground">(set by the Main Administrator for all departments)</span>
                    )}
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-14">
                <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
              </div>
            ) : displayedList.length === 0 ? (
              <div className="py-14 text-center text-sm text-muted-foreground">
                {viewFilter === "needs_action"
                  ? "Nothing needs your decision right now."
                  : viewFilter === "awaiting_supervisor"
                    ? "No requests are waiting for supervisor approval."
                    : "No urgent requests found."}
              </div>
            ) : (
              <div ref={listRef}>
                {listWidth >= URGENT_TABLE_MIN_WIDTH ? (
                  <Table className="table-fixed">
                    <TableHeader>
                      <TableRow className="border-b border-border/60 hover:bg-transparent">
                        <TableHead className="w-[21%] px-3 font-medium text-muted-foreground">User</TableHead>
                        <TableHead className="px-3 font-medium text-muted-foreground">Equipment</TableHead>
                        {isAdminView && <TableHead className="w-[6.75rem] px-3 font-medium text-muted-foreground">Type</TableHead>}
                        <TableHead className="w-[6.75rem] px-3 font-medium text-muted-foreground">Requested</TableHead>
                        <TableHead className="w-[10rem] px-3 font-medium text-muted-foreground">Status · time left</TableHead>
                        <TableHead className="sticky right-0 z-[1] w-24 bg-card px-3">
                          <span className="sr-only">Action</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayedList.map((row) => {
                        const view = rowView(row);
                        return (
                          <TableRow key={row.id} className="group border-b border-border/40 transition-colors hover:bg-muted/30">
                            <TableCell className="px-3 py-2.5">
                              <RequesterIdentityButton
                                userId={row.user_id}
                                name={row.user_name}
                                email={row.user_email}
                                userNotes={row.reviewer_comment}
                                className="max-w-full [overflow-wrap:anywhere]"
                              />
                            </TableCell>
                            <TableCell className="px-3 py-2.5">{renderEquipment(row)}</TableCell>
                            {isAdminView && <TableCell className="px-3 py-2.5 text-sm">{renderType(row)}</TableCell>}
                            <TableCell className="px-3 py-2.5 text-sm text-muted-foreground">
                              <StackedDateTime value={row.requested_at} />
                            </TableCell>
                            <TableCell className="px-3 py-2.5">
                              {view.badge}
                              {view.timeLeft !== "—" ? (
                                <div className="mt-1 whitespace-nowrap font-mono text-xs tabular-nums text-muted-foreground">
                                  {view.timeLeft === "Expired" ? "Expired" : `${view.timeLeft} left`}
                                </div>
                              ) : null}
                            </TableCell>
                            <TableCell className="sticky right-0 bg-card px-3 py-2.5 text-right shadow-[-8px_0_8px_-8px_hsl(var(--border))] group-hover:bg-muted">
                              {renderOpenButton(row, view.actionable)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <ul className={cn("grid gap-3 p-3", listWidth >= 560 && "grid-cols-2")} aria-label="Urgent requests">
                    {displayedList.map((row) => {
                      const view = rowView(row);
                      return (
                        <li key={row.id} className="flex min-w-0 flex-col gap-2.5 rounded-lg border border-border/70 bg-card p-3 shadow-sm">
                          <div className="flex items-start justify-between gap-2">
                            <RequesterIdentityButton
                              userId={row.user_id}
                              name={row.user_name}
                              email={row.user_email}
                              userNotes={row.reviewer_comment}
                              className="min-w-0 [overflow-wrap:anywhere]"
                            />
                            <div className="shrink-0">{view.badge}</div>
                          </div>
                          {renderEquipment(row)}
                          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-border/50 pt-2.5 text-sm">
                            {isAdminView ? (
                              <div className="min-w-0">
                                <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Type</dt>
                                <dd>{renderType(row)}</dd>
                              </div>
                            ) : null}
                            <div className="min-w-0">
                              <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Requested</dt>
                              <dd className="text-muted-foreground">
                                <InlineDateTime value={row.requested_at} />
                              </dd>
                            </div>
                            <div className="min-w-0">
                              <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Time left</dt>
                              <dd className="font-mono tabular-nums">{view.timeLeft}</dd>
                            </div>
                          </dl>
                          {renderOpenButton(row, view.actionable, "w-full")}
                        </li>
                      );
                    })}
                  </ul>
                )}
                <div className="flex items-center justify-between gap-2 border-t border-border/40 px-4 py-2 text-xs text-muted-foreground">
                  <span>
                    Showing {displayCount}
                    {statusFilter !== "PENDING" && list.length < totalCount ? ` of ${totalCount}` : ""}
                  </span>
                  {list.length < totalCount ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={loadingMore}
                      onClick={() => void fetchList(true, list.length)}
                    >
                      {loadingMore ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                      Load more
                    </Button>
                  ) : null}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <UrgentRequestDetailDialog
          detail={detailRow}
          viewer="oic"
          onClose={() => {
            setDetailRow(null);
            setViewParamsOpen(false);
          }}
          description={
            detailRow?.status === "EXPIRED"
              ? "Expired without a decision. Any held slots were released."
              : detailRow?.status === "PENDING" && detailRow.pending_wallet_approval
                ? "Waiting for the supervisor. You can reject now; approval unlocks after the supervisor approves."
                : detailRow?.status === "PENDING" && needsSlotAllocation(detailRow)
                  ? "The user did not choose slots. Approve & allocate opens the weekly calendar so you can book any day and time; the amount and the wallet are checked before booking. Reject makes no charge."
                  : detailRow?.status === "PENDING"
                    ? "Accept confirms the held slots at the category rate + 50% urgent surcharge. Reject releases them with no charge."
                    : null
          }
          requester={
            detailRow ? (
              <RequesterIdentityButton
                userId={detailRow.user_id}
                name={detailRow.user_name}
                email={detailRow.user_email}
                userNotes={detailRow.reviewer_comment}
              />
            ) : null
          }
          notes={{
            id: "admin-notes",
            label: "Decision notes (optional)",
            value: adminNotes,
            onChange: setAdminNotes,
            placeholder: "Optional notes for this decision (shown to the user)",
            show: detailRow?.status === "PENDING",
          }}
          onOpenEvidence={detailRow ? () => void openEvidence(detailRow) : undefined}
          evidenceLoading={evidenceLoading}
          onViewParams={() => setViewParamsOpen(true)}
          footerStart={
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-red-600"
              disabled={deleteLoading}
              onClick={() => {
                if (detailRow && window.confirm("Delete this urgent request? This cannot be undone.")) {
                  handleDelete(detailRow.id);
                }
              }}
            >
              {deleteLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </Button>
          }
          actions={
            detailRow?.status === "PENDING" ? (
              <>
                <Button
                  variant="outline"
                  className="border-red-600 text-red-600 hover:bg-red-50"
                  disabled={actionLoading}
                  onClick={() => handleApproveReject(detailRow.id, "REJECTED")}
                >
                  {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />}
                  Reject
                </Button>
                {needsSlotAllocation(detailRow) && detailRow.requirement ? (
                  <Button
                    disabled={actionLoading || detailRow.pending_wallet_approval}
                    onClick={() =>
                      detailRow.requirement &&
                      setAllocateTarget({
                        id: detailRow.id,
                        user_name: detailRow.user_name,
                        user_email: detailRow.user_email,
                        equipment_name: detailRow.equipment_name,
                        requirement: detailRow.requirement,
                        samples: urgentDecisionFacts(detailRow).samples,
                      })
                    }
                    title={detailRow.pending_wallet_approval ? "Supervisor must approve first" : "Choose slots on any day in the weekly calendar and book them for the user"}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Approve &amp; allocate
                  </Button>
                ) : (
                  <Button
                    disabled={actionLoading || (detailRow.request_type === "REVIEWER_URGENT" && detailRow.pending_wallet_approval)}
                    onClick={() => handleApproveReject(detailRow.id, "APPROVED")}
                    title={
                      detailRow.request_type === "REVIEWER_URGENT" && detailRow.pending_wallet_approval
                        ? "Supervisor must approve first"
                        : "Accept and allocate held slots (urgent charge includes 50% surcharge)"
                    }
                  >
                    {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                    Accept &amp; allocate
                  </Button>
                )}
              </>
            ) : null
          }
        />

        <UrgentAllocateDialog
          open={allocateTarget != null}
          onOpenChange={(open) => {
            if (!open) setAllocateTarget(null);
          }}
          request={allocateTarget}
          onAllocated={() => {
            setAllocateTarget(null);
            setDetailRow(null);
            setAdminNotes("");
            fetchList();
          }}
        />

        <Dialog open={viewParamsOpen} onOpenChange={setViewParamsOpen}>
          <DialogContent className="max-w-xl max-h-[90dvh] overflow-y-auto">
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
                  {Object.keys(inputValues).length > 0 && (
                    <SampleRequirementsTable
                      title="User inputs"
                      fields={summary.input_fields}
                      inputValues={summary.input_fields?.length ? summary.input_values_by_key ?? inputValues : inputValues}
                      emptyText="The user did not fill in any inputs."
                    />
                  )}
                  {/* Charge Breakdown */}
                  <div>
                    <p className="text-base font-medium mb-2">Charge Breakdown:</p>
                    {chargeBreakdown.length > 0 ? (
                      <ul className="space-y-1">
                        {chargeBreakdown
                          .filter((c) => String(c.description || "").trim().toLowerCase() !== "total")
                          .map((charge, index) => (
                            <li key={index} className="text-base text-muted-foreground flex justify-between gap-4 items-start">
                              <span className="whitespace-pre-line min-w-0 shrink">{charge.description}</span>
                              <span className="shrink-0 tabular-nums">{charge.amount >= 0 ? `₹${Number(charge.amount).toFixed(2)}` : `-₹${Number(-charge.amount).toFixed(2)}`}</span>
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
                            {st.label || (st.start && st.end ? `${format(new Date(st.start), "dd MMM")} ${slotSpanLabel(st.start, st.end)}` : "—")}
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
