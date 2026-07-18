import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import DashboardHeader from "@/components/DashboardHeader";
import { apiClient, type TAAssignment, type TADutyLog } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { addDays, addWeeks, format, startOfWeek, subWeeks } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Same helpers as BookEquipment weekly grid. */
function getContrastTextColor(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#1f2937" : "#ffffff";
}

function parseTimeToMinutes(timeStr: string): number {
  const parts = timeStr.trim().split(":");
  const h = parseInt(parts[0] || "0", 10);
  const m = parseInt(parts[1] || "0", 10);
  return h * 60 + m;
}

function getTimeSlotsFromEquipmentWindow(
  slotStartTime: string | null | undefined,
  slotEndTime: string | null | undefined,
  slotDurationMinutes: number
): string[] {
  if (!slotStartTime || !slotEndTime || slotDurationMinutes <= 0) return [];
  const startM = parseTimeToMinutes(slotStartTime);
  const endM = parseTimeToMinutes(slotEndTime);
  if (endM <= startM) return [];
  const slots: string[] = [];
  for (let m = startM; m < endM; m += slotDurationMinutes) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    slots.push(`${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`);
  }
  return slots;
}

function parseIsoDateAndTime(isoStr: string): { dateStr: string; timeStr: string } {
  if (!isoStr || typeof isoStr !== "string") return { dateStr: "", timeStr: "" };
  const i = isoStr.indexOf("T");
  const dateStr = i >= 0 ? isoStr.substring(0, i) : isoStr.substring(0, 10);
  const timePart = i >= 0 ? isoStr.substring(i + 1) : "";
  const timeStr = timePart.length >= 5 ? timePart.substring(0, 5) : "";
  return { dateStr, timeStr };
}

type WeekSlot = {
  id: number;
  date: string;
  start_datetime: string;
  end_datetime: string;
  status: string;
  status_display?: string;
  booking_id?: string | null;
  real_booking_id?: number | null;
  blocked_label?: string | null;
};

type WeekSlotBundle = {
  slots: WeekSlot[];
  slot_master_times?: string[];
  slot_start_time?: string | null;
  slot_end_time?: string | null;
  slot_duration_minutes?: number;
  calendar_colors?: {
    slot_colors: Record<string, string>;
    holiday_default?: string;
    saturday_color?: string;
    sunday_color?: string;
  };
  weekly_holidays?: Record<string, string | { label: string; color?: string }>;
};

function buildWeeklyTimeRows(ws: WeekSlotBundle | null): string[] {
  if (!ws) return [];
  if (ws.slot_master_times?.length) {
    return [...ws.slot_master_times].map((t) => t.substring(0, 5)).sort();
  }
  const unique = new Set<string>();
  for (const s of ws.slots) {
    const { timeStr } = parseIsoDateAndTime(s.start_datetime);
    if (timeStr) unique.add(timeStr);
  }
  const arr = Array.from(unique).sort();
  if (arr.length) return arr;
  return getTimeSlotsFromEquipmentWindow(ws.slot_start_time, ws.slot_end_time, ws.slot_duration_minutes || 60);
}

function findSlotForCell(slots: WeekSlot[], day: Date, timeKey: string): WeekSlot | undefined {
  const dateStr = format(day, "yyyy-MM-dd");
  return slots.find((s) => {
    const d = typeof s.date === "string" ? s.date.slice(0, 10) : "";
    const { timeStr } = parseIsoDateAndTime(s.start_datetime);
    return d === dateStr && timeStr === timeKey;
  });
}

const DEFAULT_SLOT_COLORS: Record<string, string> = {
  AVAILABLE: "#22c55e",
  BOOKED: "#ef4444",
  COMPLETED: "#059669",
  BLOCKED: "#64748b",
  UNDER_MAINTENANCE: "#f97316",
  OPERATOR_ABSENT: "#eab308",
  BOOKING_NOT_UTILIZED: "#a855f7",
  HOLD: "#f59e0b",
  RESERVED_FOR_EXTERNAL: "#94a3b8",
  NOT_AVAILABLE: "#e2e8f0",
};

/** TA duty overlay (not from equipment calendar_colors). */
const TA_ALLOCATED_SLOT_BG = "#0d9488";
const TA_ACCEPTED_SLOT_BG = "#166534";

