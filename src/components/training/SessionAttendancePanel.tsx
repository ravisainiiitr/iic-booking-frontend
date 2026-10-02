import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarCheck2, CheckCheck, ExternalLink, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { trainingApi } from "@/lib/trainingApi";
import type { AttendanceRosterRow, AttendanceSessionRow, AttendanceStatus, SessionAttendance } from "@/lib/trainingTypes";
import { cn } from "@/lib/utils";
import { formatWindow, humanizeCode } from "./trainingHelpers";
import { EmptyState, LoadingBlock, SectionCard, StatusChip } from "./trainingUi";
import { invalidateTrainingBadges } from "./useTrainingBadges";

const STATUSES: Array<{ value: AttendanceStatus; label: string; short: string; tone: string }> = [
  { value: "PRESENT", label: "Present", short: "P", tone: "bg-emerald-600 text-white hover:bg-emerald-700 border-emerald-600" },
  { value: "LATE", label: "Late", short: "L", tone: "bg-amber-500 text-white hover:bg-amber-600 border-amber-500" },
  { value: "ABSENT", label: "Absent", short: "A", tone: "bg-rose-600 text-white hover:bg-rose-700 border-rose-600" },
  { value: "EXCUSED", label: "Excused", short: "E", tone: "bg-slate-500 text-white hover:bg-slate-600 border-slate-500" },
];

type Draft = Record<number, { status: AttendanceStatus | null; remarks: string }>;

function draftFrom(roster: AttendanceRosterRow[]): Draft {
  const out: Draft = {};
  for (const row of roster) out[row.registration_id] = { status: row.attendance, remarks: row.remarks ?? "" };
  return out;
}

