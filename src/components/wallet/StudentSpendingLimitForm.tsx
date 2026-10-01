import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import type { StudentSpendingLimit } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatINRWithPaise as formatInr } from "@/lib/money";

function rangeLabel(start?: string, end?: string): string {
  if (!start || !end) return "";
  try {
    return `${format(parseISO(start), "d MMM")} – ${format(parseISO(end), "d MMM")}`;
  } catch {
    return "";
  }
}

function amountInputValue(value: string | null | undefined): string {
  if (value == null || value === "") return "";
  const n = Number(value);
  return Number.isFinite(n) ? String(n) : "";
}

type UsageProps = {
  label: string;
  range: string;
  spent: string | undefined;
  limit: string | null | undefined;
  remaining: string | null | undefined;
};

export function SpendingUsageLine({ label, range, spent, limit, remaining }: UsageProps) {
  const limitNum = limit != null ? Number(limit) : null;
  const spentNum = Number(spent ?? 0);
  const pct = limitNum && limitNum > 0 ? Math.min(100, (spentNum / limitNum) * 100) : limitNum === 0 ? 100 : 0;
  const barColor = pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
        <span className="font-medium">
          {label}
          {range && <span className="ml-1 text-xs font-normal text-muted-foreground">({range})</span>}
        </span>
        <span className="text-muted-foreground">
          {formatInr(spent)} spent
          {limitNum != null ? (
            <>
              {" "}
              of {formatInr(limit)} · <span className="font-medium text-foreground">{formatInr(remaining)} left</span>
            </>
          ) : (
            " · no limit"
          )}
        </span>
      </div>
      {limitNum != null && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className={`h-full ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

type FormProps = {
  joinRequestId: number;
  limit?: StudentSpendingLimit;
  onSaved: (limit: StudentSpendingLimit) => void;
};

export function StudentSpendingLimitForm({ joinRequestId, limit, onSaved }: FormProps) {
  const [weekly, setWeekly] = useState(amountInputValue(limit?.weekly_limit_inr));
  const [monthly, setMonthly] = useState(amountInputValue(limit?.monthly_limit_inr));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setWeekly(amountInputValue(limit?.weekly_limit_inr));
    setMonthly(amountInputValue(limit?.monthly_limit_inr));
  }, [limit?.weekly_limit_inr, limit?.monthly_limit_inr]);

  const validate = (): string | null => {
    const w = weekly.trim();
    const m = monthly.trim();
    if (!w && !m) return "Enter a weekly limit, a monthly limit, or both.";
    for (const [label, v] of [
      ["Weekly limit", w],
      ["Monthly limit", m],
    ] as const) {
      if (!v) continue;
      const n = Number(v);
      if (!Number.isFinite(n)) return `${label} must be a number.`;
      if (n < 0) return `${label} cannot be negative.`;
    }
    return null;
  };

  const save = async () => {
    const problem = validate();
    setError(problem);
    if (problem) return;
    setSaving(true);
    try {
      const res = await apiClient.updateStudentSpendingLimit(joinRequestId, {
        spending_limit_enabled: true,
        weekly_limit_inr: weekly.trim() || null,
        monthly_limit_inr: monthly.trim() || null,
      });
      if (res.error || !res.data?.limit) {
        setError(res.error || "Could not save the spending limit.");
        return;
      }
      toast.success("Spending limit saved.");
      onSaved(res.data.limit);
    } catch {
      setError("Could not save the spending limit.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 rounded-xl border border-primary/20 bg-primary/5 p-4 dark:border-primary/40 dark:bg-primary/10">
      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor={`weekly-limit-${joinRequestId}`}>Weekly limit (₹)</Label>
          <Input
            id={`weekly-limit-${joinRequestId}`}
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            placeholder="e.g. 2000"
            value={weekly}
            onChange={(e) => setWeekly(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`monthly-limit-${joinRequestId}`}>Monthly limit (₹)</Label>
          <Input
            id={`monthly-limit-${joinRequestId}`}
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            placeholder="e.g. 8000"
            value={monthly}
            onChange={(e) => setMonthly(e.target.value)}
          />
        </div>
        <Button onClick={save} disabled={saving} className="gap-2">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <p className="text-xs text-muted-foreground">
        Leave a box empty for no limit in that period. Weeks run Monday–Sunday and months are calendar
        months (IST). Bookings made by the lab (OIC / admin) on the student&apos;s behalf are not blocked.
      </p>
      {limit && (
        <div className="space-y-3 border-t border-primary/15 pt-3">
          <SpendingUsageLine
            label="This week"
            range={rangeLabel(limit.week_start, limit.week_end)}
            spent={limit.week_spent_inr}
            limit={limit.spending_limit_enabled ? limit.weekly_limit_inr : null}
            remaining={limit.weekly_remaining_inr}
          />
          <SpendingUsageLine
            label="This month"
            range={rangeLabel(limit.month_start, limit.month_end)}
            spent={limit.month_spent_inr}
            limit={limit.spending_limit_enabled ? limit.monthly_limit_inr : null}
            remaining={limit.monthly_remaining_inr}
          />
        </div>
      )}
    </div>
  );
}