export default function TAAssignments() {
  const { user } = useAuth();
  const userType = String(user?.user_type ?? "").toLowerCase();
  const canManage = userType === "admin" || userType === "manager" || userType === "operator";
  /** Same as backend allocate/cancel: admin or OIC (manager) only. */
  const canAllocateTa = userType === "admin" || userType === "manager";
  const isTaStudent = userType === "student" || userType === "individual_student";

  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<TAAssignment[]>([]);
  const [dutyLogs, setDutyLogs] = useState<TADutyLog[]>([]);
  const [approvedNominations, setApprovedNominations] = useState<
    Array<{
      id: number;
      equipment_id: number;
      equipment_code: string;
      equipment_name: string;
      student_name: string;
      student_email: string;
      academic_year_name?: string;
    }>
  >([]);

  /** Equipment for which allocation is performed. OICs see only OIC-managed equipment from the API; admins see all. */
  const [allocationEquipmentId, setAllocationEquipmentId] = useState("");
  const [allocationEquipmentList, setAllocationEquipmentList] = useState<Array<{ equipment_id: number; code: string; name: string }>>([]);
  const [equipmentListLoading, setEquipmentListLoading] = useState(false);

  const [nominationId, setNominationId] = useState("");
  /** Numeric booking PKs from slot `real_booking_id` (multi-select for Admin/OIC). */
  const [selectedRealBookingIds, setSelectedRealBookingIds] = useState<string[]>([]);
  const [nominationSearch, setNominationSearch] = useState("");
  const [expectedHours, setExpectedHours] = useState("");
  const [allocationNotes, setAllocationNotes] = useState("");
  const [allocating, setAllocating] = useState(false);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [weekSlotState, setWeekSlotState] = useState<WeekSlotBundle | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const [submitByAssignment, setSubmitByAssignment] = useState<
    Record<number, { duty_date: string; hours_spent: string; samples_processed: string; remarks: string }>
  >({});
  const [actingAssignmentId, setActingAssignmentId] = useState<number | null>(null);
  const [cancellingAssignmentId, setCancellingAssignmentId] = useState<number | null>(null);
  const [actingDutyLogId, setActingDutyLogId] = useState<number | null>(null);
  /** Admin/OIC: duty log pending review before verify/reject. */
  const [dutyLogReview, setDutyLogReview] = useState<TADutyLog | null>(null);
  const [dutyLogReviewForm, setDutyLogReviewForm] = useState({
    duty_date: "",
    hours_spent: "",
    samples_processed: "",
    remarks: "",
  });
  const [dutyLogRejectNote, setDutyLogRejectNote] = useState("");

  const dutyLogByAssignment = useMemo(() => {
    const map: Record<number, TADutyLog> = {};
    for (const d of dutyLogs) {
      if (d.assignment) map[d.assignment] = d;
    }
    return map;
  }, [dutyLogs]);

  const selectedNomination = useMemo(
    () => approvedNominations.find((n) => String(n.id) === nominationId) || null,
    [approvedNominations, nominationId]
  );

  /** Active TA duty per booking PK for the selected equipment (Admin/OIC allocation grid). */
  const bookingIdToTaAssignment = useMemo(() => {
    const eqId = selectedNomination?.equipment_id;
    if (!eqId || !canAllocateTa) return new Map<number, { status: string; id: number }>();
    const m = new Map<number, { status: string; id: number }>();
    for (const a of assignments) {
      if (a.equipment !== eqId) continue;
      if (a.status !== "ALLOCATED" && a.status !== "ACCEPTED") continue;
      const bid = typeof a.booking === "number" ? a.booking : Number(a.booking);
      if (Number.isNaN(bid)) continue;
      if (!m.has(bid)) m.set(bid, { status: a.status, id: a.id });
    }
    return m;
  }, [assignments, selectedNomination?.equipment_id, canAllocateTa]);

  const weekTimeRows = useMemo(() => buildWeeklyTimeRows(weekSlotState), [weekSlotState]);

  const selectedSlotsForAllocate = useMemo(() => {
    if (!weekSlotState?.slots?.length || selectedRealBookingIds.length === 0) return [];
    const set = new Set(selectedRealBookingIds.map((id) => Number(id)).filter((n) => !Number.isNaN(n)));
    return weekSlotState.slots.filter((s) => s.real_booking_id != null && set.has(Number(s.real_booking_id)));
  }, [weekSlotState, selectedRealBookingIds]);

  const nominationOptionsFiltered = useMemo(() => {
    const q = nominationSearch.trim().toLowerCase();
    if (!q) return approvedNominations;
    return approvedNominations.filter((n) =>
      `${n.student_name} ${n.student_email} ${n.academic_year_name || ""}`
        .toLowerCase()
        .includes(q)
    );
  }, [approvedNominations, nominationSearch]);

  const fetchApprovedNominations = useCallback(async () => {
    if (!canManage || !allocationEquipmentId) {
      setApprovedNominations([]);
      return;
    }
    const nRes = await apiClient.listEquipmentNominationsAdmin({
      status: "APPROVED",
      equipment_id: Number(allocationEquipmentId),
    });
    if (nRes.error) {
      toast.error(nRes.error);
      setApprovedNominations([]);
      return;
    }
    setApprovedNominations(
      (nRes.data?.nominations || []).map((n: any) => ({
        id: n.id,
        equipment_id: n.equipment_id,
        equipment_code: n.equipment_code,
        equipment_name: n.equipment_name,
        student_name: n.student_name,
        student_email: n.student_email,
        academic_year_name: n.academic_year_name || n.semester_name || "",
      }))
    );
  }, [canManage, allocationEquipmentId]);

  const refresh = useCallback(async () => {
    setLoading(true);
    const aRes = await apiClient.listTAAssignments();
    const dRes = await apiClient.listTADutyLogs();
    if (aRes.error) toast.error(aRes.error);
    if (dRes.error) toast.error(dRes.error);
    setAssignments((aRes.data?.assignments as TAAssignment[]) || []);
    setDutyLogs((dRes.data?.duty_logs as TADutyLog[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!canManage) return;
    let cancelled = false;
    const loadEquipment = async () => {
      setEquipmentListLoading(true);
      const res = await apiClient.getEquipments(undefined, "ACTIVE");
      setEquipmentListLoading(false);
      if (cancelled) return;
      if (res.error) {
        toast.error(res.error);
        setAllocationEquipmentList([]);
        return;
      }
      const list = (res.data?.equipments || [])
        .map((e) => ({ equipment_id: e.equipment_id, code: e.code, name: e.name }))
        .sort((a, b) => a.code.localeCompare(b.code));
      setAllocationEquipmentList(list);
    };
    loadEquipment();
    return () => {
      cancelled = true;
    };
  }, [canManage]);

  useEffect(() => {
    void fetchApprovedNominations();
  }, [fetchApprovedNominations]);

  useEffect(() => {
    if (!canAllocateTa) return;
    setSelectedRealBookingIds((prev) =>
      prev.filter((idStr) => {
        const pk = Number(idStr);
        if (Number.isNaN(pk)) return false;
        return !bookingIdToTaAssignment.has(pk);
      })
    );
  }, [bookingIdToTaAssignment, canAllocateTa]);

  useEffect(() => {
    if (!canManage) return;
    if (!selectedNomination?.equipment_id) {
      setWeekSlotState(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setSlotsLoading(true);
      const start = currentWeekStart;
      const end = addDays(currentWeekStart, 6);
      const fmt = (d: Date) => format(d, "yyyy-MM-dd");
      const eqId = selectedNomination.equipment_id;
      const res = await apiClient.getEquipmentSlots(eqId, fmt(start), fmt(end));
      if (cancelled) return;
      if (res.error) {
        toast.error(res.error);
        setWeekSlotState(null);
        setSlotsLoading(false);
        return;
      }
      const data = res.data;
      if (!data) {
        setWeekSlotState(null);
        setSlotsLoading(false);
        return;
      }
      setWeekSlotState({
        slots: (data.slots || []) as WeekSlot[],
        slot_master_times: data.slot_master_times,
        slot_start_time: data.slot_start_time,
        slot_end_time: data.slot_end_time,
        slot_duration_minutes: data.slot_duration_minutes,
        calendar_colors: data.calendar_colors,
        weekly_holidays: data.holidays as WeekSlotBundle["weekly_holidays"],
      });
      if (canAllocateTa && !cancelled) {
        const ar = await apiClient.listTAAssignments({ equipment_id: eqId });
        if (!cancelled && !ar.error && ar.data?.assignments) {
          setAssignments((prev) => {
            const rest = prev.filter((x) => x.equipment !== eqId);
            return [...rest, ...ar.data!.assignments];
          });
        }
      }
      setSlotsLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [canManage, canAllocateTa, currentWeekStart, selectedNomination?.equipment_id]);

  const allocate = async () => {
    if (!nominationId || selectedRealBookingIds.length === 0) {
      toast.error("Please select an approved nomination and at least one booked slot.");
      return;
    }
    const ids = [...new Set(selectedRealBookingIds)];
    const invalid = ids.filter((id) => Number.isNaN(Number(id)));
    if (invalid.length) {
      toast.error("Invalid booking selection.");
      return;
    }
    setAllocating(true);
    let ok = 0;
    const failures: string[] = [];
    for (const idStr of ids) {
      const pk = Number(idStr);
      const res = await apiClient.allocateTAAssignment({
        nomination_id: Number(nominationId),
        booking_id: pk,
        expected_hours: expectedHours || undefined,
        allocation_notes: allocationNotes || undefined,
      });
      if (res.error) failures.push(`${idStr}: ${res.error}`);
      else ok++;
    }
    setAllocating(false);
    if (ok > 0) {
      toast.success(
        ok === 1
          ? "TA duty allocated and email sent."
          : `${ok} TA duty slot(s) allocated — email sent for each.`
      );
    }
    if (failures.length) {
      toast.error(failures.slice(0, 3).join(" · ") + (failures.length > 3 ? ` (+${failures.length - 3} more)` : ""));
    }
    setSelectedRealBookingIds([]);
    if (ok === ids.length && failures.length === 0) {
      setExpectedHours("");
      setAllocationNotes("");
    }
    await refresh();
    await fetchApprovedNominations();
  };

  const respond = async (assignmentId: number, action: "ACCEPT" | "DECLINE") => {
    setActingAssignmentId(assignmentId);
    const res = await apiClient.respondTAAssignment(assignmentId, { action });
    setActingAssignmentId(null);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(action === "ACCEPT" ? "Assignment accepted." : "Assignment declined.");
    await refresh();
  };

  const cancelAssignment = async (assignmentId: number) => {
    setCancellingAssignmentId(assignmentId);
    const res = await apiClient.cancelTAAssignment(assignmentId);
    setCancellingAssignmentId(null);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("TA duty assignment cancelled.");
    await refresh();
    await fetchApprovedNominations();
  };

  const submitDutyLog = async (assignmentId: number) => {
    const form = submitByAssignment[assignmentId];
    if (!form?.duty_date) {
      toast.error("Duty date is required.");
      return;
    }
    const res = await apiClient.createTADutyLog({
      assignment_id: assignmentId,
      duty_date: form.duty_date,
      hours_spent: form.hours_spent || "0",
      samples_processed: Number(form.samples_processed || "0"),
      remarks: form.remarks || undefined,
    });
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Duty log submitted.");
    await refresh();
  };

  /** Operator (non–Admin/OIC): quick verify/reject without editing. */
  const verifyDutyLog = async (dutyLogId: number, verify: boolean) => {
    setActingDutyLogId(dutyLogId);
    const res = verify ? await apiClient.verifyTADutyLog(dutyLogId) : await apiClient.rejectTADutyLog(dutyLogId);
    setActingDutyLogId(null);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(verify ? "Duty log verified and reward credited." : "Duty log rejected.");
    await refresh();
  };

  const openDutyLogReview = (dl: TADutyLog) => {
    setDutyLogReview(dl);
    setDutyLogReviewForm({
      duty_date: dl.duty_date?.slice(0, 10) || "",
      hours_spent: String(dl.hours_spent ?? ""),
      samples_processed: String(dl.samples_processed ?? ""),
      remarks: dl.remarks ?? "",
    });
    setDutyLogRejectNote("");
  };

  const submitDutyLogReviewVerify = async () => {
    if (!dutyLogReview) return;
    setActingDutyLogId(dutyLogReview.id);
    const payload: {
      duty_date?: string;
      hours_spent?: string | number;
      samples_processed?: number;
      remarks?: string;
    } = {};
    if (dutyLogReviewForm.duty_date) payload.duty_date = dutyLogReviewForm.duty_date;
    if (dutyLogReviewForm.hours_spent.trim() !== "") payload.hours_spent = dutyLogReviewForm.hours_spent;
    if (dutyLogReviewForm.samples_processed.trim() !== "") {
      payload.samples_processed = Number(dutyLogReviewForm.samples_processed);
    }
    payload.remarks = dutyLogReviewForm.remarks;
    const res = await apiClient.verifyTADutyLog(dutyLogReview.id, payload);
    setActingDutyLogId(null);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Duty log verified and reward credited.");
    setDutyLogReview(null);
    await refresh();
  };

  const submitDutyLogReviewReject = async () => {
    if (!dutyLogReview) return;
    setActingDutyLogId(dutyLogReview.id);
    const res = await apiClient.rejectTADutyLog(dutyLogReview.id, {
      remarks: dutyLogRejectNote.trim() || undefined,
    });
    setActingDutyLogId(null);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Duty log rejected.");
    setDutyLogReview(null);
    await refresh();
  };

  return (
    <div className="page-shell">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-8 space-y-6">
        <div className="rounded-2xl bg-gradient-to-r from-teal-800 via-teal-700 to-cyan-700 p-6 text-white shadow-xl">
          <h1 className="text-2xl font-semibold tracking-tight">TA duty assignments</h1>
          <p className="mt-2 text-sm text-white/85">
            Allocate duty, respond as TA, and submit/verify duty logs linked to reward points.
          </p>
        </div>

        {canManage && (
          <Card className="overflow-hidden border-2 border-primary/20 shadow-xl bg-gradient-to-b from-card to-card/95">
            <CardHeader>
              <CardTitle>Allocate TA Duty</CardTitle>
              <CardDescription>
                Choose equipment, then an approved TA nomination. Admins and OICs can select multiple booked slots (click again to deselect), then allocate in one step. OICs only see equipment they manage; admins see all active equipment.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label>Equipment</Label>
                <Select
                  value={allocationEquipmentId || "__none__"}
                  onValueChange={(v) => {
                    const id = v === "__none__" ? "" : v;
                    setAllocationEquipmentId(id);
                    setNominationId("");
                    setNominationSearch("");
                    setSelectedRealBookingIds([]);
                  }}
                  disabled={equipmentListLoading}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder={equipmentListLoading ? "Loading equipment…" : "Select equipment"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Select equipment…</SelectItem>
                    {allocationEquipmentList.map((e) => (
                      <SelectItem key={e.equipment_id} value={String(e.equipment_id)}>
                        {e.code} — {e.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!equipmentListLoading && canManage && allocationEquipmentList.length === 0 && (
                  <p className="text-sm text-muted-foreground mt-2">No active equipment available for your account.</p>
                )}
              </div>

              <div className="md:col-span-2">
                <Label>Approved TA nomination ({allocationEquipmentId ? "this equipment only" : "select equipment first"})</Label>
                <Input
                  className="mb-2 mt-1.5"
                  value={nominationSearch}
                  onChange={(e) => setNominationSearch(e.target.value)}
                  placeholder="Search by TA name, email, or academic year"
                  disabled={!allocationEquipmentId}
                />
                <Select
                  value={nominationId}
                  onValueChange={(v) => {
                    setNominationId(v);
                    setSelectedRealBookingIds([]);
                  }}
                  disabled={!allocationEquipmentId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={allocationEquipmentId ? "Select approved nomination" : "Select equipment first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {nominationOptionsFiltered.map((n) => (
                      <SelectItem key={n.id} value={String(n.id)}>
                        {n.student_name || n.student_email} ({n.academic_year_name || "Academic Year"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-2">
                {!allocationEquipmentId ? (
                  <div className="rounded-lg border p-6 text-sm text-muted-foreground text-center bg-muted/20">
                    Select equipment first. Approved nominations and the slot calendar are limited to that equipment.
                  </div>
                ) : !selectedNomination ? (
                  <div className="rounded-lg border p-6 text-sm text-muted-foreground text-center bg-muted/20">
                    {nominationOptionsFiltered.length === 0
                      ? "No approved TA nominations for this equipment."
                      : "Select an approved TA nomination. The calendar loads slots for this equipment only."}
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between items-center mb-6">
                      <Button type="button" variant="outline" size="sm" onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))}>
                        <ChevronLeft className="h-4 w-4 mr-2" />
                        Previous Week
                      </Button>
                      <div className="text-center">
                        <span className="font-semibold">
                          {format(currentWeekStart, "MMM dd")} - {format(addDays(currentWeekStart, 6), "MMM dd, yyyy")}
                        </span>
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}>
                        Next Week
                        <ChevronRight className="h-4 w-4 ml-2" />
                      </Button>
                    </div>

                    <div className="overflow-x-auto relative">
                      {slotsLoading && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 rounded-lg">
                          <p className="text-sm text-muted-foreground">Loading slot availability…</p>
                        </div>
                      )}
                      <div className="min-w-[800px]">
                        <div className="grid grid-cols-8 gap-2 mb-2">
                          <div className="font-semibold text-sm p-2">Time</div>
                          {[0, 1, 2, 3, 4, 5, 6].map((dayOffset) => {
                            const day = addDays(currentWeekStart, dayOffset);
                            return (
                              <div key={dayOffset} className="font-semibold text-sm p-2 text-center">
                                <div>{format(day, "EEE")}</div>
                                <div className="text-muted-foreground">{format(day, "MMM dd")}</div>
                              </div>
                            );
                          })}
                        </div>

                        {weekTimeRows.length === 0 && !slotsLoading ? (
                          <div className="p-4 text-center text-muted-foreground text-sm">No time rows for this equipment this week.</div>
                        ) : (
                          weekTimeRows.map((timeKey) => (
                            <div key={timeKey} className="grid grid-cols-8 gap-2 mb-2">
                              <div className="text-sm p-2 font-medium flex items-center">{timeKey}</div>
                              {[0, 1, 2, 3, 4, 5, 6].map((dayOffset) => {
                                const day = addDays(currentWeekStart, dayOffset);
                                const slotData = weekSlotState ? findSlotForCell(weekSlotState.slots, day, timeKey) : undefined;
                                const dateStr = format(day, "yyyy-MM-dd");
                                const dayOfWeek = day.getDay();
                                const rawHoliday = weekSlotState?.weekly_holidays?.[dateStr];
                                const holidayLabel =
                                  typeof rawHoliday === "string"
                                    ? rawHoliday
                                    : rawHoliday && typeof rawHoliday === "object" && "label" in rawHoliday
                                      ? (rawHoliday as { label: string }).label
                                      : undefined;
                                const holidayColor =
                                  typeof rawHoliday === "object" && rawHoliday !== null && "color" in rawHoliday && (rawHoliday as { color?: string }).color
                                    ? (rawHoliday as { color: string }).color
                                    : undefined;

                                const holidayDefault = weekSlotState?.calendar_colors?.holiday_default || "#f59e0b";
                                const saturdayColor = weekSlotState?.calendar_colors?.saturday_color || "#c7d2fe";
                                const sundayColor = weekSlotState?.calendar_colors?.sunday_color || "#fbcfe8";
                                const slotColors = {
                                  ...DEFAULT_SLOT_COLORS,
                                  ...(weekSlotState?.calendar_colors?.slot_colors || {}),
                                };

                                const slotStatus = slotData?.status ?? "";
                                const realPk = slotData?.real_booking_id ?? null;
                                const taDuty =
                                  typeof realPk === "number" ? bookingIdToTaAssignment.get(realPk) : undefined;
                                const taDutyLocked = canAllocateTa && !!taDuty;
                                const canSelectTa =
                                  !taDutyLocked &&
                                  !!slotData &&
                                  typeof realPk === "number" &&
                                  (slotStatus === "BOOKED" || slotStatus === "BOOKING_NOT_UTILIZED");
                                const isSelected =
                                  canSelectTa && selectedRealBookingIds.includes(String(realPk));

                                let displayStatus: string;
                                let cellStyle: CSSProperties | undefined;

                                if (slotData) {
                                  if (taDutyLocked && taDuty) {
                                    displayStatus = taDuty.status === "ACCEPTED" ? "Accepted" : "Allocated";
                                    const bg = taDuty.status === "ACCEPTED" ? TA_ACCEPTED_SLOT_BG : TA_ALLOCATED_SLOT_BG;
                                    cellStyle = { backgroundColor: bg, color: getContrastTextColor(bg) };
                                  } else {
                                    const statusMap: Record<string, string> = {
                                      AVAILABLE: "Available",
                                      NOT_AVAILABLE: "Not Available",
                                      BOOKED: "Booked",
                                      BLOCKED: "Blocked",
                                      UNDER_MAINTENANCE: "Under Maintenance",
                                      OPERATOR_ABSENT: "Operator Absent",
                                      BOOKING_NOT_UTILIZED: "Booked",
                                    };
                                    if (slotStatus === "BOOKED" || slotStatus === "BOOKING_NOT_UTILIZED") {
                                      displayStatus = "Booked";
                                    } else {
                                      displayStatus =
                                        slotData.status_display ||
                                        statusMap[slotStatus] ||
                                        (slotData.blocked_label && slotStatus === "BLOCKED" ? slotData.blocked_label : slotStatus);
                                    }

                                    let statusForColor = slotStatus;
                                    if (slotData.status_display === "Reserved for External User") statusForColor = "RESERVED_FOR_EXTERNAL";
                                    else if (slotStatus === "NOT_AVAILABLE") statusForColor = "NOT_AVAILABLE";
                                    else if (slotStatus === "BOOKED" && slotData?.booking_status)
                                      statusForColor = String(slotData.booking_status).toUpperCase();

                                    const considerBooked =
                                      slotStatus === "BOOKED" ||
                                      slotStatus === "BOOKING_NOT_UTILIZED" ||
                                      (!!realPk && slotStatus !== "AVAILABLE");
                                    const bg =
                                      slotColors[statusForColor] ?? (considerBooked ? slotColors.BOOKED : slotColors.AVAILABLE);
                                    cellStyle = { backgroundColor: bg, color: getContrastTextColor(bg) };
                                  }
                                } else {
                                  const bg = holidayColor
                                    ? holidayColor
                                    : dayOfWeek === 6
                                      ? saturdayColor
                                      : dayOfWeek === 0
                                        ? sundayColor
                                        : holidayDefault;
                                  displayStatus = holidayLabel || "—";
                                  cellStyle = { backgroundColor: bg, color: getContrastTextColor(bg) };
                                }

                                return (
                                  <button
                                    key={dayOffset}
                                    type="button"
                                    onClick={() => {
                                      if (!canSelectTa || realPk == null) return;
                                      const idStr = String(realPk);
                                      if (!canAllocateTa) {
                                        setSelectedRealBookingIds([idStr]);
                                        return;
                                      }
                                      setSelectedRealBookingIds((prev) =>
                                        prev.includes(idStr) ? prev.filter((x) => x !== idStr) : [...prev, idStr]
                                      );
                                    }}
                                    disabled={!canSelectTa}
                                    className={`
                                      p-3 rounded-md text-sm transition-all min-h-[48px] flex items-center justify-center font-medium border-2 border-white/50 shadow-sm
                                      ${!slotData ? "cursor-default" : ""}
                                      ${canSelectTa ? "cursor-pointer hover:opacity-90" : "cursor-not-allowed"}
                                      ${taDutyLocked ? "opacity-100" : !canSelectTa && slotData ? "opacity-90" : ""}
                                      ${isSelected ? "!bg-primary !text-primary-foreground border-primary" : ""}
                                    `}
                                    style={isSelected ? undefined : cellStyle}
                                    title={
                                      taDutyLocked
                                        ? taDuty?.status === "ACCEPTED"
                                          ? "TA has accepted this duty"
                                          : "TA duty already allocated — cancel in the table below to assign again"
                                        : canSelectTa
                                          ? canAllocateTa
                                            ? "Click to add or remove this slot (multi-select)"
                                            : "Click to select this booking for allocation"
                                          : undefined
                                    }
                                  >
                                    <span className="text-center leading-tight px-1">{displayStatus}</span>
                                  </button>
                                );
                              })}
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {selectedSlotsForAllocate.length > 0 && (
                      <div className="mt-4 p-4 bg-muted rounded-lg text-sm space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-medium">
                            Selected slot{selectedSlotsForAllocate.length > 1 ? "s" : ""} ({selectedSlotsForAllocate.length})
                          </span>
                          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedRealBookingIds([])}>
                            Clear selection
                          </Button>
                        </div>
                        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                          {selectedSlotsForAllocate.map((s) => (
                            <li key={`${s.id}-${s.real_booking_id}`}>
                              <span className="font-mono text-foreground">
                                {s.booking_id ? String(s.booking_id) : `#${s.real_booking_id}`}
                              </span>
                              {s.start_datetime
                                ? ` — ${format(new Date(s.start_datetime), "EEE dd MMM")} ${parseIsoDateAndTime(s.start_datetime).timeStr}`
                                : ""}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div>
                <Label>Expected Duty Hours</Label>
                <Input value={expectedHours} onChange={(e) => setExpectedHours(e.target.value)} placeholder="e.g. 2.5" />
              </div>
              <div>
                <Label>Allocation Notes</Label>
                <Input value={allocationNotes} onChange={(e) => setAllocationNotes(e.target.value)} placeholder="Optional instructions for TA" />
              </div>
              <div className="md:col-span-2">
                <Button
                  onClick={allocate}
                  disabled={
                    allocating || !allocationEquipmentId || !selectedNomination || selectedRealBookingIds.length === 0
                  }
                >
                  {allocating
                    ? "Allocating..."
                    : selectedRealBookingIds.length > 1
                      ? `Allocate ${selectedRealBookingIds.length} slots & notify TA`
                      : "Allocate and notify TA"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Assignments</CardTitle>
            <CardDescription>{loading ? "Loading assignments..." : `${assignments.length} assignment(s)`}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>TA</TableHead>
                  <TableHead>Equipment & slot</TableHead>
                  <TableHead>Booking</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((a) => {
                  const dutyLog = dutyLogByAssignment[a.id];
                  return (
                    <TableRow key={a.id}>
                      <TableCell>{a.id}</TableCell>
                      <TableCell>{a.ta_student_name || a.ta_student_email || a.ta_student}</TableCell>
                      <TableCell>
                        <div className="space-y-1 max-w-[min(100vw-4rem,22rem)]">
                          <div className="font-medium leading-snug">
                            {a.equipment_name || a.equipment_code || a.equipment}
                            {a.equipment_code && a.equipment_name ? (
                              <span className="text-muted-foreground font-normal"> ({a.equipment_code})</span>
                            ) : null}
                          </div>
                          {a.booking_slot_summary ? (
                            <div className="text-xs text-muted-foreground leading-snug">{a.booking_slot_summary}</div>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-mono text-sm font-medium">
                          {a.booking_display_id || String(a.booking)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {a.status === "ACCEPTED"
                            ? "Accepted"
                            : a.status === "ALLOCATED"
                              ? "Allocated"
                              : a.status === "DECLINED"
                                ? "Declined"
                                : a.status === "CANCELLED"
                                  ? "Cancelled"
                                  : a.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="space-x-2">
                        {isTaStudent && a.status === "ALLOCATED" && (
                          <>
                            <Button size="sm" onClick={() => respond(a.id, "ACCEPT")} disabled={actingAssignmentId === a.id}>
                              Accept
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => respond(a.id, "DECLINE")} disabled={actingAssignmentId === a.id}>
                              Decline
                            </Button>
                          </>
                        )}
                        {isTaStudent && a.status === "ACCEPTED" && !dutyLog && (
                          <div className="space-y-2 min-w-[280px]">
                            <Input
                              type="date"
                              value={submitByAssignment[a.id]?.duty_date || ""}
                              onChange={(e) =>
                                setSubmitByAssignment((p) => ({
                                  ...p,
                                  [a.id]: {
                                    duty_date: e.target.value,
                                    hours_spent: p[a.id]?.hours_spent || "",
                                    samples_processed: p[a.id]?.samples_processed || "",
                                    remarks: p[a.id]?.remarks || "",
                                  },
                                }))
                              }
                            />
                            <Input
                              placeholder="Hours spent (e.g. 2.5)"
                              value={submitByAssignment[a.id]?.hours_spent || ""}
                              onChange={(e) =>
                                setSubmitByAssignment((p) => ({
                                  ...p,
                                  [a.id]: {
                                    duty_date: p[a.id]?.duty_date || "",
                                    hours_spent: e.target.value,
                                    samples_processed: p[a.id]?.samples_processed || "",
                                    remarks: p[a.id]?.remarks || "",
                                  },
                                }))
                              }
                            />
                            <Input
                              placeholder="Samples processed (optional)"
                              value={submitByAssignment[a.id]?.samples_processed || ""}
                              onChange={(e) =>
                                setSubmitByAssignment((p) => ({
                                  ...p,
                                  [a.id]: {
                                    duty_date: p[a.id]?.duty_date || "",
                                    hours_spent: p[a.id]?.hours_spent || "",
                                    samples_processed: e.target.value,
                                    remarks: p[a.id]?.remarks || "",
                                  },
                                }))
                              }
                            />
                            <Input
                              placeholder="Remarks (optional)"
                              value={submitByAssignment[a.id]?.remarks || ""}
                              onChange={(e) =>
                                setSubmitByAssignment((p) => ({
                                  ...p,
                                  [a.id]: {
                                    duty_date: p[a.id]?.duty_date || "",
                                    hours_spent: p[a.id]?.hours_spent || "",
                                    samples_processed: p[a.id]?.samples_processed || "",
                                    remarks: e.target.value,
                                  },
                                }))
                              }
                            />
                            <Button size="sm" onClick={() => submitDutyLog(a.id)}>
                              Submit duty log
                            </Button>
                          </div>
                        )}
                        {dutyLog && (
                          <div className="text-xs text-muted-foreground space-y-1 max-w-[14rem]">
                            <div>
                              Duty log #{dutyLog.id} ({dutyLog.status})
                            </div>
                            {dutyLog.status === "VERIFIED" && dutyLog.reward_points_earned != null && dutyLog.reward_points_earned !== "" && (
                              <div className="text-emerald-700 dark:text-emerald-400 font-semibold">
                                +{dutyLog.reward_points_earned} reward pts
                                <span className="font-normal text-muted-foreground">
                                  {" "}
                                  for booking {a.booking_display_id ?? a.booking ?? "—"}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                        {canManage && dutyLog && dutyLog.status === "PENDING" && (
                          <>
                            {canAllocateTa ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => openDutyLogReview(dutyLog)}
                                disabled={actingDutyLogId === dutyLog.id}
                              >
                                Review log
                              </Button>
                            ) : (
                              <>
                                <Button size="sm" onClick={() => verifyDutyLog(dutyLog.id, true)} disabled={actingDutyLogId === dutyLog.id}>
                                  Verify
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => verifyDutyLog(dutyLog.id, false)} disabled={actingDutyLogId === dutyLog.id}>
                                  Reject
                                </Button>
                              </>
                            )}
                          </>
                        )}
                        {canAllocateTa && (a.status === "ALLOCATED" || a.status === "ACCEPTED") && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-destructive/60 text-destructive hover:bg-destructive/10"
                            onClick={() => cancelAssignment(a.id)}
                            disabled={cancellingAssignmentId === a.id}
                          >
                            {cancellingAssignmentId === a.id ? "Cancelling…" : "Cancel assignment"}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!loading && assignments.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No assignments available.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={!!dutyLogReview} onOpenChange={(open) => !open && setDutyLogReview(null)}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Review TA duty log</DialogTitle>
              <DialogDescription>
                Check the values submitted by the TA. You may correct them before approving. Rewards use the final hours and samples.
              </DialogDescription>
            </DialogHeader>
            {dutyLogReview && (
              <div className="space-y-4 py-2">
                <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm space-y-1">
                  <div>
                    <span className="text-muted-foreground">TA: </span>
                    {dutyLogReview.student_name || dutyLogReview.student_email || dutyLogReview.student}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Equipment: </span>
                    {dutyLogReview.equipment_name || dutyLogReview.equipment_code || dutyLogReview.equipment}
                    {dutyLogReview.equipment_code && dutyLogReview.equipment_name ? ` (${dutyLogReview.equipment_code})` : null}
                  </div>
                  {dutyLogReview.booking != null && (
                    <div>
                      <span className="text-muted-foreground">Booking ID: </span>
                      <span className="font-mono">{String(dutyLogReview.booking)}</span>
                    </div>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="review-duty-date">Duty date</Label>
                  <Input
                    id="review-duty-date"
                    type="date"
                    value={dutyLogReviewForm.duty_date}
                    onChange={(e) => setDutyLogReviewForm((f) => ({ ...f, duty_date: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="review-hours">Hours spent</Label>
                  <Input
                    id="review-hours"
                    inputMode="decimal"
                    placeholder="e.g. 2.5"
                    value={dutyLogReviewForm.hours_spent}
                    onChange={(e) => setDutyLogReviewForm((f) => ({ ...f, hours_spent: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="review-samples">Samples processed</Label>
                  <Input
                    id="review-samples"
                    inputMode="numeric"
                    placeholder="0"
                    value={dutyLogReviewForm.samples_processed}
                    onChange={(e) => setDutyLogReviewForm((f) => ({ ...f, samples_processed: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="review-remarks">Remarks</Label>
                  <Textarea
                    id="review-remarks"
                    rows={3}
                    placeholder="Notes from TA (editable)"
                    value={dutyLogReviewForm.remarks}
                    onChange={(e) => setDutyLogReviewForm((f) => ({ ...f, remarks: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2 border-t pt-4">
                  <Label htmlFor="reject-note">Reason for rejection (optional)</Label>
                  <Textarea
                    id="reject-note"
                    rows={2}
                    placeholder="Shown when you reject this log"
                    value={dutyLogRejectNote}
                    onChange={(e) => setDutyLogRejectNote(e.target.value)}
                  />
                </div>
              </div>
            )}
            <DialogFooter className="flex-col sm:flex-row gap-2 sm:justify-between">
              <Button
                type="button"
                variant="outline"
                className="border-destructive/60 text-destructive"
                disabled={actingDutyLogId !== null}
                onClick={() => void submitDutyLogReviewReject()}
              >
                {actingDutyLogId === dutyLogReview?.id ? "Rejecting…" : "Reject"}
              </Button>
              <div className="flex gap-2 w-full sm:w-auto justify-end">
                <Button type="button" variant="outline" onClick={() => setDutyLogReview(null)} disabled={actingDutyLogId !== null}>
                  Close
                </Button>
                <Button type="button" disabled={actingDutyLogId !== null} onClick={() => void submitDutyLogReviewVerify()}>
                  {actingDutyLogId === dutyLogReview?.id ? "Saving…" : "Approve & verify"}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
