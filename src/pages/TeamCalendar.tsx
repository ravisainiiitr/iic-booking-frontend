import { Fragment, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { addDays, addMonths, addWeeks, format, parseISO } from "date-fns";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Loader2,
  Search,
  Users,
} from "lucide-react";

import DashboardHeader from "@/components/DashboardHeader";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { normalizeUserTypeCode } from "@/lib/userTypes";
import {
  ABSENCE_FILTER_KEYS,
  ABSENCE_META,
  AbsenceCategory,
  CellAbsence,
  HolidayMeta,
  LeaveRow,
  TeamMember,
  daysInMonth,
  daysInWeek,
  designationLabel,
  initialsFromName,
  isApprovedLeave,
  isWeekendMeta,
  monthForDate,
  resolveCellAbsence,
  reviewerRoleLabel,
  weekRangeLabel,
} from "@/lib/teamCalendar";

type ViewMode = "month" | "week" | "day";

type TeamCalendarPayload = {
  month: string;
  date_start: string;
  date_end: string;
  department_id?: number | null;
  department_name?: string | null;
  all_departments?: boolean;
  members: TeamMember[];
  leaves: LeaveRow[];
  holidays?: Record<string, HolidayMeta>;
};

type DeptOption = { id: number; name: string; code?: string };

const EMPTY_FILTERS: Record<AbsenceCategory, boolean> = {
  leave: true,
  training: true,
  official_duty: true,
  conference: true,
  holiday: true,
};

function AbsenceChip({
  absence,
  compact,
}: {
  absence: CellAbsence;
  compact?: boolean;
}) {
  const meta = ABSENCE_META[absence.category];
  const half =
    absence.kind === "half_fn" ? "FN" : absence.kind === "half_an" ? "AN" : null;
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-0.5 rounded-md border px-1.5 font-medium leading-tight",
        meta.chipClass,
        compact ? "py-0.5 text-[10px]" : "py-1 text-[11px]",
      )}
    >
      <span className="truncate">{compact ? meta.short : absence.label}</span>
      {half ? <span className="shrink-0 opacity-80">·{half}</span> : null}
    </span>
  );
}

