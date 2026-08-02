import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type SessionExperience = {
  remaining_seconds?: number | null;
  expires_at?: string | null;
  can_extend?: boolean;
  extend_blocked_reason?: string | null;
  extension_minutes?: number;
  default_duration_minutes?: number;
  others_waiting?: boolean;
  warnings?: number[];
};

export function SessionTimerCard({
  session,
  busy,
  onExtend,
}: {
  session: SessionExperience;
  busy?: boolean;
  onExtend: () => void;
}) {
  const [remaining, setRemaining] = useState<number | null>(
    typeof session.remaining_seconds === "number" ? session.remaining_seconds : null
  );

  useEffect(() => {
    setRemaining(typeof session.remaining_seconds === "number" ? session.remaining_seconds : null);
  }, [session.remaining_seconds, session.expires_at]);

  useEffect(() => {
    if (remaining == null || remaining <= 0) return;
    const id = window.setInterval(() => {
      setRemaining((r) => (r == null ? r : Math.max(0, r - 1)));
    }, 1000);
    return () => window.clearInterval(id);
  }, [remaining == null]);

  const warning = useMemo(() => {
    if (remaining == null) return null;
    const mins = Math.ceil(remaining / 60);
    const levels = session.warnings || [10, 5, 2, 1];
    return levels.find((m) => mins <= m && remaining > 0) ?? null;
  }, [remaining, session.warnings]);

  if (remaining == null) return null;

  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  const urgent = remaining <= 5 * 60;

  return (
    <Card className={cn(urgent && "border-rose-500/40 bg-rose-500/5")}>
      <CardHeader className="pb-2">
        <CardTitle>Remaining session time</CardTitle>
        <CardDescription>
          Default session length: {session.default_duration_minutes ?? 30} minutes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p
          className={cn(
            "font-mono text-4xl font-semibold tracking-tight tabular-nums",
            urgent && "text-rose-600 dark:text-rose-400"
          )}
        >
          {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
        </p>
        {warning != null ? (
          <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
            {warning} minute{warning === 1 ? "" : "s"} remaining
          </p>
        ) : null}
        {session.can_extend ? (
          <div className="space-y-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
            <p className="text-sm">No users are waiting. You may extend your analysis session.</p>
            <Button size="sm" disabled={busy} onClick={onExtend}>
              Extend session (+{session.extension_minutes ?? 15} min)
            </Button>
          </div>
        ) : session.extend_blocked_reason ? (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-muted-foreground">
            {session.extend_blocked_reason}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
