import { addDays, format, parseISO, startOfMonth, startOfWeek, endOfWeek } from "date-fns";
import { USER_TYPE_DISPLAY_NAMES, normalizeUserTypeCode } from "@/lib/userTypes";

export type LeaveSession = "FN" | "AN";

export type LeaveRow = {
  id: number;
  operator_id: number;
  operator_name: string;
  start_date: string;
  start_session: LeaveSession;
  end_date: string;
  end_session: LeaveSession;
  status: string;
  reason: string;
  rejection_reason?: string | null;
  reviewed_by_name?: string;
  reviewed_by_role?: string;
};

export type TeamMember = {
  id: number;
  name: string;
  email: string;
  user_type?: string;
  department_id?: number | null;
  department_name?: string;
};

export type HolidayMeta = {
  reason: string;
  color: string;
  kind?: "holiday" | "weekend" | string;
};

export type AbsenceCategory =
  | "leave"
  | "training"
  | "conference"
  | "official_duty"
  | "holiday";

export type CoverageKind = "none" | "full" | "half_fn" | "half_an";

export type CellAbsence = {
  category: AbsenceCategory;
  label: string;
  kind: Exclude<CoverageKind, "none">;
  leave?: LeaveRow;
  holidayReason?: string;
};

export const ABSENCE_FILTER_KEYS: AbsenceCategory[] = [
  "leave",
  "training",
  "official_duty",
  "conference",
  "holiday",
];

export const ABSENCE_META: Record<
  AbsenceCategory,
  { label: string; short: string; chipClass: string; swatchClass: string }
> = {
  leave: {
    label: "Leave",
    short: "Leave",
    chipClass: "bg-rose-100 text-rose-800 border-rose-200/80",
    swatchClass: "bg-rose-300",
  },
  training: {
    label: "Training",
    short: "Training",
    chipClass: "bg-amber-100 text-amber-900 border-amber-200/80",
    swatchClass: "bg-amber-300",
  },
  conference: {
    label: "Conference",
    short: "Conference",
    chipClass: "bg-violet-100 text-violet-900 border-violet-200/80",
    swatchClass: "bg-violet-300",
  },
  official_duty: {
    label: "Official Duty",
    short: "Duty",
    chipClass: "bg-sky-100 text-sky-900 border-sky-200/80",
    swatchClass: "bg-sky-300",
  },
  holiday: {
    label: "Holiday",
    short: "Holiday",
    chipClass: "bg-slate-100 text-slate-700 border-slate-200/80",
    swatchClass: "bg-slate-300",
  },
};

export function daysInMonth(ym: string): string[] {
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

export function daysInWeek(anchorIso: string): string[] {
  const anchor = parseISO(anchorIso);
  const start = startOfWeek(anchor, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => format(addDays(start, i), "yyyy-MM-dd"));
}

export function weekRangeLabel(days: string[]): string {
  if (!days.length) return "";
  const a = parseISO(days[0]);
  const b = parseISO(days[days.length - 1]);
  if (a.getMonth() === b.getMonth()) {
    return `${format(a, "d")}–${format(b, "d MMM yyyy")}`;
  }
  return `${format(a, "d MMM")} – ${format(b, "d MMM yyyy")}`;
}

export function initialsFromName(name: string, email?: string): string {
  const base = (name || email || "?").trim();
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }
  return base.slice(0, 2).toUpperCase();
}

export function designationLabel(userType?: string): string {
  const code = normalizeUserTypeCode(userType) || "";
  return USER_TYPE_DISPLAY_NAMES[code] || (code ? code.replace(/_/g, " ") : "");
}

export function reviewerRoleLabel(role?: string): string {
  const code = normalizeUserTypeCode(role) || "";
  if (!code) return "Approver";
  return USER_TYPE_DISPLAY_NAMES[code] || "Approver";
}

