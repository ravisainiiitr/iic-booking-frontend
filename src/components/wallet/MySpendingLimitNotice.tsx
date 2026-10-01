import { useEffect, useState } from "react";
import { Gauge } from "lucide-react";
import { apiClient } from "@/lib/api";
import type { StudentSpendingLimit } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { formatINRWithPaise as formatInr } from "@/lib/money";

/** Shows a student the weekly / monthly limit their supervisor set and what is left. Renders nothing otherwise. */
export function MySpendingLimitNotice({ className = "" }: { className?: string }) {
  const { user } = useAuth();
  const userType = user?.user_type != null ? String(user.user_type).toLowerCase() : "";
  const eligible = userType === "student" || userType === "other";
  const [limit, setLimit] = useState<(Partial<StudentSpendingLimit> & { spending_limit_enabled: boolean }) | null>(
    null,
  );

  useEffect(() => {
    if (!eligible) {
      setLimit(null);
      return;
    }
    let cancelled = false;
    apiClient
      .getMySpendingLimit()
      .then((res) => {
        if (!cancelled) setLimit(res.data ?? null);
      })
      .catch(() => {
        if (!cancelled) setLimit(null);
      });
    return () => {
      cancelled = true;
    };
  }, [eligible, user?.id]);

  if (!eligible || !limit?.spending_limit_enabled) return null;

  const parts: string[] = [];
  if (limit.weekly_limit_inr != null) {
    parts.push(`${formatInr(limit.weekly_remaining_inr)} left this week (limit ${formatInr(limit.weekly_limit_inr)})`);
  }
  if (limit.monthly_limit_inr != null) {
    parts.push(
      `${formatInr(limit.monthly_remaining_inr)} left this month (limit ${formatInr(limit.monthly_limit_inr)})`,
    );
  }
  if (!parts.length) return null;

  return (
    <div
      className={`inline-flex items-start gap-2 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-sm text-sky-900 dark:text-sky-100 ${className}`}
    >
      <Gauge className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        <span className="font-semibold">Supervisor spending limit:</span> {parts.join(" · ")}
      </span>
    </div>
  );
}

export default MySpendingLimitNotice;
