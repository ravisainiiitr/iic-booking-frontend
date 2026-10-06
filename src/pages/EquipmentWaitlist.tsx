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
import { ClampedText, InlineDateTime, StackedDateTime, StatusChip, type StatusChipTone } from "@/components/StaffListCells";
import { useElementWidth } from "@/hooks/use-element-width";
import { formatDurationMinutes } from "@/lib/jobSheet";
import { cn } from "@/lib/utils";

type WaitlistEntry = EquipmentWaitlistEntry;
type WaitlistStatus = "ACTIVE" | "CANNOT_FULFILL" | "OPT_OUT";

/** Below this list width the entries are shown as stacked cards instead of a table. */
const WAITLIST_TABLE_MIN_WIDTH = 700;

const STATUS_META: Record<WaitlistStatus, { label: string; tone: StatusChipTone }> = {
  ACTIVE: { label: "Waiting", tone: "amber" },
  CANNOT_FULFILL: { label: "Cannot fulfill", tone: "red" },
  OPT_OUT: { label: "Opted out", tone: "gray" },
};

const statusOf = (e: WaitlistEntry): WaitlistStatus => {
  const st = (e.status || "ACTIVE").toUpperCase();
  return st === "CANNOT_FULFILL" || st === "OPT_OUT" ? st : "ACTIVE";
};

