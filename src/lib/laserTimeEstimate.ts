import type { LaserJobTimeEstimate, LaserPartTimeEstimate } from "@/lib/api";

/** Reserved charge-input key the backend fills with the job's machine-time estimate. */
export const LASER_ESTIMATE_KEY = "_laser_time_estimate";

/** '45 s', '12 min 5 s', '2 h 4 min' (same wording as the booking emails). */
export function formatSeconds(seconds: number | string | null | undefined): string {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  if (total < 60) return `${total} s`;
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  if (minutes < 60) return secs ? `${minutes} min ${secs} s` : `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

export function formatMinutes(minutes: number | string | null | undefined): string {
  return formatSeconds((Number(minutes) || 0) * 60);
}

/** '1 min 12 s each · 996 mm cut · 6 pierces' */
export function laserPartTimeText(est: LaserPartTimeEstimate | null | undefined): string | null {
  if (!est || !(Number(est.seconds_each) > 0)) return null;
  const pierces = Number(est.pierces) || 0;
  return [
    `${formatSeconds(est.seconds_each)} each`,
    `${Math.round(Number(est.cut_length_mm) || 0).toLocaleString("en-IN")} mm cut`,
    `${pierces} pierce${pierces === 1 ? "" : "s"}`,
  ].join(" · ");
}

export function isLaserJobTimeEstimate(value: unknown): value is LaserJobTimeEstimate {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<LaserJobTimeEstimate>;
  return typeof v.total_min === "number" && v.total_min > 0 && typeof v.cutting_min === "number";
}

/** The job estimate from a calculate response's input values, or null. */
export function laserJobEstimateFromInputs(inputValues: unknown): LaserJobTimeEstimate | null {
  if (!inputValues || typeof inputValues !== "object") return null;
  const value = (inputValues as Record<string, unknown>)[LASER_ESTIMATE_KEY];
  return isLaserJobTimeEstimate(value) ? value : null;
}

export interface LaserJobEstimateLine {
  label: string;
  minutes: number;
}

export function laserJobEstimateLines(est: LaserJobTimeEstimate): LaserJobEstimateLine[] {
  const lines: LaserJobEstimateLine[] = [
    { label: "Cutting, piercing and head moves", minutes: est.cutting_min },
    { label: "Job setup", minutes: est.setup_min },
    {
      label: `Loading ${est.sheets} sheet${est.sheets === 1 ? "" : "s"}`,
      minutes: est.sheet_min,
    },
  ];
  if (est.allowance_min > 0) {
    lines.push({ label: `Allowance (${est.allowance_pct}%)`, minutes: est.allowance_min });
  }
  return lines.filter((l) => l.minutes > 0);
}
