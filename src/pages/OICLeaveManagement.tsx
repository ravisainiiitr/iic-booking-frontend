import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { ArrowLeft, Calendar, CalendarClock, CalendarDays, CheckCircle2, Clock, Loader2, Paperclip, Pencil, UserCheck, X, XCircle } from "lucide-react";

import DashboardHeader from "@/components/DashboardHeader";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type LeaveSession = "FN" | "AN";
type LeaveType = "FULL_DAY" | "HALF_FN" | "HALF_AN" | "CUSTOM";

type PendingLeaveRow = {
  id: number;
  operator: { id: number; name?: string | null; email?: string | null };
  start_date: string;
  start_session: LeaveSession;
  end_date: string;
  end_session: LeaveSession;
  reason: string;
  status: string;
  created_at?: string | null;
  reviewed_at?: string | null;
};

type MyLeaveRow = {
  id: number;
  start_date: string;
  start_session: LeaveSession;
  end_date: string;
  end_session: LeaveSession;
  reason: string;
  status: string;
  rejection_reason?: string | null;
  reviewed_at?: string | null;
};

type LeaveLike = {
  start_date: string;
  start_session: LeaveSession;
  end_date: string;
  end_session: LeaveSession;
  status: string;
};

type EquipmentOption = { id: number; code: string; name: string };
type OicUser = { id: number; name: string; email: string };
type Delegation = {
  id: number;
  equipment_id: number;
  equipment_code: string;
  equipment_name: string;
  temporary_oic_id: number;
  temporary_oic_name: string;
  temporary_oic_email: string;
  resume_at: string;
  created_at: string;
};

function clampLeaveCount(v: number) {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.round(v * 2) / 2);
}

function computeLeaveDays(
  startDateIso: string,
  startSession: LeaveSession,
  endDateIso: string,
  endSession: LeaveSession,
): number {
  if (!startDateIso || !endDateIso) return 0;
  const s = parseISO(startDateIso);
  const e = parseISO(endDateIso);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0;
  const start = s <= e ? s : e;
  const end = s <= e ? e : s;
  const days = (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000) + 1;
  let out = days;
  const isSame = start.toISOString().slice(0, 10) === end.toISOString().slice(0, 10);
  if (isSame && startSession === "AN" && endSession === "FN") return 0;
  if (startSession === "AN") out -= 0.5;
  if (endSession === "FN") out -= 0.5;
  return clampLeaveCount(out);
}