/** Classify free-text leave reason into a presentation category (no DB change). */
export function classifyLeaveReason(reason: string): AbsenceCategory {
  const r = (reason || "").toLowerCase();
  if (/\b(train|workshop|course|induction|skilling)\b/.test(r)) return "training";
  if (/\b(conferen|seminar|symposium|congress)\b/.test(r)) return "conference";
  if (/\b(official\s*duty|\bod\b|tour|deputation|field\s*visit)\b/.test(r)) return "official_duty";
  if (/\b(holiday|festival)\b/.test(r)) return "holiday";
  return "leave";
}

export function leaveCategoryLabel(category: AbsenceCategory, reason: string): string {
  const r = (reason || "").trim();
  if (!r) return ABSENCE_META[category].label;
  if (category === "leave") {
    if (/\bmedical\b|\bml\b|\bsick\b/.test(r.toLowerCase())) return "Medical Leave";
    if (/\bcasual\b|\bcl\b/.test(r.toLowerCase())) return "Casual Leave";
    if (/\bearned\b|\bel\b/.test(r.toLowerCase())) return "Earned Leave";
    if (/\bhalf[-\s]?day\b/.test(r.toLowerCase())) return "Half-Day Leave";
    if (r.length <= 28) return r;
    return "Leave";
  }
  return ABSENCE_META[category].label;
}

export function leaveCoversDay(
  l: LeaveRow,
  dayIso: string,
): { kind: CoverageKind; label: string } {
  if (dayIso < l.start_date || dayIso > l.end_date) return { kind: "none", label: "" };
  if (l.start_date === l.end_date) {
    if (l.start_session === "FN" && l.end_session === "FN") return { kind: "half_fn", label: "FN" };
    if (l.start_session === "AN" && l.end_session === "AN") return { kind: "half_an", label: "AN" };
    return { kind: "full", label: "" };
  }
  if (dayIso === l.start_date) {
    return l.start_session === "AN" ? { kind: "half_an", label: "AN" } : { kind: "full", label: "" };
  }
  if (dayIso === l.end_date) {
    return l.end_session === "FN" ? { kind: "half_fn", label: "FN" } : { kind: "full", label: "" };
  }
  return { kind: "full", label: "" };
}

export function isApprovedLeave(l: LeaveRow): boolean {
  return String(l.status || "").toUpperCase() === "APPROVED";
}

export function resolveCellAbsence(
  dayIso: string,
  opLeaves: LeaveRow[],
  holiday: HolidayMeta | null | undefined,
  showHolidays: boolean,
): CellAbsence | null {
  const match = opLeaves.find((l) => leaveCoversDay(l, dayIso).kind !== "none");
  if (match) {
    const coverage = leaveCoversDay(match, dayIso);
    if (coverage.kind === "none") return null;
    const category = classifyLeaveReason(match.reason);
    return {
      category,
      label: leaveCategoryLabel(category, match.reason),
      kind: coverage.kind,
      leave: match,
    };
  }

  if (showHolidays && holiday && holiday.kind === "holiday") {
    return {
      category: "holiday",
      label: holiday.reason || "Holiday",
      kind: "full",
      holidayReason: holiday.reason,
    };
  }
  return null;
}

export function isWeekendMeta(holiday: HolidayMeta | null | undefined): boolean {
  if (!holiday) return false;
  if (holiday.kind === "weekend") return true;
  const r = (holiday.reason || "").toLowerCase();
  return r === "saturday" || r === "sunday";
}

export function monthForDate(iso: string): string {
  return iso.slice(0, 7);
}

export function clampWeekToMonth(anchorIso: string, month: string): string {
  const weekDays = daysInWeek(anchorIso);
  const inMonth = weekDays.find((d) => d.startsWith(month));
  return inMonth || `${month}-01`;
}

export function startOfWeekIso(iso: string): string {
  return format(startOfWeek(parseISO(iso), { weekStartsOn: 1 }), "yyyy-MM-dd");
}

export function endOfWeekIso(iso: string): string {
  return format(endOfWeek(parseISO(iso), { weekStartsOn: 1 }), "yyyy-MM-dd");
}
