import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { addMonths, format, parseISO, startOfMonth } from "date-fns";
import { toast } from "sonner";
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, Users } from "lucide-react";

import DashboardHeader from "@/components/DashboardHeader";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type LeaveSession = "FN" | "AN";
type LeaveRow = {
  id: number;
  operator_id: number;
  operator_name: string;
  start_date: string;
  start_session: LeaveSession;
  end_date: string;
  end_session: LeaveSession;
  status: string;
  reason: string;
};

type TeamCalendarPayload = {
  month: string;
  date_start: string;
  date_end: string;
  members: Array<{ id: number; name: string; email: string; user_type?: string }>;
  leaves: LeaveRow[];
  holidays?: Record<string, { reason: string; color: string }>;
};

function daysInMonth(ym: string): string[] {
  const d0 = startOfMonth(parseISO(`${ym}-01`));
  const out: string[] = [];
  const year = d0.getFullYear();
  const month = d0.getMonth();
  let d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    out.push(format(d, "yyyy-MM-dd"));
    d = new Date(year, month, d.getDate() + 1);
  }
  return out;
}

function leaveCoversDay(l: LeaveRow, dayIso: string): { kind: "none" | "full" | "half_fn" | "half_an"; label: string } {
  if (dayIso < l.start_date || dayIso > l.end_date) return { kind: "none", label: "" };
  if (l.start_date === l.end_date) {
    if (l.start_session === "FN" && l.end_session === "FN") return { kind: "half_fn", label: "FN" };
    if (l.start_session === "AN" && l.end_session === "AN") return { kind: "half_an", label: "AN" };
    return { kind: "full", label: "Availability" };
  }
  if (dayIso === l.start_date) return l.start_session === "AN" ? { kind: "half_an", label: "AN" } : { kind: "full", label: "Availability" };
  if (dayIso === l.end_date) return l.end_session === "FN" ? { kind: "half_fn", label: "FN" } : { kind: "full", label: "Availability" };
  return { kind: "full", label: "Availability" };
}

function cellClass(status: string, kind: "full" | "half_fn" | "half_an") {
  const u = String(status || "").toUpperCase();
  const base = "rounded-md px-2 py-1 text-[11px] font-semibold text-white shadow-sm";
  const palette =
    u === "APPROVED"
      ? "bg-emerald-600"
      : u === "CANCELLED"
        ? "bg-slate-600"
        : "bg-amber-600";
  const half = kind === "full" ? "" : "opacity-90";
  return cn(base, palette, half);
}

