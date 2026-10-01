import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarClock } from "lucide-react";
import { apiClient } from "@/lib/api";
import type { EquipmentSlotLimit } from "@/lib/api";

function periodLabel(row: EquipmentSlotLimit): string {
  const start = parseISO(row.period_start);
  const now = new Date();
  const end = parseISO(row.period_end);
  const isCurrent = start <= now && now <= end;
  if (row.period === "weekly") return isCurrent ? "this week" : `week of ${format(start, "d MMM")}`;
  return isCurrent ? "this month" : format(start, "MMMM yyyy");
}

/**
 * The signed-in user's weekly / monthly slot limits on this equipment, for the week being viewed.
 * Renders nothing when no limit is enforced for the user.
 */
export function EquipmentSlotLimitNotice({
  equipmentId,
  referenceDate,
  refreshKey,
  className = "",
}: {
  equipmentId: number | string | null | undefined;
  /** YYYY-MM-DD inside the week being viewed. */
  referenceDate?: string;
  /** Change to refetch, e.g. after a booking attempt. */
  refreshKey?: unknown;
  className?: string;
}) {
  const [limits, setLimits] = useState<EquipmentSlotLimit[]>([]);

  useEffect(() => {
    if (equipmentId == null || equipmentId === "") {
      setLimits([]);
      return;
    }
    let cancelled = false;
    apiClient
      .getEquipmentSlotLimits(equipmentId, referenceDate)
      .then((res) => {
        if (!cancelled) setLimits(Array.isArray(res.data?.limits) ? res.data.limits : []);
      })
      .catch(() => {
        if (!cancelled) setLimits([]);
      });
    return () => {
      cancelled = true;
    };
  }, [equipmentId, referenceDate, refreshKey]);

  if (!limits.length) return null;

  const exhausted = limits.some((row) => row.remaining <= 0);
  const tone = exhausted
    ? "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100"
    : "border-sky-500/30 bg-sky-500/10 text-sky-900 dark:text-sky-100";

  return (
    <div className={`inline-flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${tone} ${className}`}>
      <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="flex flex-col gap-0.5">
        {limits.map((row) => (
          <span key={row.period}>
            <span className="font-semibold">
              Your {row.period} limit ({periodLabel(row)}):
            </span>{" "}
            {row.remaining} of {row.limit} slot{row.limit === 1 ? "" : "s"} left
          </span>
        ))}
      </span>
    </div>
  );
}

export default EquipmentSlotLimitNotice;
