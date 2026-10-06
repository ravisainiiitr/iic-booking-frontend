import { useCallback, useEffect, useState } from "react";
import { CalendarPlus, Loader2, Lock, MapPin, Pencil, Unlock, Users, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { reservationConflicts, trainingApi } from "@/lib/trainingApi";
import type { ReservationConflict, SessionType, TrainingEvent, TrainingSession } from "@/lib/trainingTypes";
import { FreeWindowFinder } from "./FreeWindowFinder";
import {
  SESSION_TYPE_OPTIONS,
  addMinutesIso,
  formatDateTime,
  formatWindow,
  fromLocalInputValue,
  humanizeCode,
  toLocalInputValue,
} from "./trainingHelpers";
import { ConflictList, EmptyState, LoadingBlock, PromptDialog, StatusChip, runTrainingAction } from "./trainingUi";

type SessionDialogState = { mode: "add"; event: TrainingEvent } | { mode: "edit"; event: TrainingEvent; session: TrainingSession } | null;

function SessionDialog({ state, onClose, onSaved }: { state: SessionDialogState; onClose: () => void; onSaved: () => void }) {
  const editing = state?.mode === "edit" ? state.session : null;
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [title, setTitle] = useState("");
  const [type, setType] = useState<SessionType>("HANDS_ON");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [reserve, setReserve] = useState(true);
  const [busy, setBusy] = useState(false);
  const [conflicts, setConflicts] = useState<ReservationConflict[]>([]);

  useEffect(() => {
    if (!state) return;
    setConflicts([]);
    setStart(toLocalInputValue(editing?.start_at));
    setEnd(toLocalInputValue(editing?.end_at));
    setTitle(editing?.title ?? "");
    setType(editing?.session_type ?? "HANDS_ON");
    setLocation(editing?.location ?? state.event.venue ?? "");
    setNotes("");
    setReserve(true);
  }, [state, editing]);

  const durationMinutes = (() => {
    const s = fromLocalInputValue(start);
    const e = fromLocalInputValue(end);
    if (!s || !e) return 120;
    const mins = Math.round((new Date(e).getTime() - new Date(s).getTime()) / 60_000);
    return mins > 0 ? mins : 120;
  })();

  const submit = async () => {
    if (!state) return;
    const startIso = fromLocalInputValue(start);
    const endIso = fromLocalInputValue(end);
    if (!startIso || !endIso || new Date(endIso) <= new Date(startIso)) {
      toast.error("Enter a valid start and end time.");
      return;
    }
    setBusy(true);
    setConflicts([]);
    const res =
      state.mode === "add"
        ? await runTrainingAction(
            trainingApi.addSession(state.event.id, {
              start_at: startIso,
              end_at: endIso,
              title: title.trim() || undefined,
              session_type: type,
              location: location.trim() || undefined,
              notes: notes.trim() || undefined,
              reserve_slots: reserve,
            }),
            "Session added.",
          )
        : await runTrainingAction(
            trainingApi.updateSession(state.session.id, {
              start_at: startIso,
              end_at: endIso,
              title: title.trim(),
              location: location.trim(),
              notes: notes.trim() || undefined,
            }),
            "Session updated.",
          );
    setBusy(false);
    if (res.error) {
      setConflicts(reservationConflicts(res));
      return;
    }
    onSaved();
    onClose();
  };

  return (
    <Dialog open={Boolean(state)} onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{state?.mode === "edit" ? "Reschedule session" : "Add session"}</DialogTitle>
          <DialogDescription>{state?.event.title}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="session-start">Start</Label>
              <Input
                id="session-start"
                type="datetime-local"
                value={start}
                onChange={(e) => {
                  const value = e.target.value;
                  setStart(value);
                  const iso = fromLocalInputValue(value);
                  if (iso && (!end || end <= value)) setEnd(toLocalInputValue(addMinutesIso(iso, 120)));
                }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="session-end">End</Label>
              <Input id="session-end" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          {state?.event.equipment?.equipment_id ? (
            <FreeWindowFinder
              compact
              equipmentId={state.event.equipment.equipment_id}
              durationMinutes={durationMinutes}
              onPick={(s, e) => {
                setStart(toLocalInputValue(s));
                setEnd(toLocalInputValue(e));
              }}
            />
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="session-title">Title</Label>
              <Input id="session-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Sample loading" />
            </div>
            {state?.mode === "add" ? (
              <div className="space-y-1">
                <Label>Type</Label>
                <Select value={type} onValueChange={(v) => setType(v as SessionType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SESSION_TYPE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>
          <div className="space-y-1">
            <Label htmlFor="session-location">Location</Label>
            <Input id="session-location" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="session-notes">Notes</Label>
            <Textarea id="session-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {state?.mode === "add" ? (
            <label className="flex items-center justify-between gap-3 rounded-lg border border-border/70 p-2.5 text-sm">
              <span>
                Reserve instrument slots
                <span className="block text-xs text-muted-foreground">Blocks the equipment calendar for this session.</span>
              </span>
              <Switch checked={reserve} onCheckedChange={setReserve} />
            </label>
          ) : editing?.slots_reserved ? (
            <p className="text-xs text-muted-foreground">Reserved slots move with the session.</p>
          ) : null}
          <ConflictList conflicts={conflicts} />
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Close
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={busy}>
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            {state?.mode === "edit" ? "Save" : "Add session"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditEventDialog({ event, onClose, onSaved }: { event: TrainingEvent | null; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [venue, setVenue] = useState("");
  const [capacity, setCapacity] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!event) return;
    setTitle(event.title);
    setVenue(event.venue ?? "");
    setCapacity(event.capacity != null ? String(event.capacity) : "");
    setDescription(event.description ?? "");
  }, [event]);

  const submit = async () => {
    if (!event) return;
    setBusy(true);
    const res = await runTrainingAction(
      trainingApi.updateEvent(event.id, {
        title: title.trim(),
        venue: venue.trim(),
        description: description.trim(),
        capacity: capacity === "" ? null : Number(capacity),
      }),
      "Event updated.",
    );
    setBusy(false);
    if (!res.error) {
      onSaved();
      onClose();
    }
  };

  return (
    <Dialog open={Boolean(event)} onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit event</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="event-title">Title</Label>
            <Input id="event-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="event-venue">Venue</Label>
              <Input id="event-venue" value={venue} onChange={(e) => setVenue(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="event-capacity">Capacity</Label>
              <Input id="event-capacity" type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="event-description">Description</Label>
            <Textarea id="event-description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Close
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={busy || !title.trim()}>
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const STATUS_FILTERS = [
  { value: "all", label: "All events" },
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

/** Training events and their sessions: add, reschedule, cancel, and reserve/release instrument slots. */
export function EventsPanel() {
  const [events, setEvents] = useState<TrainingEvent[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("all");
  const [sessionDialog, setSessionDialog] = useState<SessionDialogState>(null);
  const [editEvent, setEditEvent] = useState<TrainingEvent | null>(null);
  const [cancelEvent, setCancelEvent] = useState<TrainingEvent | null>(null);
  const [cancelSession, setCancelSession] = useState<TrainingSession | null>(null);
  const [busySession, setBusySession] = useState<number | null>(null);
  const [conflictsBySession, setConflictsBySession] = useState<Record<number, ReservationConflict[]>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const res = await trainingApi.events({ status: status === "all" ? undefined : status });
    setLoading(false);
    if (res.error) {
      toast.error(res.error);
      setEvents([]);
      return;
    }
    setEvents(res.data?.results ?? []);
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleSlots = async (session: TrainingSession) => {
    setBusySession(session.id);
    const res = await runTrainingAction(
      session.slots_reserved ? trainingApi.releaseSession(session.id) : trainingApi.reserveSession(session.id),
      session.slots_reserved ? "Instrument slots released." : "Instrument slots reserved.",
    );
    setBusySession(null);
    setConflictsBySession((prev) => ({ ...prev, [session.id]: res.error ? reservationConflicts(res) : [] }));
    if (!res.error) void load();
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">Hands-on training events are created when you open a nomination call.</p>
      </div>

      {loading && !events ? (
        <LoadingBlock />
      ) : !events?.length ? (
        <EmptyState icon={<CalendarPlus className="h-8 w-8" />} title="No training events" description="Open a nomination call to create a hands-on training event." />
      ) : (
        <div className="space-y-3">
          {events.map((event) => {
            const closed = ["CANCELLED", "COMPLETED"].includes(String(event.status).toUpperCase());
            return (
              <article key={event.id} className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
                <header className="flex flex-wrap items-start justify-between gap-2 border-b border-border/60 bg-muted/30 px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{event.title}</h3>
                      <StatusChip kind="event" status={event.status} label={event.status_label} />
                      <span className="text-xs text-muted-foreground">{event.kind_label || humanizeCode(event.kind)}</span>
                    </div>
                    <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      <span>
                        {event.equipment?.name} ({event.equipment?.code})
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3 w-3" aria-hidden /> {event.registrations}
                        {event.capacity ? ` / ${event.capacity}` : ""} registered
                      </span>
                      {event.venue ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" aria-hidden /> {event.venue}
                        </span>
                      ) : null}
                      {event.registration_closes_at ? <span>Registration closes {formatDateTime(event.registration_closes_at)}</span> : null}
                    </p>
                    {event.cancelled_reason ? <p className="mt-0.5 text-xs text-muted-foreground">Cancelled: {event.cancelled_reason}</p> : null}
                  </div>
                  {!closed ? (
                    <div className="flex flex-wrap gap-1.5">
                      <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => setSessionDialog({ mode: "add", event })}>
                        <CalendarPlus className="mr-1.5 h-4 w-4" aria-hidden /> Add session
                      </Button>
                      <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => setEditEvent(event)}>
                        <Pencil className="h-4 w-4" aria-hidden />
                        <span className="sr-only">Edit event</span>
                      </Button>
                      <Button type="button" size="sm" variant="ghost" className="h-8 text-destructive hover:text-destructive" onClick={() => setCancelEvent(event)}>
                        <XCircle className="h-4 w-4" aria-hidden />
                        <span className="sr-only">Cancel event</span>
                      </Button>
                    </div>
                  ) : null}
                </header>
                {event.sessions?.length ? (
                  <ul className="divide-y divide-border/60">
                    {[...event.sessions]
                      .sort((a, b) => a.seq - b.seq)
                      .map((s) => {
                        const editable = !["CANCELLED", "COMPLETED"].includes(s.status) && !closed;
                        return (
                          <li key={s.id} className="space-y-2 px-4 py-2.5">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-xs font-semibold text-muted-foreground">#{s.seq}</span>
                                  <span className="text-sm font-medium">{s.title || humanizeCode(s.session_type)}</span>
                                  <StatusChip kind="session" status={s.status} label={s.status_label} />
                                  {s.slots_reserved ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-300">
                                      <Lock className="h-3 w-3" aria-hidden /> Slots reserved
                                    </span>
                                  ) : null}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {formatWindow(s.start_at, s.end_at)}
                                  {s.location ? ` · ${s.location}` : ""}
                                  {s.attendance_marked_at ? ` · attendance marked ${formatDateTime(s.attendance_marked_at)}` : ""}
                                </p>
                              </div>
                              {editable ? (
                                <div className="flex flex-wrap gap-1.5">
                                  <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => setSessionDialog({ mode: "edit", event, session: s })}>
                                    Reschedule
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="h-8"
                                    disabled={busySession === s.id}
                                    onClick={() => void toggleSlots(s)}
                                  >
                                    {busySession === s.id ? (
                                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                                    ) : s.slots_reserved ? (
                                      <Unlock className="mr-1.5 h-4 w-4" aria-hidden />
                                    ) : (
                                      <Lock className="mr-1.5 h-4 w-4" aria-hidden />
                                    )}
                                    {s.slots_reserved ? "Release slots" : "Reserve slots"}
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 text-destructive hover:text-destructive"
                                    onClick={() => setCancelSession(s)}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              ) : null}
                            </div>
                            <ConflictList conflicts={conflictsBySession[s.id] ?? []} />
                          </li>
                        );
                      })}
                  </ul>
                ) : (
                  <p className="px-4 py-3 text-sm text-muted-foreground">No sessions yet.</p>
                )}
              </article>
            );
          })}
        </div>
      )}

      <SessionDialog state={sessionDialog} onClose={() => setSessionDialog(null)} onSaved={() => void load()} />
      <EditEventDialog event={editEvent} onClose={() => setEditEvent(null)} onSaved={() => void load()} />
      <PromptDialog
        open={Boolean(cancelEvent)}
        onOpenChange={(open) => !open && setCancelEvent(null)}
        title="Cancel this training event?"
        description="All sessions are cancelled, reserved slots are released and registered participants are notified."
        confirmLabel="Cancel event"
        destructive
        onConfirm={async (reason) => {
          if (!cancelEvent) return true;
          const res = await runTrainingAction(trainingApi.cancelEvent(cancelEvent.id, reason), "Event cancelled.");
          if (res.error) return false;
          void load();
          return true;
        }}
      />
      <PromptDialog
        open={Boolean(cancelSession)}
        onOpenChange={(open) => !open && setCancelSession(null)}
        title="Cancel this session?"
        description="Reserved instrument slots for this session are released."
        label=""
        required={false}
        confirmLabel="Cancel session"
        destructive
        onConfirm={async () => {
          if (!cancelSession) return true;
          const res = await runTrainingAction(trainingApi.cancelSession(cancelSession.id), "Session cancelled.");
          if (res.error) return false;
          void load();
          return true;
        }}
      />
    </div>
  );
}