function MemberIdentity({
  member,
  showDepartment,
}: {
  member: TeamMember;
  showDepartment?: boolean;
}) {
  const designation = designationLabel(member.user_type);
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar className="h-9 w-9 border border-border/60">
        <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
          {initialsFromName(member.name, member.email)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-foreground">
          {member.name || member.email}
        </div>
        {designation ? (
          <div className="truncate text-[11px] text-muted-foreground">{designation}</div>
        ) : null}
        <div className="truncate text-[11px] text-muted-foreground/90">{member.email}</div>
        {showDepartment && member.department_name ? (
          <div className="truncate text-[10px] text-muted-foreground/80">
            {member.department_name}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function HoverDetails({
  member,
  dayIso,
  absence,
}: {
  member: TeamMember;
  dayIso: string;
  absence: CellAbsence;
}) {
  const leave = absence.leave;
  return (
    <div className="space-y-1.5 text-xs">
      <div className="font-semibold">{member.name || member.email}</div>
      <div>{absence.label}</div>
      <div className="text-muted-foreground">{format(parseISO(dayIso), "d MMM yyyy")}</div>
      {leave?.reason ? (
        <div className="text-muted-foreground line-clamp-3">{leave.reason}</div>
      ) : null}
      {leave?.reviewed_by_name ? (
        <div className="pt-1 text-muted-foreground">
          Approved by
          <div className="font-medium text-foreground">{leave.reviewed_by_name}</div>
          <div>{reviewerRoleLabel(leave.reviewed_by_role)}</div>
        </div>
      ) : null}
      {member.email ? (
        <div className="pt-1 text-muted-foreground">
          Contact
          <div className="font-medium text-foreground">{member.email}</div>
        </div>
      ) : null}
    </div>
  );
}

export default function TeamCalendar() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userType = normalizeUserTypeCode(user?.user_type) || "";
  const isMainAdmin = userType === "admin";
  const canView =
    userType === "manager" ||
    userType === "admin" ||
    userType === "operator" ||
    userType === "dept_admin";

  const [month, setMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [focusDay, setFocusDay] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [holidays, setHolidays] = useState<Record<string, HolidayMeta>>({});
  const [departmentLabel, setDepartmentLabel] = useState<string>("");
  const [allDepartments, setAllDepartments] = useState(false);

  const [deptOptions, setDeptOptions] = useState<DeptOption[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<"all" | number>("all");
  const [deptOpen, setDeptOpen] = useState(false);
  const [memberQuery, setMemberQuery] = useState("");
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  const monthDays = useMemo(() => daysInMonth(month), [month]);
  const weekDays = useMemo(() => daysInWeek(focusDay), [focusDay]);
  const visibleDays = viewMode === "week" ? weekDays : monthDays;

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
  }, [canView, navigate]);

  useEffect(() => {
    if (!isMainAdmin) return;
    apiClient
      .getDepartments()
      .then((res) => {
        if (res.error) throw new Error(res.error);
        const list = (res.data?.departments ?? [])
          .map((d) => ({ id: d.id, name: d.name, code: d.code }))
          .sort((a, b) => a.name.localeCompare(b.name));
        setDeptOptions(list);
      })
      .catch(() => setDeptOptions([]));
  }, [isMainAdmin]);

  useEffect(() => {
    if (!canView) return;
    setLoading(true);
    const opts: { month: string; department_id?: number } = { month };
    if (isMainAdmin && selectedDeptId !== "all") {
      opts.department_id = selectedDeptId;
    }
    // Main admin + "all" → omit department_id so API returns all departments.
    apiClient
      .getTeamCalendarDepartment(opts)
      .then((res) => {
        if (res.error) throw new Error(res.error);
        const data = res.data as TeamCalendarPayload | undefined;
        setMembers(data?.members ?? []);
        setLeaves(
          ((data?.leaves ?? []) as LeaveRow[]).filter(isApprovedLeave),
        );
        setHolidays(data?.holidays ?? {});
        setAllDepartments(Boolean(data?.all_departments));
        setDepartmentLabel(
          data?.all_departments
            ? "All Departments"
            : data?.department_name || user?.department_name || "Your department",
        );
      })
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : "Failed to load team calendar.");
        setMembers([]);
        setLeaves([]);
        setHolidays({});
      })
      .finally(() => setLoading(false));
  }, [canView, month, isMainAdmin, selectedDeptId, user?.department_name]);

  // Keep focus day inside selected month for month/day modes.
  useEffect(() => {
    if (!focusDay.startsWith(month)) {
      const today = format(new Date(), "yyyy-MM-dd");
      setFocusDay(today.startsWith(month) ? today : `${month}-01`);
    }
  }, [month, focusDay]);

  const leavesByMember = useMemo(() => {
    const map = new Map<number, LeaveRow[]>();
    for (const l of leaves) {
      const arr = map.get(l.operator_id) ?? [];
      arr.push(l);
      map.set(l.operator_id, arr);
    }
    return map;
  }, [leaves]);

  const filteredMembers = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => {
      const hay = `${m.name} ${m.email} ${m.department_name ?? ""} ${designationLabel(m.user_type)}`.toLowerCase();
      return hay.includes(q);
    });
  }, [members, memberQuery]);

  const getHoliday = (dayIso: string) => holidays[dayIso] ?? null;

  const cellFor = (member: TeamMember, dayIso: string): CellAbsence | null => {
    const absence = resolveCellAbsence(
      dayIso,
      leavesByMember.get(member.id) ?? [],
      getHoliday(dayIso),
      filters.holiday,
    );
    if (!absence) return null;
    if (!filters[absence.category]) return null;
    return absence;
  };

  const todayIso = format(new Date(), "yyyy-MM-dd");

  const summary = useMemo(() => {
    let unavailableToday = 0;
    let onLeave = 0;
    let training = 0;
    let conference = 0;
    const countsInRange = (days: string[]) => {
      const seenLeave = new Set<number>();
      const seenTraining = new Set<number>();
      const seenConf = new Set<number>();
      for (const m of filteredMembers) {
        for (const d of days) {
          const a = resolveCellAbsence(
            d,
            leavesByMember.get(m.id) ?? [],
            holidays[d],
            filters.holiday,
          );
          if (!a || !filters[a.category]) continue;
          if (a.category === "leave") seenLeave.add(m.id);
          if (a.category === "training") seenTraining.add(m.id);
          if (a.category === "conference") seenConf.add(m.id);
        }
      }
      return {
        onLeave: seenLeave.size,
        training: seenTraining.size,
        conference: seenConf.size,
      };
    };
    for (const m of filteredMembers) {
      const a = resolveCellAbsence(
        todayIso,
        leavesByMember.get(m.id) ?? [],
        holidays[todayIso],
        filters.holiday,
      );
      if (a && filters[a.category]) unavailableToday += 1;
    }
    const range =
      viewMode === "week"
        ? weekDays
        : viewMode === "day"
          ? [focusDay]
          : monthDays;
    const counts = countsInRange(range);
    onLeave = counts.onLeave;
    training = counts.training;
    conference = counts.conference;
    return {
      members: filteredMembers.length,
      unavailableToday,
      onLeave,
      training,
      conference,
    };
  }, [
    filteredMembers,
    leavesByMember,
    holidays,
    filters,
    todayIso,
    viewMode,
    weekDays,
    focusDay,
    monthDays,
  ]);

  const selectedDeptLabel =
    selectedDeptId === "all"
      ? "All Departments"
      : deptOptions.find((d) => d.id === selectedDeptId)?.name || "Department";

  const goPrev = () => {
    if (viewMode === "week") {
      const next = format(addWeeks(parseISO(focusDay), -1), "yyyy-MM-dd");
      setFocusDay(next);
      setMonth(monthForDate(next));
    } else if (viewMode === "day") {
      const next = format(addDays(parseISO(focusDay), -1), "yyyy-MM-dd");
      setFocusDay(next);
      setMonth(monthForDate(next));
    } else {
      setMonth(format(addMonths(parseISO(`${month}-01`), -1), "yyyy-MM"));
    }
  };

  const goNext = () => {
    if (viewMode === "week") {
      const next = format(addWeeks(parseISO(focusDay), 1), "yyyy-MM-dd");
      setFocusDay(next);
      setMonth(monthForDate(next));
    } else if (viewMode === "day") {
      const next = format(addDays(parseISO(focusDay), 1), "yyyy-MM-dd");
      setFocusDay(next);
      setMonth(monthForDate(next));
    } else {
      setMonth(format(addMonths(parseISO(`${month}-01`), 1), "yyyy-MM"));
    }
  };

  const goToday = () => {
    const now = new Date();
    setMonth(format(now, "yyyy-MM"));
    setFocusDay(format(now, "yyyy-MM-dd"));
  };

  const periodTitle =
    viewMode === "week"
      ? weekRangeLabel(weekDays)
      : viewMode === "day"
        ? format(parseISO(focusDay), "EEEE, d MMMM yyyy")
        : monthLabel;

  const stickyMemberWidth = allDepartments || isMainAdmin ? "minmax(280px, 300px)" : "minmax(240px, 280px)";
  const dayColMin = viewMode === "week" ? "minmax(120px, 1fr)" : "minmax(44px, 1fr)";

  return (
    <div className="page-shell">
      <DashboardHeader />
      <TooltipProvider delayDuration={200}>
        <div className="mx-auto max-w-[min(1600px,98vw)] px-4 py-6 sm:px-6 sm:py-8">
          {/* Header */}
          <div className="mb-5 rounded-2xl border border-border/50 bg-gradient-to-br from-primary via-primary to-accent p-4 text-white shadow-lg sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("/dashboard")}
                  className="shrink-0 text-white/90 hover:bg-white/15 hover:text-white"
                  aria-label="Back to dashboard"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <div className="min-w-0">
                  <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Team Calendar</h1>
                  <p className="mt-1 max-w-xl text-sm text-white/85">
                    Spot leave and other absences quickly — empty cells mean available.
                  </p>
                  <p className="mt-1 text-xs text-white/70">{departmentLabel}</p>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:items-end">
                <div className="flex flex-wrap items-center gap-2">
                  <div
                    className="inline-flex rounded-xl border border-white/20 bg-white/10 p-1"
                    role="tablist"
                    aria-label="Calendar view"
                  >
                    {(["day", "week", "month"] as ViewMode[]).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        role="tab"
                        aria-selected={viewMode === mode}
                        onClick={() => setViewMode(mode)}
                        className={cn(
                          "rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition",
                          viewMode === mode
                            ? "bg-white text-primary shadow-sm"
                            : "text-white/85 hover:bg-white/10",
                        )}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="bg-white/15 text-white border-0 hover:bg-white/25"
                    onClick={goPrev}
                    aria-label="Previous period"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="min-w-[10rem] rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-center text-sm font-semibold">
                    {viewMode === "month" ? (
                      <span>← {monthLabel} →</span>
                    ) : (
                      periodTitle
                    )}
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="bg-white/15 text-white border-0 hover:bg-white/25"
                    onClick={goNext}
                    aria-label="Next period"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="bg-white/15 text-white border-0 hover:bg-white/25"
                    onClick={goToday}
                  >
                    Today
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="bg-white/15 text-white border-0 hover:bg-white/25"
                    onClick={() => {
                      setViewMode("month");
                      goToday();
                    }}
                  >
                    This Month
                  </Button>
                  <Label htmlFor="jump-month" className="sr-only">
                    Jump to month
                  </Label>
                  <Input
                    id="jump-month"
                    type="month"
                    value={month}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (!v) return;
                      setMonth(v);
                      setFocusDay(`${v}-01`);
                      setViewMode("month");
                    }}
                    className="h-9 w-[9.5rem] border-white/25 bg-white/10 text-white placeholder:text-white/60 focus-visible:ring-white/40"
                    aria-label="Jump to month"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_auto]">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              {isMainAdmin ? (
                <div className="min-w-[16rem] flex-1 space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Department</Label>
                  <Popover open={deptOpen} onOpenChange={setDeptOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={deptOpen}
                        className="w-full justify-between rounded-xl border-border/70 bg-card font-normal"
                      >
                        <span className="truncate">{selectedDeptLabel}</span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search departments…" />
                        <CommandList>
                          <CommandEmpty>No department found.</CommandEmpty>
                          <CommandGroup>
                            <CommandItem
                              value="All Departments"
                              onSelect={() => {
                                setSelectedDeptId("all");
                                setDeptOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedDeptId === "all" ? "opacity-100" : "opacity-0",
                                )}
                              />
                              All Departments
                            </CommandItem>
                            {deptOptions.map((d) => (
                              <CommandItem
                                key={d.id}
                                value={`${d.name} ${d.code ?? ""}`}
                                onSelect={() => {
                                  setSelectedDeptId(d.id);
                                  setDeptOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedDeptId === d.id ? "opacity-100" : "opacity-0",
                                  )}
                                />
                                {d.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              ) : null}

              <div className="min-w-[14rem] flex-1 space-y-1.5">
                <Label htmlFor="member-search" className="text-xs font-medium text-muted-foreground">
                  Search members
                </Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="member-search"
                    value={memberQuery}
                    onChange={(e) => setMemberQuery(e.target.value)}
                    placeholder="Name, email, role…"
                    className="rounded-xl border-border/70 bg-card pl-9"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card/80 px-3 py-2.5">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Show
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {ABSENCE_FILTER_KEYS.map((key) => (
                  <label key={key} className="inline-flex cursor-pointer items-center gap-2 text-xs">
                    <Checkbox
                      checked={filters[key]}
                      onCheckedChange={(v) =>
                        setFilters((prev) => ({ ...prev, [key]: v === true }))
                      }
                      aria-label={`Show ${ABSENCE_META[key].label}`}
                    />
                    <span className={cn("inline-block h-2.5 w-2.5 rounded-sm", ABSENCE_META[key].swatchClass)} />
                    {ABSENCE_META[key].label}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
            {[
              { label: "Department Members", value: summary.members, icon: Users },
              { label: "Unavailable Today", value: summary.unavailableToday, icon: CalendarDays },
              { label: "On Leave", value: summary.onLeave },
              { label: "Training", value: summary.training },
              { label: "Conference", value: summary.conference },
            ].map((s) => (
              <Card key={s.label} className="rounded-2xl border-border/60 shadow-sm">
                <CardContent className="p-3 sm:p-4">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {s.label}
                  </div>
                  <div className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                    {s.value}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Legend */}
          <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground/80">Legend</span>
            {ABSENCE_FILTER_KEYS.map((key) => (
              <span key={key} className="inline-flex items-center gap-1.5">
                <span className={cn("inline-block h-2.5 w-2.5 rounded-sm", ABSENCE_META[key].swatchClass)} />
                {ABSENCE_META[key].label}
              </span>
            ))}
            <span className="text-muted-foreground/80">Empty cell = Available</span>
          </div>

          <Card className="overflow-hidden rounded-2xl border-border/60 shadow-md">
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading team calendar…
                </div>
              ) : filteredMembers.length === 0 ? (
                <div className="p-8 text-sm text-muted-foreground">
                  No team members found for this selection.
                </div>
              ) : viewMode === "day" ? (
                <div className="divide-y divide-border/50">
                  <div className="bg-muted/20 px-4 py-3 text-sm font-semibold">
                    {format(parseISO(focusDay), "EEEE, d MMMM yyyy")}
                    {getHoliday(focusDay)?.reason ? (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        · {getHoliday(focusDay)?.reason}
                      </span>
                    ) : null}
                  </div>
                  {filteredMembers.map((member) => {
                    const absence = cellFor(member, focusDay);
                    return (
                      <div
                        key={member.id}
                        className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <MemberIdentity member={member} showDepartment={allDepartments} />
                        <div className="sm:text-right">
                          {absence ? (
                            <div className="space-y-1">
                              <AbsenceChip absence={absence} />
                              {absence.leave?.reason ? (
                                <div className="max-w-sm text-xs text-muted-foreground sm:ml-auto">
                                  {absence.leave.reason}
                                </div>
                              ) : null}
                              <div className="text-xs text-muted-foreground">{member.email}</div>
                            </div>
                          ) : (
                            <div className="text-sm text-muted-foreground">Available</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <>
                  {/* Desktop / tablet grid */}
                  <div className="hidden overflow-auto md:block" style={{ maxHeight: "min(70vh, 820px)" }}>
                    <div
                      className="min-w-max"
                      style={{
                        display: "grid",
                        gridTemplateColumns: `${stickyMemberWidth} repeat(${visibleDays.length}, ${dayColMin})`,
                      }}
                    >
                      <div className="sticky left-0 top-0 z-30 border-b border-r border-border/60 bg-background/95 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur">
                        Team members
                        <div className="mt-0.5 normal-case tracking-normal text-[10px] font-normal">
                          {filteredMembers.length} shown
                        </div>
                      </div>
                      {visibleDays.map((d) => {
                        const h = getHoliday(d);
                        const weekend = isWeekendMeta(h);
                        const isToday = d === todayIso;
                        return (
                          <div
                            key={`h-${d}`}
                            className={cn(
                              "sticky top-0 z-20 border-b border-r border-border/50 px-1.5 py-2 text-center backdrop-blur",
                              weekend ? "bg-slate-50/90" : "bg-background/95",
                              isToday && "ring-1 ring-inset ring-primary/30",
                            )}
                            title={h?.reason || d}
                          >
                            <div className="text-[11px] font-bold tabular-nums text-foreground">
                              {format(parseISO(d), "d")}
                            </div>
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                              {format(parseISO(d), "EEE")}
                            </div>
                            {h?.kind === "holiday" ? (
                              <div className="mt-0.5 truncate text-[9px] text-slate-600" title={h.reason}>
                                {h.reason}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}

                      {filteredMembers.map((member) => (
                        <Fragment key={member.id}>
                          <div className="sticky left-0 z-10 border-b border-r border-border/50 bg-background/95 px-3 py-2.5 backdrop-blur">
                            <MemberIdentity member={member} showDepartment={allDepartments} />
                          </div>
                          {visibleDays.map((day) => {
                            const absence = cellFor(member, day);
                            const weekend = isWeekendMeta(getHoliday(day));
                            return (
                              <div
                                key={`${member.id}-${day}`}
                                className={cn(
                                  "border-b border-r border-border/40 px-1 py-1.5",
                                  weekend && "bg-slate-50/70",
                                  day === todayIso && "bg-primary/[0.03]",
                                )}
                              >
                                {absence ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        type="button"
                                        className="flex w-full justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        aria-label={`${member.name || member.email}: ${absence.label} on ${day}`}
                                      >
                                        <AbsenceChip absence={absence} compact={viewMode === "month"} />
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-xs">
                                      <HoverDetails member={member} dayIso={day} absence={absence} />
                                    </TooltipContent>
                                  </Tooltip>
                                ) : (
                                  <span className="sr-only">Available</span>
                                )}
                              </div>
                            );
                          })}
                        </Fragment>
                      ))}
                    </div>
                  </div>

                  {/* Mobile: stacked cards emphasizing absences */}
                  <div className="space-y-3 p-3 md:hidden">
                    {filteredMembers.map((member) => {
                      const absences = visibleDays
                        .map((day) => {
                          const absence = cellFor(member, day);
                          return absence ? { day, absence } : null;
                        })
                        .filter(Boolean) as Array<{ day: string; absence: CellAbsence }>;
                      return (
                        <div
                          key={member.id}
                          className="rounded-2xl border border-border/60 bg-card p-3 shadow-sm"
                        >
                          <MemberIdentity member={member} showDepartment={allDepartments} />
                          {absences.length === 0 ? (
                            <p className="mt-3 text-xs text-muted-foreground">
                              No absences in this {viewMode === "week" ? "week" : "month"}.
                            </p>
                          ) : (
                            <ul className="mt-3 space-y-2">
                              {absences.map(({ day, absence }) => (
                                <li
                                  key={`${member.id}-${day}`}
                                  className="flex items-start justify-between gap-2 rounded-xl bg-muted/30 px-2.5 py-2"
                                >
                                  <div>
                                    <div className="text-xs font-semibold">
                                      {format(parseISO(day), "EEE, d MMM")}
                                    </div>
                                    {absence.leave?.reason ? (
                                      <div className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2">
                                        {absence.leave.reason}
                                      </div>
                                    ) : null}
                                  </div>
                                  <AbsenceChip absence={absence} />
                                </li>
                              ))}
                            </ul>
                          )}
                          <button
                            type="button"
                            className="mt-2 inline-flex items-center text-[11px] font-medium text-primary"
                            onClick={() => {
                              setViewMode("day");
                              setFocusDay(
                                absences[0]?.day ||
                                  (todayIso.startsWith(month) ? todayIso : `${month}-01`),
                              );
                            }}
                          >
                            Day details
                            <ChevronDown className="ml-1 h-3 w-3 -rotate-90" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </TooltipProvider>
    </div>
  );
}
