import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient, type EquipmentWaitlistEntry, type StaffListFiltersMeta } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, CalendarCheck, Loader2, Trash2 } from "lucide-react";
import { format } from "date-fns";
import DashboardHeader from "@/components/DashboardHeader";
import { StandaloneOnly } from "@/components/PageShell";
import WaitlistManualConfirmDialog from "@/components/WaitlistManualConfirmDialog";
import { BookingAttemptDetailsDialog } from "@/components/attemptLog/BookingAttemptDetailsDialog";
import { StaffListFilterRow, useStaffListFilters } from "@/components/StaffListFilters";
import { formatDurationMinutes } from "@/lib/jobSheet";

type WaitlistEntry = EquipmentWaitlistEntry;
type WaitlistData = {
  entries: WaitlistEntry[];
  count: number;
  active_count: number;
  cannot_fulfill_count: number;
  opted_out_count: number;
  equipment: {
    equipment_id: number;
    equipment_code: string;
    equipment_name: string;
    waitlist_queue_depth: number;
  } | null;
};

export default function EquipmentWaitlist() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userType = user?.user_type != null ? String(user.user_type).toLowerCase() : "";
  // Admin, Department Administrator (view only), OIC, Lab Operator
  const canView = ["admin", "dept_admin", "manager", "operator"].includes(userType);
  const canClear = userType === "admin" || userType === "manager" || userType === "operator";
  const canConfirmManually = userType === "admin" || userType === "manager";

  const filters = useStaffListFilters();
  const { departmentReady, reconcileEquipment } = filters;
  const { departmentId: queryDepartmentId, equipmentId: queryEquipmentId } = filters.query;
  const [equipmentOptions, setEquipmentOptions] = useState<StaffListFiltersMeta["equipment_options"]>([]);
  const [optionsLoaded, setOptionsLoaded] = useState(false);
  const [waitlist, setWaitlist] = useState<WaitlistData | null>(null);
  const [loadingWaitlist, setLoadingWaitlist] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [confirmEntry, setConfirmEntry] = useState<WaitlistEntry | null>(null);
  const [attemptRow, setAttemptRow] = useState<WaitlistEntry | null>(null);

  const singleEquipment = waitlist?.equipment ?? null;
  const showEquipmentColumn = queryEquipmentId == null;

  const handleManuallyConfirmed = (entryId: number) => {
    setWaitlist((prev) => {
      if (!prev) return prev;
      const entries = prev.entries.filter((x) => x.id !== entryId);
      return { ...prev, entries, count: entries.length };
    });
  };

  useEffect(() => {
    if (!canView) navigate("/dashboard");
  }, [canView, navigate]);

  const loadSeq = useRef(0);
  const loadWaitlist = useCallback(async () => {
    const seq = ++loadSeq.current;
    setLoadingWaitlist(true);
    try {
      const res = await apiClient.getEquipmentWaitlistAll({
        departmentId: queryDepartmentId,
        equipmentId: queryEquipmentId,
      });
      if (seq !== loadSeq.current) return;
      if (res.error || !res.data) {
        toast.error(res.error || "Failed to load waitlist");
        setWaitlist(null);
        return;
      }
      const { filters: meta, ...data } = res.data;
      setWaitlist(data);
      if (meta) {
        setEquipmentOptions(meta.equipment_options);
        setOptionsLoaded(true);
        reconcileEquipment(meta.equipment_options);
      }
    } catch {
      if (seq !== loadSeq.current) return;
      toast.error("Failed to load waitlist");
      setWaitlist(null);
    } finally {
      if (seq === loadSeq.current) setLoadingWaitlist(false);
    }
  }, [queryDepartmentId, queryEquipmentId, reconcileEquipment]);

  useEffect(() => {
    if (!canView || !departmentReady) return;
    void loadWaitlist();
  }, [canView, departmentReady, loadWaitlist]);

  const handleClearQueue = async () => {
    if (!singleEquipment) return;
    setClearing(true);
    try {
      const res = await apiClient.clearEquipmentWaitlist(singleEquipment.equipment_id);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(res.data?.message ?? "Waitlist cleared.");
        setWaitlist((prev) =>
          prev ? { ...prev, entries: [], count: 0, active_count: 0, cannot_fulfill_count: 0, opted_out_count: 0 } : null
        );
      }
    } finally {
      setClearing(false);
    }
  };

  const attemptRequestText = (e: WaitlistEntry) =>
    [
      e.booking_attempt_number_of_samples != null
        ? `${e.booking_attempt_number_of_samples} sample${e.booking_attempt_number_of_samples === 1 ? "" : "s"}`
        : null,
      e.booking_attempt_slots_requested != null
        ? `${e.booking_attempt_slots_requested} slot${e.booking_attempt_slots_requested === 1 ? "" : "s"}`
        : null,
      e.booking_attempt_duration_minutes != null ? formatDurationMinutes(e.booking_attempt_duration_minutes) : null,
    ]
      .filter(Boolean)
      .join(" • ");

  const attemptInputsText = (e: WaitlistEntry) => {
    const items = e.booking_attempt_inputs ?? [];
    const shown = items.slice(0, 6).map((i) => `${i.label}: ${i.text}`);
    return shown.join(" • ") + (items.length > 6 ? ` • +${items.length - 6} more` : "");
  };

  if (!canView) return null;

  const clearDisabledReason = !singleEquipment
    ? "Select one equipment to clear its queue."
    : waitlist?.count === 0
      ? "The queue is already empty."
      : undefined;

  return (
    <div className="page-shell">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-5 max-w-6xl">
        <StandaloneOnly>
          <div className="mb-6 rounded-2xl bg-gradient-to-r from-primary via-primary to-accent p-6 text-white shadow-xl">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard")}
              className="mb-3 -ml-2 text-white/90 hover:text-white hover:bg-white/20"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Dashboard
            </Button>
            <h1 className="text-2xl font-semibold tracking-tight">Equipment waitlist</h1>
            <p className="mt-2 text-sm text-white/85">
              View and clear waitlists. Users join the waitlist when their booking fails (if the equipment has a waitlist) and are notified when slots open.
            </p>
          </div>
        </StandaloneOnly>
        <Card className="rounded-xl border-border/70 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Queue</CardTitle>
            <CardDescription>
              {filters.showDepartment
                ? "Choose a department and equipment. Select one equipment to see its queue depth or clear its queue."
                : "Waitlists of the equipment you are responsible for. Select one equipment to see its queue depth or clear its queue."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <StaffListFilterRow filters={filters} equipmentOptions={equipmentOptions} />

            {loadingWaitlist && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading waitlist…
              </div>
            )}

            {!loadingWaitlist && waitlist && (
              <>
                <div className="flex flex-wrap items-center gap-4">
                  {singleEquipment ? (
                    <p className="text-sm text-muted-foreground">
                      Queue depth: <strong>{singleEquipment.waitlist_queue_depth}</strong>
                      {singleEquipment.waitlist_queue_depth === 0 && " (waitlist disabled)"}
                    </p>
                  ) : null}
                  <p className="text-sm text-muted-foreground">
                    Active: <strong>{waitlist.active_count}</strong>
                    {" • "}
                    Cannot fulfill: <strong>{waitlist.cannot_fulfill_count}</strong>
                    {" • "}
                    Opted out: <strong>{waitlist.opted_out_count}</strong>
                  </p>
                  {canClear && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleClearQueue}
                      disabled={!singleEquipment || waitlist.count === 0 || clearing}
                      title={clearDisabledReason}
                    >
                      {clearing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                      Clear queue
                    </Button>
                  )}
                  {canClear && !singleEquipment && waitlist.count > 0 ? (
                    <p className="text-xs text-muted-foreground">Select one equipment to clear its queue.</p>
                  ) : null}
                </div>
                {waitlist.entries.length === 0 ? (
                  <p className="text-muted-foreground">No one on the waitlist.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Position</TableHead>
                        {showEquipmentColumn && <TableHead>Equipment</TableHead>}
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Sample</TableHead>
                        <TableHead>Last Attempt</TableHead>
                        {canConfirmManually && <TableHead className="text-right">Action</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {waitlist.entries.map((e) => {
                        const st = (e.status || "ACTIVE").toUpperCase();
                        const statusLabel =
                          st === "OPT_OUT"
                            ? "Opted out"
                            : st === "CANNOT_FULFILL"
                              ? "Cannot fulfill"
                              : "Waiting (ACTIVE)";
                        return (
                        <TableRow key={e.id}>
                          <TableCell className="font-medium">
                            {e.waitlist_code || (e.position != null ? `WL${e.position}` : "—")}
                          </TableCell>
                          {showEquipmentColumn && (
                            <TableCell className="text-sm">{e.equipment_name || e.equipment_code || "—"}</TableCell>
                          )}
                          <TableCell>{e.user_name || "—"}</TableCell>
                          <TableCell>{e.user_email}</TableCell>
                          <TableCell>
                            {e.created_at ? format(new Date(e.created_at), "PPp") : "—"}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <div className="text-sm font-medium">{statusLabel}</div>
                              {st === "CANNOT_FULFILL" && (
                                <>
                                  <div className="text-xs text-muted-foreground">
                                    {e.cannot_fulfill_remark || "—"}
                                  </div>
                                  {e.marked_cannot_fulfill_at ? (
                                    <div className="text-xs text-muted-foreground">
                                      Marked: {format(new Date(e.marked_cannot_fulfill_at), "PPp")}
                                    </div>
                                  ) : null}
                                </>
                              )}
                              {st === "OPT_OUT" && e.opted_out_at ? (
                                <div className="text-xs text-muted-foreground">
                                  Opted out: {format(new Date(e.opted_out_at), "PPp")}
                                </div>
                              ) : null}
                              {st === "ACTIVE" ? (
                                <div className="text-xs text-amber-700">Awaiting confirmation</div>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell>
                            {e.sample_submitted ? (
                              <div className="flex flex-col gap-0.5">
                                <span className="text-sm font-medium text-emerald-700">
                                  Sample Submitted
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  Waiting for Confirmation
                                </span>
                                {e.sample_submitted_at ? (
                                  <span className="text-xs text-muted-foreground">
                                    {format(new Date(e.sample_submitted_at), "PPp")}
                                  </span>
                                ) : null}
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">Not submitted</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <div className="text-sm font-medium">
                                {e.booking_attempt_requested_at
                                  ? format(new Date(e.booking_attempt_requested_at), "PPp")
                                  : "—"}
                              </div>
                              {(() => {
                                const reason =
                                  e.booking_attempt_failure_summary || e.booking_attempt_failure_reason || "";
                                if (!reason) return <div className="text-xs text-muted-foreground">—</div>;
                                if (e.booking_attempt_log_id == null) {
                                  return <div className="text-xs text-muted-foreground">{reason}</div>;
                                }
                                return (
                                  <button
                                    type="button"
                                    className="text-left text-xs text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                                    title="View attempt details"
                                    onClick={() => setAttemptRow(e)}
                                  >
                                    {reason}
                                  </button>
                                );
                              })()}
                              <div className="text-xs text-muted-foreground">{attemptRequestText(e) || "—"}</div>
                              {attemptInputsText(e) && (
                                <div className="text-xs text-muted-foreground" title={attemptInputsText(e)}>
                                  {attemptInputsText(e)}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          {canConfirmManually && (
                            <TableCell className="text-right">
                              {st !== "OPT_OUT" ? (
                                <Button size="sm" variant="outline" onClick={() => setConfirmEntry(e)}>
                                  <CalendarCheck className="mr-1.5 h-4 w-4" />
                                  Confirm manually
                                </Button>
                              ) : null}
                            </TableCell>
                          )}
                        </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </>
            )}

            {!loadingWaitlist && optionsLoaded && equipmentOptions.length === 0 && (
              <p className="text-muted-foreground">No equipment found.</p>
            )}
          </CardContent>
        </Card>
        {confirmEntry != null && (
          <WaitlistManualConfirmDialog
            open
            onOpenChange={(o) => {
              if (!o) setConfirmEntry(null);
            }}
            equipmentId={confirmEntry.equipment_id}
            entry={confirmEntry}
            onConfirmed={handleManuallyConfirmed}
          />
        )}
        <BookingAttemptDetailsDialog
          row={
            attemptRow && attemptRow.booking_attempt_log_id != null
              ? {
                  id: attemptRow.booking_attempt_log_id,
                  requested_at: attemptRow.booking_attempt_requested_at ?? null,
                  outcome: "FAILED",
                  equipment_name: attemptRow.equipment_name ?? "",
                  equipment_code: attemptRow.equipment_code ?? "",
                  user_name: attemptRow.user_name,
                  user_email: attemptRow.user_email,
                  failure_reason: attemptRow.booking_attempt_failure_reason ?? "",
                  failure_title: attemptRow.booking_attempt_failure_title,
                  failure_summary: attemptRow.booking_attempt_failure_summary,
                }
              : null
          }
          onOpenChange={(o) => {
            if (!o) setAttemptRow(null);
          }}
        />
      </main>
    </div>
  );
}