function Roster({
  sessionId,
  onSaved,
  onOpenDemoRequest,
  demoRequestId,
}: {
  sessionId: number;
  onSaved: () => void;
  onOpenDemoRequest?: (id: number) => void;
  demoRequestId?: number | null;
}) {
  const [data, setData] = useState<SessionAttendance | null>(null);
  const [draft, setDraft] = useState<Draft>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [onlyUnmarked, setOnlyUnmarked] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await trainingApi.sessionAttendance(sessionId);
    setLoading(false);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not load the roster.");
      return;
    }
    setData(res.data);
    setDraft(draftFrom(res.data.roster));
  }, [sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const roster = useMemo(() => data?.roster ?? [], [data]);
  const dirty = roster.some((r) => {
    const d = draft[r.registration_id];
    return d && (d.status !== r.attendance || d.remarks !== (r.remarks ?? ""));
  });
  const unmarked = roster.filter((r) => !draft[r.registration_id]?.status).length;

  const setAll = (status: AttendanceStatus) => {
    setDraft((prev) => {
      const next = { ...prev };
      for (const r of roster) {
        const cur = next[r.registration_id] ?? { status: null, remarks: "" };
        if (onlyUnmarked && cur.status) continue;
        next[r.registration_id] = { ...cur, status };
      }
      return next;
    });
  };

  const save = async () => {
    const rows = roster
      .map((r) => ({ r, d: draft[r.registration_id] }))
      .filter(({ d }) => d?.status)
      .map(({ r, d }) => ({ registration_id: r.registration_id, status: d.status as AttendanceStatus, remarks: d.remarks.trim() || undefined }));
    if (!rows.length) {
      toast.error("Mark at least one participant.");
      return;
    }
    setSaving(true);
    const res = await trainingApi.saveAttendance(sessionId, rows);
    setSaving(false);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not save attendance.");
      return;
    }
    toast.success(`Attendance saved for ${res.data.saved} participant${res.data.saved === 1 ? "" : "s"}.`);
    if (res.data.awarded_user_ids?.length) {
      invalidateTrainingBadges(res.data.awarded_user_ids);
      toast.success(`Trained certification issued to ${res.data.awarded_user_ids.length} participant(s).`);
    }
    setData(res.data);
    setDraft(draftFrom(res.data.roster));
    onSaved();
  };

  if (loading && !data) return <LoadingBlock label="Loading roster…" />;
  if (!data) return null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">
            {data.event?.title ?? "Session"} — {data.session.title || humanizeCode(data.session.session_type)}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatWindow(data.session.start_at, data.session.end_at)}
            {data.session.location ? ` · ${data.session.location}` : ""}
          </p>
        </div>
        {demoRequestId && onOpenDemoRequest ? (
          <Button type="button" size="sm" variant="outline" onClick={() => onOpenDemoRequest(demoRequestId)}>
            <ExternalLink className="mr-1.5 h-4 w-4" aria-hidden /> Demo request
          </Button>
        ) : null}
      </div>

      {roster.length === 0 ? (
        <EmptyState
          title="No registered participants"
          description={demoRequestId ? "For a demonstration, record the attended count on the demo request." : "Participants appear here once registered."}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/70 bg-muted/30 p-2">
            <Button type="button" size="sm" className="h-8 bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => setAll("PRESENT")}>
              <CheckCheck className="mr-1.5 h-4 w-4" aria-hidden /> Mark all present
            </Button>
            <span className="text-xs text-muted-foreground">Set all:</span>
            {STATUSES.filter((s) => s.value !== "PRESENT").map((s) => (
              <Button key={s.value} type="button" size="sm" variant="outline" className="h-8" onClick={() => setAll(s.value)}>
                {s.label}
              </Button>
            ))}
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground sm:ml-auto">
              <Checkbox checked={onlyUnmarked} onCheckedChange={(v) => setOnlyUnmarked(v === true)} />
              Only unmarked ({unmarked})
            </label>
          </div>

          <ul className="divide-y divide-border/60 rounded-lg border border-border/70">
            {roster.map((row) => {
              const d = draft[row.registration_id] ?? { status: null, remarks: "" };
              return (
                <li key={row.registration_id} className="flex flex-col gap-2 p-2.5 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{row.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{[row.email, row.department].filter(Boolean).join(" · ")}</p>
                  </div>
                  <div className="flex items-center gap-1" role="radiogroup" aria-label={`Attendance for ${row.name}`}>
                    {STATUSES.map((s) => (
                      <button
                        key={s.value}
                        type="button"
                        role="radio"
                        aria-checked={d.status === s.value}
                        title={s.label}
                        onClick={() => setDraft((prev) => ({ ...prev, [row.registration_id]: { ...d, status: s.value } }))}
                        className={cn(
                          "h-8 min-w-8 rounded-md border px-2 text-xs font-semibold transition-colors",
                          d.status === s.value ? s.tone : "border-input bg-background text-muted-foreground hover:bg-muted",
                        )}
                      >
                        <span className="sm:hidden">{s.short}</span>
                        <span className="hidden sm:inline">{s.label}</span>
                      </button>
                    ))}
                  </div>
                  <Input
                    value={d.remarks}
                    onChange={(e) => setDraft((prev) => ({ ...prev, [row.registration_id]: { ...d, remarks: e.target.value } }))}
                    placeholder="Remarks"
                    className="h-8 sm:w-44"
                    aria-label={`Remarks for ${row.name}`}
                  />
                </li>
              );
            })}
          </ul>
          <div className="flex items-center justify-end gap-2">
            {dirty ? <span className="text-xs text-amber-700 dark:text-amber-300">Unsaved changes</span> : null}
            <Button type="button" onClick={() => void save()} disabled={saving || !dirty}>
              {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
              Save attendance
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

/** Sessions within ±30 days and their attendance roster (OIC workspace and Lab Operator page). */
export function SessionAttendancePanel({ onOpenDemoRequest }: { onOpenDemoRequest?: (id: number) => void }) {
  const [sessions, setSessions] = useState<AttendanceSessionRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await trainingApi.attendanceSessions();
    setLoading(false);
    if (res.error) {
      toast.error(res.error);
      setSessions([]);
      return;
    }
    setSessions(res.data?.results ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const list = useMemo(() => {
    const all = sessions ?? [];
    const filtered = showAll ? all : all.filter((s) => s.needs_attendance || s.id === selected);
    return [...filtered].sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
  }, [sessions, showAll, selected]);
  const selectedRow = sessions?.find((s) => s.id === selected) ?? null;
  const dueCount = (sessions ?? []).filter((s) => s.needs_attendance).length;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <SectionCard
        title="Sessions"
        description={`${dueCount} awaiting attendance`}
        icon={<CalendarCheck2 className="h-4 w-4" />}
        bodyClassName="p-0"
        actions={
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Checkbox checked={showAll} onCheckedChange={(v) => setShowAll(v === true)} />
            Show all
          </label>
        }
      >
        {loading && !sessions ? (
          <LoadingBlock />
        ) : list.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            {showAll ? "No sessions in the last or next 30 days." : "No sessions need attendance. Tick “Show all” to see every session."}
          </p>
        ) : (
          <ul className="max-h-[32rem] divide-y divide-border/60 overflow-y-auto">
            {list.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setSelected(s.id)}
                  className={cn(
                    "w-full px-3 py-2.5 text-left transition-colors hover:bg-muted/50",
                    selected === s.id && "bg-primary/10 dark:bg-primary/20",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 truncate text-sm font-medium">{s.event?.title}</p>
                    {s.needs_attendance ? (
                      <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                        Due
                      </span>
                    ) : (
                      <StatusChip kind="session" status={s.status} label={s.status_label} />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {s.title || humanizeCode(s.session_type)} · {s.event?.equipment?.code}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatWindow(s.start_at, s.end_at)}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Roster" description="Present / Late count as attended. Completing every session issues the Trained certification.">
        {selectedRow ? (
          <Roster
            key={selectedRow.id}
            sessionId={selectedRow.id}
            demoRequestId={selectedRow.demo_request_id}
            onOpenDemoRequest={onOpenDemoRequest}
            onSaved={() => void load()}
          />
        ) : (
          <EmptyState title="Choose a session" description="Pick a session on the left to mark attendance." />
        )}
      </SectionCard>
    </div>
  );
}
