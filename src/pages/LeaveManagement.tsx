import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { ArrowLeft, CalendarDays, Clock, Loader2, Paperclip } from "lucide-react";

import DashboardHeader from "@/components/DashboardHeader";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type LeaveSession = "FN" | "AN";
type LeaveType = "FULL_DAY" | "HALF_FN" | "HALF_AN" | "CUSTOM";

type LeaveRow = {
  id: number;
  equipment_id: number;
  equipment_code?: string | null;
  equipment_name?: string | null;
  start_date: string; // YYYY-MM-DD
  start_session: LeaveSession;
  end_date: string; // YYYY-MM-DD
  end_session: LeaveSession;
  reason: string;
  status: string;
  rejection_reason?: string | null;
  reviewed_at?: string | null;
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
  // If user somehow sets AN->FN on same date, treat as 0 (invalid), caller will block submit.
  if (isSame && startSession === "AN" && endSession === "FN") return 0;
  if (startSession === "AN") out -= 0.5;
  if (endSession === "FN") out -= 0.5;
  return clampLeaveCount(out);
}

export default function LeaveManagement() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userType = user?.user_type != null ? String(user.user_type).toLowerCase() : "";
  const isOperator = userType === "operator";

  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const [year, setYear] = useState<number>(currentYear);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [approvedDaysThisYear, setApprovedDaysThisYear] = useState<number>(0);
  const [leaves, setLeaves] = useState<LeaveRow[]>([]);

  // Apply leave form (global for operator; applies to all associated equipment)
  const [startDate, setStartDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [startSession, setStartSession] = useState<LeaveSession>("FN");
  const [endSession, setEndSession] = useState<LeaveSession>("AN");
  const [leaveType, setLeaveType] = useState<LeaveType>("FULL_DAY");
  const [reason, setReason] = useState<string>("");
  const [attachment, setAttachment] = useState<File | null>(null);

  useEffect(() => {
    if (!isOperator) {
      navigate("/dashboard");
      return;
    }
  }, [isOperator, navigate]);

  const refresh = async (y: number) => {
    setLoading(true);
    try {
      const [summaryRes, listRes] = await Promise.all([
        apiClient.getOperatorLeaveSummary({ year: y }),
        apiClient.listOperatorLeaveRequests({ year: y }),
      ]);
      if (summaryRes.error) throw new Error(summaryRes.error);
      if (listRes.error) throw new Error(listRes.error);
      setApprovedDaysThisYear(summaryRes.data?.approved_days_this_year ?? 0);
      setLeaves(listRes.data?.leaves ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load leave data.");
      setApprovedDaysThisYear(0);
      setLeaves([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOperator) return;
    refresh(year);
  }, [isOperator, year]);

  useEffect(() => {
    // Make half-day easy: selecting leaveType auto-sets dates/sessions.
    const today = format(new Date(), "yyyy-MM-dd");
    if (leaveType === "FULL_DAY") {
      setStartSession("FN");
      setEndSession("AN");
      if (!startDate) setStartDate(today);
      if (!endDate) setEndDate(today);
      return;
    }
    if (leaveType === "HALF_FN") {
      setStartDate((d) => d || today);
      setEndDate((d) => d || today);
      setStartSession("FN");
      setEndSession("FN");
      return;
    }
    if (leaveType === "HALF_AN") {
      setStartDate((d) => d || today);
      setEndDate((d) => d || today);
      setStartSession("AN");
      setEndSession("AN");
      return;
    }
    // CUSTOM: leave as-is
  }, [leaveType]); // eslint-disable-line react-hooks/exhaustive-deps

  const canSubmit = useMemo(() => {
    if (!startDate || !endDate) return false;
    if (!reason.trim() || reason.trim().length < 3) return false;
    // Same-day session sanity: AN->FN is invalid
    if (startDate === endDate && startSession === "AN" && endSession === "FN") return false;
    return true;
  }, [startDate, endDate, reason, startSession, endSession]);

  const leaveDaysPreview = useMemo(
    () => computeLeaveDays(startDate, startSession, endDate, endSession),
    [startDate, startSession, endDate, endSession],
  );

  const statusBadgeVariant = (s: string): { label: string; className: string } => {
    const u = String(s || "").toUpperCase();
    if (u === "APPROVED") return { label: "Approved", className: "bg-emerald-600 hover:bg-emerald-600 text-white" };
    if (u === "REJECTED") return { label: "Rejected", className: "bg-rose-600 hover:bg-rose-600 text-white" };
    if (u === "CANCELLED") return { label: "Cancelled", className: "bg-slate-600 hover:bg-slate-600 text-white" };
    return { label: "Pending", className: "bg-amber-600 hover:bg-amber-600 text-white" };
  };

  const isTodayWithinLeave = (r: LeaveRow): boolean => {
    const todayIso = format(new Date(), "yyyy-MM-dd");
    return todayIso >= r.start_date && todayIso <= r.end_date;
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-violet-600/[0.10] via-background to-background p-5 shadow-lg shadow-violet-950/[0.06] sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")} className="bg-background/70">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <div className="min-w-0">
                <h1 className="text-xl font-semibold tracking-tight text-foreground">Leave Management</h1>
                <p className="text-sm text-muted-foreground">
                  Apply quickly (full/half-day) and track approvals for the current year.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Year</Label>
              <Input
                type="number"
                className="w-28 bg-background/70"
                value={String(year)}
                onChange={(e) => setYear(Number(e.target.value || currentYear))}
                min={2000}
                max={2100}
              />
              <div className="rounded-2xl border border-border/60 bg-background/70 px-3 py-2">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Approved</div>
                <div className="text-lg font-bold tabular-nums text-foreground">
                  {loading ? "…" : approvedDaysThisYear}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <Card className="overflow-hidden rounded-3xl border-border/60 shadow-lg shadow-violet-950/[0.06]">
            <CardHeader className="border-b border-border/60 bg-gradient-to-br from-violet-600/[0.08] via-background to-background">
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-violet-600" />
                Apply for leave
              </CardTitle>
              <CardDescription>
                Choose <span className="font-medium text-foreground">full day</span> or{" "}
                <span className="font-medium text-foreground">half day (FN/AN)</span>. The system will count it correctly.
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
                    toast.success("Leave request submitted to OIC.");
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
                  Total: {leaves.length}
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
              ) : leaves.length === 0 ? (
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
                      {leaves.map((r) => {
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
        </div>
      </div>
    </div>
  );
}