export default function TeamCalendar() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userType = user?.user_type != null ? String(user.user_type).toLowerCase() : "";
  const canView = userType === "manager" || userType === "admin" || userType === "operator";

  const [month, setMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const [loading, setLoading] = useState(true);
  const [operators, setOperators] = useState<Array<{ id: number; name: string; email: string; user_type?: string }>>([]);
  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [holidays, setHolidays] = useState<Record<string, { reason: string; color: string }>>({});

  const days = useMemo(() => daysInMonth(month), [month]);
  const monthLabel = useMemo(() => {
    try {
      return format(parseISO(`${month}-01`), "MMMM yyyy");
    } catch {
      return month;
    }
  }, [month]);

  useEffect(() => {
    if (!canView) {
      navigate("/dashboard");
      return;
    }
    setLoading(true);
    apiClient
      .getTeamCalendarDepartment({ month })
      .then((res) => {
        if (res.error) throw new Error(res.error);
        // Backend returns department "members" (non-student/faculty/admin) for the roster.
        const data = res.data as TeamCalendarPayload | undefined;
        setOperators(data?.members ?? []);
        setLeaves(((res.data?.leaves ?? []) as LeaveRow[]).filter(
          (l) => String(l.status || "").toUpperCase() !== "REJECTED"
        ));
        setHolidays(data?.holidays ?? {});
      })
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : "Failed to load team calendar.");
        setOperators([]);
        setLeaves([]);
        setHolidays({});
      })
      .finally(() => setLoading(false));
  }, [canView, month, navigate]);

  const leavesByOperator = useMemo(() => {
    const map = new Map<number, LeaveRow[]>();
    for (const l of leaves) {
      const arr = map.get(l.operator_id) ?? [];
      arr.push(l);
      map.set(l.operator_id, arr);
    }
    return map;
  }, [leaves]);

  const holidayMetaForDay = useMemo(() => {
    return (dayIso: string): { reason: string; color: string } | null => {
      const v = holidays?.[dayIso];
      if (!v) return null;
      return { reason: v.reason || "Holiday", color: v.color || "#e5e7eb" };
    };
  }, [holidays]);

  return (
    <div className="page-shell">
      <DashboardHeader />
      <div className="mx-auto max-w-[min(1600px,98vw)] px-4 py-8 sm:px-6">
        <div className="mb-6 rounded-2xl bg-gradient-to-r from-teal-800 via-teal-700 to-cyan-700 p-5 sm:p-6 text-white shadow-xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3 min-w-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/dashboard")}
                className="shrink-0 text-white/90 hover:text-white hover:bg-white/20"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <div className="min-w-0">
                <h1 className="text-xl font-semibold tracking-tight">Team Calendar</h1>
                <p className="text-sm text-white/85">
                  Department-wide availability visibility for Lab Operators (Pending/Approved).
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="secondary"
                size="sm"
                className="bg-white/15 text-white border-0 hover:bg-white/25"
                onClick={() => setMonth(format(addMonths(parseISO(`${month}-01`), -1), "yyyy-MM"))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="rounded-xl border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold tabular-nums">
                {month}
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="bg-white/15 text-white border-0 hover:bg-white/25"
                onClick={() => setMonth(format(addMonths(parseISO(`${month}-01`), 1), "yyyy-MM"))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="bg-white/15 text-white border-0 hover:bg-white/25"
                onClick={() => setMonth(format(new Date(), "yyyy-MM"))}
              >
                This month
              </Button>
            </div>
          </div>
        </div>

        <Card className="overflow-hidden rounded-3xl border-border/60 shadow-lg shadow-violet-950/[0.06]">
          <CardHeader className="border-b border-border/60 bg-muted/10">
            <CardTitle className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                <Users className="h-5 w-5 text-violet-600" />
                Availability roster for {monthLabel}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-amber-600 hover:bg-amber-600 text-white">Pending</Badge>
                <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white">Approved</Badge>
              </div>
            </CardTitle>
            <CardDescription>Each cell shows the availability status for that operator on that day (FN/AN for half-day).</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading…
              </div>
            ) : operators.length === 0 ? (
              <div className="p-6">
                <p className="text-sm text-muted-foreground">No operators found for your department.</p>
              </div>
            ) : (
              <div className="overflow-auto">
                <div className="min-w-[1700px] isolate">
                  <div className="grid" style={{ gridTemplateColumns: `300px repeat(${days.length}, minmax(86px, 1fr))` }}>
                    <div className="sticky left-0 z-50 border-b border-r border-border/60 bg-background/98 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur-sm shadow-sm">
                      #
                      <span className="ml-2">Team members</span>
                    </div>
                    {days.map((d) => (
                      <div
                        key={d}
                        className={cn(
                          "border-b border-r border-border/60 bg-background/95 px-2 py-2 text-center text-[10px] font-semibold text-muted-foreground",
                        )}
                        title={d}
                        style={(() => {
                          const h = holidayMetaForDay(d);
                          return h ? { backgroundColor: h.color } : undefined;
                        })()}
                      >
                        <div className="text-[10px] font-bold tabular-nums text-foreground/80">{d.slice(-2)}</div>
                        <div className="text-[9px] uppercase tracking-wide">
                          {format(parseISO(d), "EEE")}
                        </div>
                        {holidayMetaForDay(d)?.reason ? (
                          <div className="mt-0.5 text-[9px] font-medium leading-tight text-foreground/75 truncate" title={holidayMetaForDay(d)?.reason}>
                            {holidayMetaForDay(d)?.reason}
                          </div>
                        ) : null}
                      </div>
                    ))}
                    {operators.map((op, idx) => {
                      const opLeaves = leavesByOperator.get(op.id) ?? [];
                      return (
                        <>
                          <div
                            key={`op-${op.id}`}
                            className="sticky left-0 z-40 border-b border-r border-border/60 bg-background/98 px-4 py-3 backdrop-blur-sm shadow-[2px_0_0_0_rgba(0,0,0,0.03)]"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="shrink-0 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-muted text-xs font-bold tabular-nums text-foreground/80">
                                {idx + 1}
                              </span>
                              <div className="min-w-0">
                                <div className="font-semibold text-foreground truncate">{op.name || op.email}</div>
                                <div className="text-xs text-muted-foreground truncate">{op.email}</div>
                              </div>
                            </div>
                          </div>
                          {days.map((day) => {
                            const match = opLeaves.find((l) => day >= l.start_date && day <= l.end_date);
                            if (!match) {
                              const h = holidayMetaForDay(day);
                              return (
                                <div
                                  key={`${op.id}-${day}`}
                                  className={cn(
                                    "border-b border-r border-border/60 px-1 py-2",
                                  )}
                                  style={h ? { backgroundColor: h.color } : undefined}
                                  title={h ? h.reason : undefined}
                                />
                              );
                            }
                            const coverage = leaveCoversDay(match, day);
                            if (coverage.kind === "none") {
                              const h = holidayMetaForDay(day);
                              return (
                                <div
                                  key={`${op.id}-${day}`}
                                  className={cn(
                                    "border-b border-r border-border/60 px-1 py-2",
                                  )}
                                  style={h ? { backgroundColor: h.color } : undefined}
                                  title={h ? h.reason : undefined}
                                />
                              );
                            }
                            const label = coverage.kind === "full" ? "" : coverage.label;
                            const h = holidayMetaForDay(day);
                            return (
                              <div
                                key={`${op.id}-${day}`}
                                className={cn("border-b border-r border-border/60 px-1 py-2")}
                                style={h ? { backgroundColor: h.color } : undefined}
                                title={`${op.name || op.email}\n${day}\n${match.status}\n${match.reason}${h?.reason ? `\n${h.reason}` : ""}`}
                              >
                                <div
                                  className={cn(
                                    cellClass(match.status, coverage.kind === "full" ? "full" : coverage.kind),
                                    "w-full text-center",
                                  )}
                                >
                                  {String(match.status).toUpperCase() === "APPROVED" ? "Approved" : "Pending"}
                                  {label ? ` · ${label}` : ""}
                                </div>
                              </div>
                            );
                          })}
                        </>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

