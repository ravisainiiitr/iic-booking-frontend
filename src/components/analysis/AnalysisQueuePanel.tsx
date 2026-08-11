import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock3, Users } from "lucide-react";

export type QueueExperience = {
  is_queued?: boolean;
  title?: string;
  body?: string[];
  position?: number | null;
  queue_size?: number;
  people_ahead?: number;
  estimated_wait_minutes?: number | null;
  expected_start_at?: string | null;
  environments?: {
    total?: number;
    available?: number;
    busy?: number;
    offline?: number;
    waiting?: number;
  };
};

function formatStart(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
}

export function AnalysisQueuePanel({ queue }: { queue: QueueExperience }) {
  if (!queue?.is_queued) return null;
  const env = queue.environments || {};
  const positionLabel =
    queue.position != null
      ? `${queue.position} of ${Math.max(queue.queue_size || queue.position, queue.position)}`
      : "—";

  return (
    <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-transparent">
      <CardHeader>
        <CardTitle className="text-xl">
          {queue.title || "Analysis Environment Currently Unavailable"}
        </CardTitle>
        <CardDescription className="space-y-2 text-sm leading-relaxed text-foreground/80">
          {(queue.body || []).map((line) => (
            <p key={line}>{line}</p>
          ))}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border bg-background/80 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Queue Position</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{positionLabel}</p>
          </div>
          <div className="rounded-xl border bg-background/80 p-4">
            <p className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
              <Clock3 className="h-3.5 w-3.5" /> Estimated wait
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {queue.estimated_wait_minutes != null ? `${queue.estimated_wait_minutes} min` : "—"}
            </p>
          </div>
          <div className="rounded-xl border bg-background/80 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Expected start</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {formatStart(queue.expected_start_at)}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label="Environments" value={env.total ?? "—"} />
          <Stat label="Available" value={env.available ?? "—"} accent="ok" />
          <Stat label="Busy" value={env.busy ?? "—"} accent="busy" />
          <Stat label="Offline" value={env.offline ?? "—"} />
          <Stat
            label="Waiting"
            value={env.waiting ?? queue.people_ahead ?? "—"}
            icon={<Users className="h-3.5 w-3.5" />}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: string | number;
  accent?: "ok" | "busy";
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-background/60 px-3 py-2">
      <p className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </p>
      <p
        className={
          accent === "ok"
            ? "mt-0.5 text-lg font-semibold text-emerald-600"
            : accent === "busy"
              ? "mt-0.5 text-lg font-semibold text-amber-600"
              : "mt-0.5 text-lg font-semibold"
        }
      >
        {value}
      </p>
    </div>
  );
}