const positionLabel = (e: WaitlistEntry) => e.waitlist_code || (e.position != null ? `WL${e.position}` : "—");
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
  // Admin, Department Administrator (own department), OIC, Lab Operator
  const canView = ["admin", "dept_admin", "manager", "operator"].includes(userType);
  const canClear = canView;
  const canConfirmManually = userType === "admin" || userType === "manager" || userType === "dept_admin";

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
  const [listRef, listWidth] = useElementWidth();
  const cardColumns = listWidth >= 560 ? 2 : 1;
  const splitCardDetails = listWidth / cardColumns >= 420;

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

  const renderUser = (e: WaitlistEntry) => (
    <div className="min-w-0 leading-tight">
      <div className="truncate font-medium" title={e.user_name || undefined}>
        {e.user_name || "—"}
      </div>
      <div className="truncate text-xs text-muted-foreground" title={e.user_email}>
        {e.user_email}
      </div>
    </div>
  );

  const renderStatus = (e: WaitlistEntry) => {
    const st = statusOf(e);
    const reason =
      st === "CANNOT_FULFILL" ? e.cannot_fulfill_remark || "" : st === "ACTIVE" ? "Awaiting confirmation" : "";
    const markedAt = st === "CANNOT_FULFILL" ? e.marked_cannot_fulfill_at : st === "OPT_OUT" ? e.opted_out_at : null;
    return (
      <div className="min-w-0 space-y-1 text-xs">
        <div className="flex flex-wrap items-center gap-1">
          <StatusChip tone={STATUS_META[st].tone}>{STATUS_META[st].label}</StatusChip>
          {e.sample_submitted ? (
            <StatusChip
              tone="green"
              title={
                e.sample_submitted_at
                  ? `Sample submitted ${format(new Date(e.sample_submitted_at), "PPp")}, waiting for confirmation`
                  : "Sample submitted, waiting for confirmation"
              }
            >
              Sample in
            </StatusChip>
          ) : null}
        </div>
        {reason ? <ClampedText text={reason} className="text-muted-foreground" /> : null}
        {markedAt ? (
          <div className="text-[11px] text-muted-foreground">
            {st === "OPT_OUT" ? "Opted out " : "Marked "}
            <InlineDateTime value={markedAt} />
          </div>
        ) : null}
      </div>
    );
  };

  const renderLastAttempt = (e: WaitlistEntry) => {
    const reason = e.booking_attempt_failure_summary || e.booking_attempt_failure_reason || "";
    const request = attemptRequestText(e);
    const inputs = attemptInputsText(e);
    const detailsLink =
      e.booking_attempt_log_id != null ? (
        <button
          type="button"
          className="rounded-sm text-xs font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => setAttemptRow(e)}
        >
          Details
        </button>
      ) : null;
    return (
      <div className="min-w-0 space-y-0.5 text-xs">
        <InlineDateTime value={e.booking_attempt_requested_at} className="font-medium text-foreground" />
        {reason ? (
          <ClampedText
            text={reason}
            className="text-muted-foreground"
            details={inputs ? <span className="text-muted-foreground">{inputs}</span> : undefined}
            actions={detailsLink}
          />
        ) : (
          <div className="text-muted-foreground">—</div>
        )}
        {request ? (
          <div className="truncate text-muted-foreground" title={request}>
            {request}
          </div>
        ) : null}
      </div>
    );
  };

  const renderConfirm = (e: WaitlistEntry, { compact = false, className }: { compact?: boolean; className?: string } = {}) =>
    canConfirmManually && statusOf(e) !== "OPT_OUT" ? (
      <Button
        size="sm"
        variant="outline"
        className={cn("h-8 whitespace-nowrap px-2.5 text-xs", className)}
        aria-label={compact ? `Confirm manually for ${e.user_name || e.user_email}` : undefined}
        title={compact ? "Confirm manually: pick a slot and book it for this user" : undefined}
        onClick={() => setConfirmEntry(e)}
      >
        <CalendarCheck className="mr-1.5 h-3.5 w-3.5" />
        {compact ? "Confirm" : "Confirm manually"}
      </Button>
    ) : null;

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
          <div className="mb-6 rounded-2xl bg-gradient-to-r from-brand via-brand to-brand-accent p-6 text-white shadow-xl">
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
        {/* Bottom margin keeps the last row clear of the floating Booking Assistant button. */}
        <Card className="mb-20 rounded-xl border-border/70 shadow-sm">
          <CardHeader className="px-4 pb-3 sm:px-5">
            <CardTitle className="text-base">Queue</CardTitle>
            <CardDescription>
              {filters.showDepartment
                ? "Choose a department and equipment. Select one equipment to see its queue depth or clear its queue."
                : "Waitlists of the equipment you are responsible for. Select one equipment to see its queue depth or clear its queue."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 px-4 sm:px-5">
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
                  <div ref={listRef}>
                    {listWidth >= WAITLIST_TABLE_MIN_WIDTH ? (
                      <Table className="table-fixed">
                        <TableHeader>
                          <TableRow>
                            {showEquipmentColumn ? (
                              <TableHead className="w-[17%] px-2">Equipment</TableHead>
                            ) : (
                              <TableHead className="w-16 px-2">Pos.</TableHead>
                            )}
                            <TableHead className="w-[21%] px-2">User</TableHead>
                            <TableHead className="w-24 px-2">Joined</TableHead>
                            <TableHead className="w-[20%] px-2">Status</TableHead>
                            <TableHead className="px-2">Last attempt</TableHead>
                            {canConfirmManually && (
                              <TableHead className="sticky right-0 z-[1] w-[6.75rem] bg-card px-2 text-right">
                                <span className="sr-only">Action</span>
                              </TableHead>
                            )}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {waitlist.entries.map((e) => (
                            <TableRow key={e.id} className="group align-top">
                              {showEquipmentColumn ? (
                                <TableCell className="px-2 py-3">
                                  <div className="line-clamp-2 text-sm leading-snug" title={e.equipment_name || e.equipment_code}>
                                    {e.equipment_name || e.equipment_code || "—"}
                                  </div>
                                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                                    Position <span className="font-mono font-medium text-foreground">{positionLabel(e)}</span>
                                  </div>
                                </TableCell>
                              ) : (
                                <TableCell className="px-2 py-3 font-mono text-xs font-medium">{positionLabel(e)}</TableCell>
                              )}
                              <TableCell className="px-2 py-3">{renderUser(e)}</TableCell>
                              <TableCell className="px-2 py-3 text-sm">
                                <StackedDateTime value={e.created_at} />
                              </TableCell>
                              <TableCell className="px-2 py-3">{renderStatus(e)}</TableCell>
                              <TableCell className="px-2 py-3">{renderLastAttempt(e)}</TableCell>
                              {canConfirmManually && (
                                <TableCell className="sticky right-0 bg-card px-2 py-3 text-right shadow-[-8px_0_8px_-8px_hsl(var(--border))] group-hover:bg-muted">
                                  {renderConfirm(e, { compact: true })}
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <ul className={cn("grid gap-3", cardColumns === 2 && "grid-cols-2")} aria-label="Waitlist entries">
                        {waitlist.entries.map((e) => (
                          <li key={e.id} className="flex min-w-0 flex-col gap-2.5 rounded-lg border border-border/70 bg-card p-3 shadow-sm">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                {showEquipmentColumn ? (
                                  <div className="line-clamp-2 text-sm font-semibold leading-snug">
                                    {e.equipment_name || e.equipment_code || "—"}
                                  </div>
                                ) : null}
                                <div className="text-xs text-muted-foreground">
                                  Position <span className="font-mono font-medium text-foreground">{positionLabel(e)}</span>
                                  {" · Joined "}
                                  <InlineDateTime value={e.created_at} />
                                </div>
                              </div>
                            </div>
                            {renderUser(e)}
                            <div className={cn("grid gap-2.5 border-t border-border/50 pt-2.5", splitCardDetails && "grid-cols-2")}>
                              <div className="min-w-0">
                                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Status</div>
                                {renderStatus(e)}
                              </div>
                              <div className="min-w-0">
                                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Last attempt</div>
                                {renderLastAttempt(e)}
                              </div>
                            </div>
                            {renderConfirm(e, { className: "w-full justify-center" })}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
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
