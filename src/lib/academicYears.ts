/** Academic years (July–June, labelled "2026-27") for TA / operator nomination calls. */

export interface AcademicYearOption {
  label: string;
  semester_id: number | null;
  start_date: string;
  end_date: string;
  is_current: boolean;
  available: boolean;
  unavailable_reason?: string;
}

type SemesterLike = { id: number; code: string; name: string };

const START_MONTH_INDEX = 6; // July

export function academicYearLabel(startYear: number): string {
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

export function academicStartYear(day: Date): number {
  return day.getMonth() >= START_MONTH_INDEX ? day.getFullYear() : day.getFullYear() - 1;
}

/** "2025-26" from a semester's code/name ("2025-26 Odd", "AY-2025-26", "2025-2026"), or null. */
export function labelFromSemester(s: SemesterLike): string | null {
  const text = `${s.code || ""} ${s.name || ""}`;
  const short = text.match(/\b(\d{4}-\d{2})\b/);
  if (short?.[1]) return short[1];
  const full = text.match(/\b(\d{4})-(\d{4})\b/);
  if (full) return `${full[1]}-${full[2].slice(-2)}`;
  return null;
}

/**
 * Options for the Academic Year picker. Uses the server list when present; older servers only send
 * semesters, so the current and next year are added locally and mapped to a matching semester if any.
 */
export function academicYearOptions(
  serverOptions: AcademicYearOption[] | undefined | null,
  semesters: SemesterLike[],
  today: Date = new Date(),
): AcademicYearOption[] {
  if (serverOptions?.length) return serverOptions;
  const current = academicStartYear(today);
  const labels = [academicYearLabel(current), academicYearLabel(current + 1)];
  const bySemester = new Map<string, number>();
  for (const s of [...semesters].sort((a, b) => b.id - a.id)) {
    const label = labelFromSemester(s);
    if (!label) continue;
    if (!bySemester.has(label)) bySemester.set(label, s.id);
    if (!labels.includes(label)) labels.push(label);
  }
  return labels.map((label) => {
    const start = Number(label.slice(0, 4));
    return {
      label,
      semester_id: bySemester.get(label) ?? null,
      start_date: `${start}-07-01`,
      end_date: `${start + 1}-06-30`,
      is_current: start === current,
      available: true,
    };
  });
}