function fyRangeForDate(d: Date): { start: Date; end: Date; label: string } {
  const y = d.getFullYear();
  const m = d.getMonth(); // 0=Jan
  const startYear = m >= 3 ? y : y - 1; // FY starts Apr 1
  const start = new Date(startYear, 3, 1);
  const end = new Date(startYear + 1, 2, 31);
  const label = `FY ${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
  return { start, end, label };
}

function overlapLeaveDays(leave: LeaveLike, rangeStart: Date, rangeEnd: Date): number {
  const s = parseISO(leave.start_date);
  const e = parseISO(leave.end_date);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0;

  const start = s <= e ? s : e;
  const end = s <= e ? e : s;

  const clipStart = start > rangeStart ? start : rangeStart;
  const clipEnd = end < rangeEnd ? end : rangeEnd;
  if (clipStart > clipEnd) return 0;

  const clipStartIso = format(clipStart, "yyyy-MM-dd");
  const clipEndIso = format(clipEnd, "yyyy-MM-dd");

  const clipStartSession: LeaveSession =
    clipStartIso === leave.start_date ? leave.start_session : "FN";
  const clipEndSession: LeaveSession =
    clipEndIso === leave.end_date ? leave.end_session : "AN";

  return computeLeaveDays(clipStartIso, clipStartSession, clipEndIso, clipEndSession);
}

function computedResumeAtIso(endDateIso: string, endSession: LeaveSession): string | null {
  if (!endDateIso) return null;
  const end = parseISO(endDateIso);
  if (Number.isNaN(end.getTime())) return null;
  // Use a deterministic local-time cutoff so the temp OIC keeps access through the leave end.
  const hh = endSession === "FN" ? 13 : 23;
  const mm = endSession === "FN" ? 0 : 59;
  const ss = endSession === "FN" ? 0 : 59;
  const dtLocal = new Date(end.getFullYear(), end.getMonth(), end.getDate(), hh, mm, ss, 0);
  return dtLocal.toISOString();
}

export default function OICLeaveManagement() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userType = user?.user_type != null ? String(user.user_type).toLowerCase() : "";
  const isOicOrAdmin = userType === "manager" || userType === "admin";

  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const [year, setYear] = useState<number>(currentYear);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actingOnId, setActingOnId] = useState<number | null>(null);

  const [pending, setPending] = useState<PendingLeaveRow[]>([]);
  const [approved, setApproved] = useState<PendingLeaveRow[]>([]);

  const [approvedDaysThisYear, setApprovedDaysThisYear] = useState<number>(0);
  const [myLeaves, setMyLeaves] = useState<MyLeaveRow[]>([]);
  const [approvedDaysFinancialYear, setApprovedDaysFinancialYear] = useState<number>(0);
  const [approvedDaysOverall, setApprovedDaysOverall] = useState<number>(0);
  const [financialYearLabel, setFinancialYearLabel] = useState<string>("");

  const [startDate, setStartDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [startSession, setStartSession] = useState<LeaveSession>("FN");
  const [endSession, setEndSession] = useState<LeaveSession>("AN");
  const [leaveType, setLeaveType] = useState<LeaveType>("FULL_DAY");
  const [reason, setReason] = useState<string>("");
  const [attachment, setAttachment] = useState<File | null>(null);

  const [rejectReasonById, setRejectReasonById] = useState<Record<number, string>>({});

  // Approve-with-coverage dialog state (operator leave)
  const [coverageDialogLeaveId, setCoverageDialogLeaveId] = useState<number | null>(null);
  const [coverageDialogLoading, setCoverageDialogLoading] = useState(false);
  const [coverageEquipments, setCoverageEquipments] = useState<Array<{ equipment_id: number; equipment_code: string; equipment_name: string }>>([]);
  const [coverageEligibleOperators, setCoverageEligibleOperators] = useState<Array<{ id: number; name: string; email: string }>>([]);
  const [coverageByEquipmentId, setCoverageByEquipmentId] = useState<Record<number, { mode: "SECONDARY_OPERATOR" | "OIC_SELF_OPERATE" | "OPERATOR_ON_LEAVE"; acting_operator_id?: number | null }>>({});
  const [coverageSubmitting, setCoverageSubmitting] = useState(false);

  // Temporary OIC (Leave) — merged from TemporaryOIC page
  const [tempOicEquipments, setTempOicEquipments] = useState<EquipmentOption[]>([]);
  const [tempOicUsers, setTempOicUsers] = useState<OicUser[]>([]);
  const [tempOicDelegations, setTempOicDelegations] = useState<Delegation[]>([]);
  const [tempOicLoadingEquipments, setTempOicLoadingEquipments] = useState(true);
  const [tempOicLoadingUsers, setTempOicLoadingUsers] = useState(true);
  const [tempOicLoadingDelegations, setTempOicLoadingDelegations] = useState(true);
  const [tempOicSubmitting, setTempOicSubmitting] = useState(false);
  const [tempOicCancellingId, setTempOicCancellingId] = useState<number | null>(null);
  const [tempOicSelectedEquipmentId, setTempOicSelectedEquipmentId] = useState<string>("");
  const [tempOicSelectedUserId, setTempOicSelectedUserId] = useState<string>("");
  const [tempOicComboboxOpen, setTempOicComboboxOpen] = useState(false);
  const [tempOicSearchQuery, setTempOicSearchQuery] = useState("");
  const [tempOicEditingDelegationId, setTempOicEditingDelegationId] = useState<number | null>(null);
  const [tempOicEditResumeAt, setTempOicEditResumeAt] = useState("");
  const [tempOicSavingEditId, setTempOicSavingEditId] = useState<number | null>(null);

  useEffect(() => {
    if (!isOicOrAdmin) {
      navigate("/dashboard");
    }
  }, [isOicOrAdmin, navigate]);

  const refresh = async (y: number) => {
    setLoading(true);
    try {
      const now = new Date();
      const fy = fyRangeForDate(now);
      setFinancialYearLabel(fy.label);
      const fyStartYear = fy.start.getFullYear();
      const fyEndYear = fy.end.getFullYear();
      const emptyListRes = { data: { leaves: [] as LeaveLike[] } };

      const [
        pendingRes,
        approvedRes,
        summaryRes,
        myListRes,
        fyStartListRes,
        fyEndListRes,
        allListRes,
      ] = await Promise.all([
        apiClient.listPendingLeaveRequestsForOic(),
        apiClient.listApprovedLeaveRequestsForOic(),
        apiClient.getOperatorLeaveSummary({ year: y }),
        apiClient.listOperatorLeaveRequests({ year: y }),
        apiClient.listOperatorLeaveRequests({ year: fyStartYear }),
        fyEndYear === fyStartYear
          ? Promise.resolve(emptyListRes)
          : apiClient.listOperatorLeaveRequests({ year: fyEndYear }),
        apiClient.listOperatorLeaveRequests(),
      ]);
      if (pendingRes.error) throw new Error(pendingRes.error);
      if (approvedRes.error) throw new Error(approvedRes.error);
      if (summaryRes.error) throw new Error(summaryRes.error);
      if (myListRes.error) throw new Error(myListRes.error);
      if (fyStartListRes.error) throw new Error(fyStartListRes.error);
      if (fyEndListRes.error) throw new Error(fyEndListRes.error);
      if (allListRes.error) throw new Error(allListRes.error);

      setPending((pendingRes.data?.leaves ?? []) as PendingLeaveRow[]);
      setApproved((approvedRes.data?.leaves ?? []) as PendingLeaveRow[]);
      setApprovedDaysThisYear(summaryRes.data?.approved_days_this_year ?? 0);
      setMyLeaves((myListRes.data?.leaves ?? []) as MyLeaveRow[]);

      const fyLeaves = [
        ...((fyStartListRes.data?.leaves ?? []) as LeaveLike[]),
        ...((fyEndListRes.data?.leaves ?? []) as LeaveLike[]),
      ].filter((r) => String(r.status || "").toUpperCase() === "APPROVED");

      const fyApprovedDays = fyLeaves.reduce((acc, r) => acc + overlapLeaveDays(r, fy.start, fy.end), 0);
      setApprovedDaysFinancialYear(clampLeaveCount(fyApprovedDays));

      const allApproved = ((allListRes.data?.leaves ?? []) as LeaveLike[]).filter(
        (r) => String(r.status || "").toUpperCase() === "APPROVED"
      );
      const overallApprovedDays = allApproved.reduce(
        (acc, r) => acc + computeLeaveDays(r.start_date, r.start_session, r.end_date, r.end_session),
        0
      );
      setApprovedDaysOverall(clampLeaveCount(overallApprovedDays));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to load leave management data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOicOrAdmin) return;
    refresh(year);
  }, [isOicOrAdmin, year]);

  useEffect(() => {
    if (!isOicOrAdmin) return;
    // Load Temporary OIC supporting data for managers/admins.
    setTempOicLoadingEquipments(true);
    setTempOicLoadingUsers(true);
    setTempOicLoadingDelegations(true);
    apiClient.getTemporaryOicMyEquipments().then((res) => {
      setTempOicLoadingEquipments(false);
      if (res.error) setTempOicEquipments([]);
      else setTempOicEquipments(res.data?.equipments ?? []);
    });
    apiClient.getTemporaryOicOicUsers().then((res) => {
      setTempOicLoadingUsers(false);
      if (res.error) setTempOicUsers([]);
      else setTempOicUsers(res.data?.oic_users ?? []);
    });
    apiClient.getTemporaryOicMine().then((res) => {
      setTempOicLoadingDelegations(false);
      if (res.error) setTempOicDelegations([]);
      else setTempOicDelegations(res.data?.delegations ?? []);
    });
  }, [isOicOrAdmin]);

  const refreshTempOicDelegations = () => {
    apiClient.getTemporaryOicMine().then((res) => {
      if (!res.error && res.data?.delegations) setTempOicDelegations(res.data.delegations);
    });
  };

  const submitTempOicDelegation = async (e: React.FormEvent) => {
    e.preventDefault();
    const eqId = tempOicSelectedEquipmentId ? parseInt(tempOicSelectedEquipmentId, 10) : 0;
    const oicId = tempOicSelectedUserId ? parseInt(tempOicSelectedUserId, 10) : 0;
    const resumeAtIso = computedResumeAtIso(endDate, endSession);
    if (!eqId || !oicId || !resumeAtIso) {
      toast.error("Select equipment and Temporary OIC. Leave end date is required to compute resume time.");
      return;
    }
    if (new Date(resumeAtIso) <= new Date()) {
      toast.error("Computed resume time must be in the future. Please adjust your leave end date.");
      return;
    }
    setTempOicSubmitting(true);
    try {
      const res = await apiClient.createTemporaryOic(eqId, oicId, resumeAtIso);
      if (res.error) throw new Error(res.error);
      toast.success(res.data?.message ?? "Temporary OIC assigned.");
      setTempOicSelectedEquipmentId("");
      setTempOicSelectedUserId("");
      refreshTempOicDelegations();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to assign temporary OIC.");
    } finally {
      setTempOicSubmitting(false);
    }
  };

  const cancelTempOicDelegation = async (delegationId: number) => {
    setTempOicCancellingId(delegationId);
    try {
      const res = await apiClient.cancelTemporaryOic(delegationId);
      if (res.error) throw new Error(res.error);
      toast.success(res.data?.message ?? "Delegation cancelled.");
      refreshTempOicDelegations();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel delegation.");
    } finally {
      setTempOicCancellingId(null);
    }
  };

  const openTempOicEditDialog = (d: Delegation) => {
    const dt = new Date(d.resume_at);
    setTempOicEditResumeAt(format(dt, "yyyy-MM-dd'T'HH:mm"));
    setTempOicEditingDelegationId(d.id);
  };

  const saveTempOicEdit = async () => {
    if (tempOicEditingDelegationId == null || !tempOicEditResumeAt.trim()) return;
    const dt = new Date(tempOicEditResumeAt);
    if (Number.isNaN(dt.getTime()) || dt <= new Date()) {
      toast.error("Resume date and time must be in the future.");
      return;
    }
    setTempOicSavingEditId(tempOicEditingDelegationId);
    try {
      const res = await apiClient.updateTemporaryOic(tempOicEditingDelegationId, dt.toISOString());
      if (res.error) throw new Error(res.error);
      toast.success(res.data?.message ?? "Date and time updated.");
      setTempOicEditingDelegationId(null);
      setTempOicEditResumeAt("");
      refreshTempOicDelegations();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setTempOicSavingEditId(null);
    }
  };

  useEffect(() => {
    if (leaveType === "FULL_DAY") {
      setStartSession("FN");
      setEndSession("AN");
    } else if (leaveType === "HALF_FN") {
      setStartSession("FN");
      setEndSession("FN");
      setEndDate(startDate);
    } else if (leaveType === "HALF_AN") {
      setStartSession("AN");
      setEndSession("AN");
      setEndDate(startDate);
    }
    // CUSTOM: keep user-selected values
  }, [leaveType, startDate]);

  const leaveDaysPreview = useMemo(() => {
    return computeLeaveDays(startDate, startSession, endDate, endSession);
  }, [startDate, startSession, endDate, endSession]);

  const canSubmit = useMemo(() => {
    if (!startDate || !endDate) return false;
    if (!reason.trim() || reason.trim().length < 3) return false;
    if (startDate === endDate && startSession === "AN" && endSession === "FN") return false;
    return true;
  }, [startDate, endDate, reason, startSession, endSession]);

  const statusBadgeVariant = (s: string): { label: string; className: string } => {
    const u = String(s || "").toUpperCase();
    if (u === "APPROVED") return { label: "Approved", className: "bg-emerald-600 hover:bg-emerald-600 text-white" };
    if (u === "REJECTED") return { label: "Rejected", className: "bg-rose-600 hover:bg-rose-600 text-white" };
    if (u === "CANCELLED") return { label: "Cancelled", className: "bg-slate-600 hover:bg-slate-600 text-white" };
    return { label: "Pending", className: "bg-amber-600 hover:bg-amber-600 text-white" };
  };

  const isTodayWithinLeave = (r: { start_date: string; end_date: string }): boolean => {
    const todayIso = format(new Date(), "yyyy-MM-dd");
    return todayIso >= r.start_date && todayIso <= r.end_date;
  };

  const submitMyLeave = async () => {
    if (!reason.trim() || reason.trim().length < 3) {
      toast.error("Reason is required.");
      return;
    }
    if (startDate === endDate && startSession === "AN" && endSession === "FN") {
      toast.error("Invalid session range for the same day.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiClient.createOperatorLeaveRequest({
        start_date: startDate,
        start_session: startSession,
        end_date: endDate,
        end_session: endSession,
        reason: reason.trim(),
        attachment: attachment ?? undefined,
      });
      if (res.error) throw new Error(res.error);
      toast.success("Leave request submitted.");
      setReason("");
      setAttachment(null);
      await refresh(year);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to submit leave request.");
    } finally {
      setSubmitting(false);
    }
  };

  const approve = async (leaveId: number) => {
    setActingOnId(leaveId);
    setCoverageDialogLeaveId(leaveId);
    setCoverageDialogLoading(true);
    try {
      const res = await apiClient.getOicLeaveCoverageOptions(leaveId);
      if (res.error) throw new Error(res.error);
      const eqs = res.data?.equipments ?? [];
      setCoverageEquipments(eqs);
      setCoverageEligibleOperators(res.data?.eligible_operators ?? []);
      // Default each equipment to OPERATOR_ON_LEAVE.
      const defaults: Record<number, { mode: "SECONDARY_OPERATOR" | "OIC_SELF_OPERATE" | "OPERATOR_ON_LEAVE"; acting_operator_id?: number | null }> = {};
      for (const e of eqs) defaults[e.equipment_id] = { mode: "OPERATOR_ON_LEAVE" };
      setCoverageByEquipmentId(defaults);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to load coverage options.");
      setCoverageDialogLeaveId(null);
    } finally {
      setCoverageDialogLoading(false);
      setActingOnId(null);
    }
  };

  const openCoverageEditorForApproved = async (leaveId: number) => {
    setCoverageDialogLeaveId(leaveId);
    setCoverageDialogLoading(true);
    try {
      const [optsRes, covRes] = await Promise.all([
        apiClient.getOicLeaveCoverageOptions(leaveId),
        apiClient.getOicLeaveCoverages(leaveId),
      ]);
      if (optsRes.error) throw new Error(optsRes.error);
      if (covRes.error) throw new Error(covRes.error);

      const eqs = optsRes.data?.equipments ?? [];
      setCoverageEquipments(eqs);
      setCoverageEligibleOperators(optsRes.data?.eligible_operators ?? []);

      const existing = new Map<number, { mode: "SECONDARY_OPERATOR" | "OIC_SELF_OPERATE" | "OPERATOR_ON_LEAVE"; acting_operator_id?: number | null }>();
      for (const c of covRes.data?.coverages ?? []) {
        if (c.ended_early_at) continue;
        existing.set(c.equipment_id, { mode: c.mode, acting_operator_id: c.acting_operator_id ?? null });
      }
      const merged: Record<number, { mode: "SECONDARY_OPERATOR" | "OIC_SELF_OPERATE" | "OPERATOR_ON_LEAVE"; acting_operator_id?: number | null }> = {};
      for (const e of eqs) {
        merged[e.equipment_id] = existing.get(e.equipment_id) ?? { mode: "OPERATOR_ON_LEAVE" };
      }
      setCoverageByEquipmentId(merged);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load coverage editor.");
      setCoverageDialogLeaveId(null);
    } finally {
      setCoverageDialogLoading(false);
    }
  };

  const reject = async (leaveId: number) => {
    const rr = (rejectReasonById[leaveId] || "").trim();
    if (rr.length < 3) {
      toast.error("Rejection reason is required.");
      return;
    }
    setActingOnId(leaveId);
    try {
      const res = await apiClient.rejectLeaveRequestAsOic(leaveId, rr);
      if (res.error) throw new Error(res.error);
      toast.success("Leave rejected.");
      await refresh(year);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to reject.");
    } finally {
      setActingOnId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />

      <div className="mx-auto w-full px-4 py-6 sm:px-6 lg:px-8">
        <Dialog open={coverageDialogLeaveId != null} onOpenChange={(open) => !open && !coverageSubmitting && setCoverageDialogLeaveId(null)}>
          <DialogContent className="sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>Approve leave — assign coverage</DialogTitle>
              <DialogDescription>
                Choose what happens for each equipment during this operator’s leave.
              </DialogDescription>
            </DialogHeader>

            {coverageDialogLoading ? (
              <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading coverage options…
              </div>
            ) : coverageEquipments.length === 0 ? (
              <div className="py-4 text-sm text-muted-foreground">
                No primary equipments found for this operator.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="overflow-auto rounded-xl border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Equipment</TableHead>
                        <TableHead className="w-[220px]">Coverage mode</TableHead>
                        <TableHead className="w-[260px]">Secondary operator (if selected)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {coverageEquipments.map((eq) => {
                        const v = coverageByEquipmentId[eq.equipment_id] ?? { mode: "OPERATOR_ON_LEAVE" as const };
                        return (
                          <TableRow key={eq.equipment_id}>
                            <TableCell>
                              <div className="font-medium">
                                {eq.equipment_code ? `${eq.equipment_code} · ` : ""}
                                {eq.equipment_name}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={v.mode}
                                onValueChange={(mode) => {
                                  const m = mode as "SECONDARY_OPERATOR" | "OIC_SELF_OPERATE" | "OPERATOR_ON_LEAVE";
                                  setCoverageByEquipmentId((prev) => ({
                                    ...prev,
                                    [eq.equipment_id]: { mode: m, acting_operator_id: null },
                                  }));
                                }}
                              >
                                <SelectTrigger className="h-10">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="SECONDARY_OPERATOR">Assign secondary operator</SelectItem>
                                  <SelectItem value="OIC_SELF_OPERATE">OIC self-operate</SelectItem>
                                  <SelectItem value="OPERATOR_ON_LEAVE">Operator on leave (disruption)</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={v.acting_operator_id ? String(v.acting_operator_id) : ""}
                                onValueChange={(opId) => {
                                  const idNum = opId ? Number(opId) : null;
                                  setCoverageByEquipmentId((prev) => ({
                                    ...prev,
                                    [eq.equipment_id]: { ...prev[eq.equipment_id], acting_operator_id: idNum },
                                  }));
                                }}
                                disabled={v.mode !== "SECONDARY_OPERATOR"}
                              >
                                <SelectTrigger className="h-10">
                                  <SelectValue placeholder={v.mode === "SECONDARY_OPERATOR" ? "Select operator" : "—"} />
                                </SelectTrigger>
                                <SelectContent>
                                  {coverageEligibleOperators.map((op) => (
                                    <SelectItem key={op.id} value={String(op.id)}>
                                      {op.name || op.email} ({op.email})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setCoverageDialogLeaveId(null)} disabled={coverageSubmitting}>
                Cancel
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={coverageSubmitting || coverageDialogLeaveId == null || coverageEquipments.length === 0}
                onClick={async () => {
                  if (coverageDialogLeaveId == null) return;
                  const coverages = coverageEquipments.map((eq) => {
                    const v = coverageByEquipmentId[eq.equipment_id] ?? { mode: "OPERATOR_ON_LEAVE" as const };
                    return { equipment_id: eq.equipment_id, mode: v.mode, acting_operator_id: v.acting_operator_id ?? null };
                  });
                  // Validate required operator for SECONDARY_OPERATOR.
                  const missing = coverages.find((c) => c.mode === "SECONDARY_OPERATOR" && !c.acting_operator_id);
                  if (missing) {
                    toast.error("Please select a secondary operator for all equipments set to Secondary Operator mode.");
                    return;
                  }
                  setCoverageSubmitting(true);
                  try {
                    // If leave is pending, approve-with-coverage. If already approved, set/replace coverages.
                    const approveRes = await apiClient.approveLeaveRequestAsOicWithCoverage(coverageDialogLeaveId, { coverages });
                    if (approveRes.error) {
                      const setRes = await apiClient.setOicLeaveCoverages(coverageDialogLeaveId, { coverages });
                      if (setRes.error) throw new Error(setRes.error);
                      toast.success("Coverage mapping saved.");
                    } else {
                      toast.success("Leave approved.");
                    }
                    setCoverageDialogLeaveId(null);
                    await refresh(year);
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Failed to apply coverage.");
                  } finally {
                    setCoverageSubmitting(false);
                  }
                }}
              >
                {coverageSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save coverage mapping
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="outline" onClick={() => navigate("/dashboard")} className="shrink-0">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight">Leave Management</h1>
              <p className="text-sm text-muted-foreground">
                Review operator leave requests and apply leave for yourself
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={() => refresh(year)} disabled={loading} className="shrink-0">
            Refresh
          </Button>
        </div>

        <div className="space-y-6">
          <Card className="border-0 shadow-md">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg">
                  <Calendar className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-lg">Pending requests</CardTitle>
                  <CardDescription>Requests awaiting your decision</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading…
                </div>
              ) : pending.length === 0 ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border bg-muted/20 p-3">
                      <div className="text-xs font-semibold text-muted-foreground">{financialYearLabel} leave taken</div>
                      <div className="text-lg font-bold tabular-nums">{approvedDaysFinancialYear}</div>
                    </div>
                    <div className="rounded-xl border bg-muted/20 p-3">
                      <div className="text-xs font-semibold text-muted-foreground">Overall leave taken</div>
                      <div className="text-lg font-bold tabular-nums">{approvedDaysOverall}</div>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">No pending leave requests.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border bg-muted/20 p-3">
                      <div className="text-xs font-semibold text-muted-foreground">{financialYearLabel} leave taken</div>
                      <div className="text-lg font-bold tabular-nums">{approvedDaysFinancialYear}</div>
                    </div>
                    <div className="rounded-xl border bg-muted/20 p-3">
                      <div className="text-xs font-semibold text-muted-foreground">Overall leave taken</div>
                      <div className="text-lg font-bold tabular-nums">{approvedDaysOverall}</div>
                    </div>
                  </div>
                  <div className="overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Team member</TableHead>
                          <TableHead>Dates</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pending.map((r) => {
                          const isBusy = actingOnId === r.id;
                          return (
                            <TableRow key={r.id}>
                              <TableCell className="align-top">
                                <div className="font-medium">{r.operator?.name || "—"}</div>
                                <div className="text-xs text-muted-foreground">{r.operator?.email || ""}</div>
                                <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.reason}</div>
                              </TableCell>
                              <TableCell className="align-top whitespace-nowrap">
                                <div className="text-sm">
                                  {r.start_date} ({r.start_session}) → {r.end_date} ({r.end_session})
                                </div>
                              </TableCell>
                              <TableCell className="align-top">
                                <Badge variant="secondary">Pending</Badge>
                              </TableCell>
                              <TableCell className="align-top">
                                <div className="flex flex-col items-end gap-2 min-w-[220px]">
                                  <div className="flex items-center gap-2">
                                    <Button
                                      size="sm"
                                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                      onClick={() => approve(r.id)}
                                      disabled={isBusy}
                                    >
                                      {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                                      Approve
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => reject(r.id)}
                                      disabled={isBusy}
                                    >
                                      {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4 mr-1" />}
                                      Reject
                                    </Button>
                                  </div>
                                  <Textarea
                                    value={rejectReasonById[r.id] || ""}
                                    onChange={(e) =>
                                      setRejectReasonById((prev) => ({ ...prev, [r.id]: e.target.value }))
                                    }
                                    placeholder="Reason for rejection (required to reject)"
                                    className="min-h-[60px]"
                                  />
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg">
                  <Calendar className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-lg">Approved requests</CardTitle>
                  <CardDescription>Approved leave requests in your department</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading…
                </div>
              ) : approved.length === 0 ? (
                <p className="text-sm text-muted-foreground">No approved leave requests.</p>
              ) : (
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Team member</TableHead>
                        <TableHead>Dates</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Reviewed</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {approved.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="align-top">
                            <div className="font-medium">{r.operator?.name || "—"}</div>
                            <div className="text-xs text-muted-foreground">{r.operator?.email || ""}</div>
                            <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.reason}</div>
                          </TableCell>
                          <TableCell className="align-top whitespace-nowrap">
                            <div className="text-sm">
                              {r.start_date} ({r.start_session}) → {r.end_date} ({r.end_session})
                            </div>
                          </TableCell>
                          <TableCell className="align-top">
                            <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white">Approved</Badge>
                          </TableCell>
                          <TableCell className="align-top whitespace-nowrap text-sm text-muted-foreground">
                            <div className="flex items-center justify-between gap-2">
                              <span>{r.reviewed_at ? new Date(r.reviewed_at).toLocaleString() : "—"}</span>
                              <Button size="sm" variant="outline" onClick={() => openCoverageEditorForApproved(r.id)}>
                                Map coverage
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-3xl border-border/60 shadow-lg shadow-violet-950/[0.06]">
            <CardHeader className="border-b border-border/60 bg-gradient-to-br from-violet-600/[0.08] via-background to-background">
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-violet-600" />
                Apply for leave
              </CardTitle>
              <CardDescription>
                Choose <span className="font-medium text-foreground">full day</span> or{" "}
                <span className="font-medium text-foreground">half day (FN/AN)</span>. The system will count it correctly.
                As OIC, your leave is recorded as approved and colleagues on your equipment, your department head (if
                set in admin), and any extra addresses configured for the deployment are emailed for information (no
                separate approval step).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 p-5 sm:p-6">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Leave type</Label>
                <ToggleGroup
                  type="single"
                  value={leaveType}
                  onValueChange={(v) => setLeaveType((v as LeaveType) || "FULL_DAY")}
                  className="justify-start flex-wrap"
                >
                  <ToggleGroupItem value="FULL_DAY" aria-label="Full day">
                    Full day
                  </ToggleGroupItem>
                  <ToggleGroupItem value="HALF_FN" aria-label="Half day forenoon">
                    Half day (FN)
                  </ToggleGroupItem>
                  <ToggleGroupItem value="HALF_AN" aria-label="Half day afternoon">
                    Half day (AN)
                  </ToggleGroupItem>
                  <ToggleGroupItem value="CUSTOM" aria-label="Custom">
                    Custom
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              <div className="rounded-2xl border border-border/60 bg-muted/10 p-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="leave-start-date">From</Label>
                    <Input
                      id="leave-start-date"
                      type="date"
                      className="h-11"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="leave-end-date">To</Label>
                    <Input
                      id="leave-end-date"
                      type="date"
                      className="h-11"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      From session
                    </Label>
                    <Select
                      value={startSession}
                      onValueChange={(v) => {
                        setLeaveType("CUSTOM");
                        setStartSession(v as LeaveSession);
                      }}
                      disabled={leaveType !== "CUSTOM"}
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FN">Forenoon</SelectItem>
                        <SelectItem value="AN">Afternoon</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      To session
                    </Label>
                    <Select
                      value={endSession}
                      onValueChange={(v) => {
                        setLeaveType("CUSTOM");
                        setEndSession(v as LeaveSession);
                      }}
                      disabled={leaveType !== "CUSTOM"}
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FN">Forenoon</SelectItem>
                        <SelectItem value="AN">Afternoon</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-muted-foreground">
                    This request will count as{" "}
                    <span className="font-semibold tabular-nums text-foreground">{leaveDaysPreview}</span>{" "}
                    day{leaveDaysPreview === 1 ? "" : "s"}.
                  </div>
                  {startDate === endDate && (startSession === "FN" || startSession === "AN") ? (
                    <Badge variant="secondary" className="tabular-nums">
                      {startSession === endSession ? (startSession === "FN" ? "Half day (FN)" : "Half day (AN)") : "Full day"}
                    </Badge>
                  ) : null}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="leave-reason">Reason</Label>
                <Input
                  id="leave-reason"
                  className="h-11"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Personal work / Medical"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="leave-attachment" className="flex items-center gap-2">
                  <Paperclip className="h-4 w-4 text-muted-foreground" />
                  Attachment (optional)
                </Label>
                <Input
                  id="leave-attachment"
                  type="file"
                  className="h-11"
                  onChange={(e) => setAttachment(e.target.files?.[0] ?? null)}
                />
                {attachment ? (
                  <p className="text-xs text-muted-foreground">
                    Attached: <span className="font-medium text-foreground">{attachment.name}</span>
                  </p>
                ) : null}
              </div>

              <Button
                className="h-11 w-full bg-violet-600 text-white hover:bg-violet-700"
                disabled={!canSubmit || submitting}
                onClick={async () => {
                  if (startDate === endDate && startSession === "AN" && endSession === "FN") {
                    toast.error("Invalid session range for the same day.");
                    return;
                  }
                  setSubmitting(true);
                  try {
                    const res = await apiClient.createOperatorLeaveRequest({
                      start_date: startDate,
                      end_date: endDate,
                      start_session: startSession,
                      end_session: endSession,
                      reason: reason.trim(),
                      attachment,
                    });
                    if (res.error) throw new Error(res.error);
                    toast.success(
                      res.data?.status === "APPROVED"
                        ? "Leave recorded. Designated contacts have been notified by email."
                        : "Leave request submitted to OIC.",
                    );
                    setReason("");
                    setAttachment(null);
                    setLeaveType("FULL_DAY");
                    await refresh(year);
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Failed to submit leave request.");
                  } finally {
                    setSubmitting(false);
                  }
                }}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  "Submit leave request"
                )}
              </Button>
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-3xl border-border/60 shadow-lg shadow-violet-950/[0.06]">
            <CardHeader className="border-b border-border/60 bg-muted/10">
              <CardTitle className="flex items-center justify-between gap-3">
                <span>Leave requests ({year})</span>
                <Badge variant="secondary" className="tabular-nums">
                  Total: {myLeaves.length}
                </Badge>
              </CardTitle>
              <CardDescription>Track your submitted leave requests and OIC decisions.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading…
                </div>
              ) : myLeaves.length === 0 ? (
                <div className="p-6">
                  <p className="text-sm text-muted-foreground">No leave requests found for {year}.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableHead>Dates</TableHead>
                        <TableHead>Count</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {myLeaves.map((r) => {
                        const count = computeLeaveDays(r.start_date, r.start_session, r.end_date, r.end_session);
                        const badge = statusBadgeVariant(r.status);
                        const statusNorm = String(r.status || "").toUpperCase();
                        return (
                          <TableRow key={r.id}>
                            <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                              <div className="font-medium text-foreground">
                                {r.start_date} ({r.start_session}) → {r.end_date} ({r.end_session})
                              </div>
                              {r.reviewed_at ? (
                                <div className="text-xs">
                                  Reviewed: {new Date(r.reviewed_at).toLocaleString()}
                                </div>
                              ) : null}
                            </TableCell>
                            <TableCell className="whitespace-nowrap tabular-nums font-semibold">
                              {count}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <Badge className={badge.className}>{badge.label}</Badge>
                                {statusNorm === "APPROVED" && isTodayWithinLeave(r) ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={async () => {
                                      try {
                                        const res = await apiClient.resumeOperatorLeaveRequest(r.id);
                                        if (res.error) throw new Error(res.error);
                                        toast.success(res.data?.message ?? "Duty resumed.");
                                        await refresh(year);
                                      } catch (e) {
                                        toast.error(e instanceof Error ? e.message : "Failed to resume duty.");
                                      }
                                    }}
                                  >
                                    Resume duty
                                  </Button>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell className="min-w-[18rem]">
                              <div className="text-sm text-foreground">{r.reason}</div>
                              {r.rejection_reason ? (
                                <div className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                                  Rejected reason: {r.rejection_reason}
                                </div>
                              ) : null}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5" />
                Temporary OIC (Leave)
              </CardTitle>
              <CardDescription>
                Assign another Officer in Charge (OIC) to manage an equipment while you are on leave.
                Resume time is computed automatically from your leave <span className="font-semibold">To</span> date/session.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={submitTempOicDelegation} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Equipment</Label>
                    <Select
                      value={tempOicSelectedEquipmentId}
                      onValueChange={setTempOicSelectedEquipmentId}
                      disabled={tempOicLoadingEquipments}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={tempOicLoadingEquipments ? "Loading..." : "Select equipment"} />
                      </SelectTrigger>
                      <SelectContent>
                        {tempOicEquipments.map((e) => (
                          <SelectItem key={e.id} value={String(e.id)}>
                            {e.code} – {e.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Temporary OIC</Label>
                    <Popover open={tempOicComboboxOpen} onOpenChange={setTempOicComboboxOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={tempOicComboboxOpen}
                          disabled={tempOicLoadingUsers}
                          className="w-full justify-between font-normal"
                        >
                          {tempOicLoadingUsers
                            ? "Loading..."
                            : tempOicSelectedUserId
                              ? (() => {
                                  const u = tempOicUsers.find((x) => String(x.id) === tempOicSelectedUserId);
                                  return u ? `${u.name || u.email} (${u.email})` : "Select OIC";
                                })()
                              : "Select OIC (search by name)…"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                        <Command shouldFilter={false}>
                          <CommandInput
                            placeholder="Search by name or email…"
                            value={tempOicSearchQuery}
                            onValueChange={setTempOicSearchQuery}
                          />
                          <CommandList>
                            <CommandEmpty>
                              {tempOicUsers.length === 0
                                ? "No other OIC users found."
                                : "No match."}
                            </CommandEmpty>
                            <CommandGroup>
                              {tempOicUsers
                                .filter((u) => {
                                  const q = tempOicSearchQuery.trim().toLowerCase();
                                  if (!q) return true;
                                  return (
                                    (u.name || "").toLowerCase().includes(q) ||
                                    (u.email || "").toLowerCase().includes(q)
                                  );
                                })
                                .map((u) => (
                                  <CommandItem
                                    key={u.id}
                                    value={String(u.id)}
                                    onSelect={() => {
                                      setTempOicSelectedUserId(String(u.id));
                                      setTempOicComboboxOpen(false);
                                      setTempOicSearchQuery("");
                                    }}
                                  >
                                    {u.name || u.email} ({u.email})
                                  </CommandItem>
                                ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div className="rounded-xl border bg-muted/20 p-3">
                  <div className="text-xs font-semibold text-muted-foreground">Computed resume time</div>
                  <div className="mt-1 flex items-center gap-2 text-sm">
                    <CalendarClock className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold">
                      {computedResumeAtIso(endDate, endSession) ? new Date(computedResumeAtIso(endDate, endSession) as string).toLocaleString() : "—"}
                    </span>
                    <span className="text-muted-foreground">
                      (from To date/session: {endDate || "—"} {endSession})
                    </span>
                  </div>
                </div>

                <Button type="submit" disabled={tempOicSubmitting}>
                  {tempOicSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Assigning...
                    </>
                  ) : (
                    "Assign temporary OIC"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle>Active delegations</CardTitle>
              <CardDescription>
                Delegations you have created. Cancel to revoke. (Edit is available for exceptional cases.)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {tempOicLoadingDelegations ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : tempOicDelegations.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No active temporary OIC delegations.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Equipment</TableHead>
                      <TableHead>Temporary OIC</TableHead>
                      <TableHead>Resume at</TableHead>
                      <TableHead className="w-[120px]">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tempOicDelegations.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell>
                          <span className="font-medium">{d.equipment_code}</span>
                          <span className="text-muted-foreground"> – {d.equipment_name}</span>
                        </TableCell>
                        <TableCell>
                          {d.temporary_oic_name}
                          <span className="text-muted-foreground text-xs block">{d.temporary_oic_email}</span>
                        </TableCell>
                        <TableCell>{format(new Date(d.resume_at), "PPp")}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Edit date & time"
                              onClick={() => openTempOicEditDialog(d)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => cancelTempOicDelegation(d.id)}
                              disabled={tempOicCancellingId === d.id}
                            >
                              {tempOicCancellingId === d.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <X className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Dialog open={tempOicEditingDelegationId != null} onOpenChange={(open) => !open && setTempOicEditingDelegationId(null)}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Edit resume date & time</DialogTitle>
                <DialogDescription>
                  Change when you will take over again. After this time, the temporary OIC will no longer be able to manage the equipment.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 py-2">
                <Label className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4" />
                  Resume date & time
                </Label>
                <Input
                  type="datetime-local"
                  value={tempOicEditResumeAt}
                  onChange={(e) => setTempOicEditResumeAt(e.target.value)}
                  className="w-full"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setTempOicEditingDelegationId(null)} disabled={tempOicSavingEditId != null}>
                  Cancel
                </Button>
                <Button onClick={saveTempOicEdit} disabled={tempOicSavingEditId != null || !tempOicEditResumeAt.trim()}>
                  {tempOicSavingEditId != null ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}

