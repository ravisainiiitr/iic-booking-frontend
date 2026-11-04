import { useCallback, useEffect, useState } from "react";
import { Loader2, Search, UserMinus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trainingApi } from "@/lib/trainingApi";
import type {
  EquipmentTrainerRow,
  SupervisedSession,
  SupervisionAction,
  SupervisionScope,
  SupervisorOption,
} from "@/lib/trainingAuthTypes";
import type { TrainingUserRef } from "@/lib/trainingTypes";
import { formatDate, formatDateTime, formatWindow } from "./trainingHelpers";
import { EmptyState, LoadingBlock, PromptDialog, runTrainingAction } from "./trainingUi";

const SESSION_TONE: Record<string, string> = {
  REQUESTED: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200",
  CONFIRMED: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-200",
  ATTENDED: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200",
  DECLINED: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-200",
  NO_SHOW: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-200",
  CANCELLED: "border-border bg-muted text-muted-foreground",
};

export function SessionChip({ session }: { session: Pick<SupervisedSession, "status" | "status_label"> }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${
        SESSION_TONE[session.status] ?? SESSION_TONE.CANCELLED
      }`}
    >
      {session.status_label}
    </span>
  );
}

/** Supervisor picker for a Beginner's booking: equipment staff and designated trainers. */
export function SupervisorPicker({
  supervisors,
  value,
  onChange,
  id = "booking-supervisor",
}: {
  supervisors: SupervisorOption[];
  value: number | null;
  onChange: (id: number | null) => void;
  id?: string;
}) {
  if (!supervisors.length) {
    return <p className="text-xs text-muted-foreground">No supervisor is available on this equipment yet. Ask the OIC.</p>;
  }
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-xs font-medium text-foreground">
        Supervisor for this booking
      </label>
      <Select value={value ? String(value) : ""} onValueChange={(v) => onChange(v ? Number(v) : null)}>
        <SelectTrigger id={id} className="h-9 max-w-sm bg-background" aria-label="Supervisor for this booking">
          <SelectValue placeholder="Choose a supervisor" />
        </SelectTrigger>
        <SelectContent>
          {supervisors.map((p) => (
            <SelectItem key={p.id} value={String(p.id)}>
              {p.name} · {p.role === "Trainer" ? "Trainer" : "Lab staff"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-[11px] text-muted-foreground">They are asked to confirm and must be present for the session.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trainers (OIC designates Experts; Lab staff always supervise)
// ---------------------------------------------------------------------------
export function TrainersPanel({ equipmentId, onChanged }: { equipmentId: number; onChanged?: () => void }) {
  const [rows, setRows] = useState<EquipmentTrainerRow[] | null>(null);
  const [staff, setStaff] = useState<SupervisorOption[]>([]);
  const [canConfigure, setCanConfigure] = useState(false);
  const [q, setQ] = useState("");
  const [people, setPeople] = useState<TrainingUserRef[]>([]);
  const [searching, setSearching] = useState(false);
  const [removing, setRemoving] = useState<EquipmentTrainerRow | null>(null);
  const [showPast, setShowPast] = useState(false);

  const load = useCallback(async () => {
    const res = await trainingApi.equipmentTrainers(equipmentId);
    if (res.error) {
      toast.error(res.error);
      setRows([]);
      return;
    }
    setRows(res.data?.results ?? []);
    setStaff(res.data?.staff ?? []);
    setCanConfigure(Boolean(res.data?.can_configure));
  }, [equipmentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const search = async () => {
    if (q.trim().length < 2) return;
    setSearching(true);
    const res = await trainingApi.authorisationPeople(equipmentId, q.trim());
    setSearching(false);
    setPeople(res.data?.results ?? []);
  };

  const designate = async (user: TrainingUserRef) => {
    const res = await runTrainingAction(trainingApi.designateTrainer(equipmentId, user.id), `${user.name} is now a trainer`);
    if (res.error) return;
    setPeople([]);
    setQ("");
    void load();
    onChanged?.();
  };

  if (rows === null) return <LoadingBlock />;
  const active = rows.filter((r) => r.is_active);
  const past = rows.filter((r) => !r.is_active);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Trainers supervise Beginners' bookings and record Expert assessments. The equipment's OIC and Lab Operators always may;
        the OIC can also designate students or staff who hold valid Expert authorisation here.
      </p>
      <div>
        <h4 className="mb-1.5 text-sm font-semibold">Lab staff</h4>
        <ul className="flex flex-wrap gap-1.5">
          {staff.map((p) => (
            <li key={p.id} className="rounded-full border bg-muted/40 px-2.5 py-0.5 text-xs">
              {p.name}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h4 className="mb-1.5 text-sm font-semibold">Designated trainers</h4>
        {!active.length ? (
          <EmptyState title="No designated trainers" description="Only the Lab staff supervise and assess on this equipment." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Trainer</TableHead>
                <TableHead>Expert until</TableHead>
                <TableHead>Designated</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {active.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm">
                    {r.user.name}
                    {r.user.department ? <div className="text-xs text-muted-foreground">{r.user.department}</div> : null}
                    {!r.valid ? <div className="text-xs text-rose-600">Expert authorisation lapsed: not eligible</div> : null}
                  </TableCell>
                  <TableCell className="text-sm">{r.authorisation_valid_until ? formatDate(r.authorisation_valid_until) : "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(r.designated_at)}
                    {r.designated_by ? ` by ${r.designated_by}` : ""}
                  </TableCell>
                  <TableCell className="text-right">
                    {canConfigure ? (
                      <Button type="button" size="sm" variant="ghost" className="gap-1" onClick={() => setRemoving(r)}>
                        <UserMinus className="h-4 w-4" aria-hidden />
                        Remove
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
      {canConfigure ? (
        <div className="space-y-2 rounded-xl border bg-muted/20 p-3">
          <h4 className="text-sm font-semibold">Designate a trainer</h4>
          <div className="flex max-w-md gap-2">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void search()}
              placeholder="Name or email of an Expert user"
              aria-label="Search people"
            />
            <Button type="button" variant="outline" onClick={() => void search()} disabled={searching} aria-label="Search">
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
          {people.length ? (
            <ul className="divide-y rounded-lg border bg-background">
              {people.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span>
                    {p.name}
                    {p.email ? <span className="ml-1 text-xs text-muted-foreground">{p.email}</span> : null}
                  </span>
                  <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => void designate(p)}>
                    <UserPlus className="h-4 w-4" aria-hidden />
                    Make trainer
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="text-xs text-muted-foreground">Only people with valid Expert authorisation on this equipment can be designated.</p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Only the equipment's OIC or the Main Admin can designate trainers.</p>
      )}
      {past.length ? (
        <div>
          <Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={() => setShowPast((v) => !v)}>
            {showPast ? "Hide" : "Show"} past trainers ({past.length})
          </Button>
          {showPast ? (
            <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
              {past.map((r) => (
                <li key={r.id}>
                  {r.user.name}: removed {formatDate(r.removed_at)}
                  {r.remove_reason ? ` (${r.remove_reason})` : ""}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {removing ? (
        <PromptDialog
          open
          onOpenChange={(v) => !v && setRemoving(null)}
          title="Remove trainer"
          description={`${removing.user.name} will no longer supervise or assess on this equipment. Their own authorisation is unchanged.`}
          confirmLabel="Remove"
          destructive
          onConfirm={async (reason) => {
            const res = await runTrainingAction(trainingApi.removeTrainer(removing.id, reason), "Trainer removed");
            if (res.error) return false;
            setRemoving(null);
            void load();
            onChanged?.();
            return true;
          }}
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Supervised sessions
// ---------------------------------------------------------------------------
export function SupervisionPanel({
  scope,
  equipmentId,
  emptyText = "No supervised sessions yet.",
}: {
  scope: SupervisionScope;
  equipmentId?: number;
  emptyText?: string;
}) {
  const [rows, setRows] = useState<SupervisedSession[] | null>(null);
  const [prompt, setPrompt] = useState<{ session: SupervisedSession; action: SupervisionAction } | null>(null);

  const load = useCallback(async () => {
    const res = await trainingApi.supervisedSessions(scope);
    if (res.error) {
      toast.error(res.error);
      setRows([]);
      return;
    }
    const all = res.data?.results ?? [];
    setRows(equipmentId ? all.filter((r) => r.equipment.equipment_id === equipmentId) : all);
  }, [scope, equipmentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (session: SupervisedSession, action: SupervisionAction, note = "") => {
    const label = { confirm: "Confirmed", decline: "Declined", attended: "Session recorded", no_show: "Recorded as no-show" }[action];
    const res = await runTrainingAction(trainingApi.supervisionAction(session.id, action, note), label);
    if (!res.error) void load();
    return !res.error;
  };

  if (rows === null) return <LoadingBlock />;
  if (!rows.length) return <p className="px-1 py-2 text-sm text-muted-foreground">{emptyText}</p>;
  const staffView = scope !== "mine";

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Session</TableHead>
            {staffView ? <TableHead>Student</TableHead> : null}
            <TableHead>{staffView ? "Supervisor" : "Supervisor"}</TableHead>
            <TableHead>Status</TableHead>
            {staffView ? <TableHead className="text-right">Action</TableHead> : <TableHead>Notes</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="text-sm">
                {r.equipment.name}
                <div className="text-xs text-muted-foreground">
                  {r.booking_reference}
                  {r.start ? ` · ${formatWindow(r.start, r.end)}` : ""}
                </div>
              </TableCell>
              {staffView ? <TableCell className="text-sm">{r.student.name}</TableCell> : null}
              <TableCell className="text-sm">{r.supervisor.name}</TableCell>
              <TableCell>
                <SessionChip session={r} />
                {r.recorded_at ? <div className="mt-0.5 text-[11px] text-muted-foreground">{formatDateTime(r.recorded_at)}</div> : null}
              </TableCell>
              {staffView ? (
                <TableCell className="text-right">
                  <div className="flex flex-wrap justify-end gap-1">
                    {r.can_respond ? (
                      <>
                        <Button type="button" size="sm" onClick={() => void act(r, "confirm")}>
                          Confirm
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => setPrompt({ session: r, action: "decline" })}>
                          Decline
                        </Button>
                      </>
                    ) : null}
                    {r.can_record ? (
                      <>
                        <Button type="button" size="sm" variant="outline" onClick={() => setPrompt({ session: r, action: "attended" })}>
                          Completed
                        </Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setPrompt({ session: r, action: "no_show" })}>
                          No-show
                        </Button>
                      </>
                    ) : null}
                  </div>
                </TableCell>
              ) : (
                <TableCell className="max-w-xs text-xs text-muted-foreground">{r.remarks || r.response_note || "—"}</TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {prompt ? (
        <PromptDialog
          open
          onOpenChange={(v) => !v && setPrompt(null)}
          title={
            prompt.action === "decline" ? "Decline supervision" : prompt.action === "attended" ? "Record supervised session" : "Record no-show"
          }
          description={`${prompt.session.student.name} · ${prompt.session.equipment.name}`}
          label={prompt.action === "decline" ? "Reason for the student" : "Remarks (kept in the training history)"}
          required={prompt.action === "decline"}
          destructive={prompt.action !== "attended"}
          confirmLabel={prompt.action === "decline" ? "Decline" : "Save"}
          onConfirm={async (text) => {
            const ok = await act(prompt.session, prompt.action, text);
            if (ok) setPrompt(null);
            return ok;
          }}
        />
      ) : null}
    </>
  );
}
