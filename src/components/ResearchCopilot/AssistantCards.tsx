import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Info,
  IndianRupee,
  Mail,
  MapPin,
  Phone,
  Plus,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";

/** Booking Assistant cards (`ba_*`): live availability, equipment facts and the confirm-gated booking flow. */

type Rec = Record<string, unknown>;

export type AssistantActionHandler = (label: string, type: string, payload: Rec) => void;

export const ASSISTANT_CARD_TYPES = new Set([
  "ba_equipment_options",
  "ba_flow_departments",
  "ba_flow_equipment",
  "ba_slots",
  "ba_booking_form",
  "ba_booking_summary",
  "ba_booking_handoff",
  "ba_equipment_info",
  "ba_bookings",
]);

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const arr = <T = Rec,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const inr = (v: unknown) => {
  const n = num(v);
  return n === null
    ? "—"
    : `\u20b9${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

function StepBadge({ step }: { step: unknown }) {
  const s = (step as Rec | null) ?? null;
  const index = num(s?.index);
  const total = num(s?.total) ?? 5;
  if (index === null) return null;
  return (
    <div className="mb-2 flex items-center gap-2" aria-label={`Step ${index} of ${total}`}>
      <div className="flex gap-1" aria-hidden>
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={`h-1.5 w-5 rounded-full ${i < index ? "bg-primary" : "bg-muted-foreground/25"}`}
          />
        ))}
      </div>
      <span className="text-[11px] font-medium text-muted-foreground">
        Step {index} of {total}
        {s?.label ? ` · ${str(s.label)}` : ""}
      </span>
    </div>
  );
}

function Shell({
  title,
  children,
  tone = "default",
  step,
}: {
  title?: string;
  children: React.ReactNode;
  tone?: "default" | "confirm";
  step?: unknown;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        tone === "confirm" ? "border-amber-300/70 bg-amber-50/50 dark:border-amber-700/60 dark:bg-amber-950/20" : "bg-background/70"
      }`}
    >
      <StepBadge step={step} />
      {title ? (
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      ) : null}
      {children}
    </div>
  );
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
        ok
          ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100"
          : "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100"
      }`}
    >
      {label}
    </span>
  );
}

type Props = {
  card: Rec;
  busy?: boolean;
  onAction: AssistantActionHandler;
  onNavigate: (href: string) => void;
  onHandoff: (href: string, prefill: Rec | undefined) => void;
  acked?: boolean;
  onAck?: (acked: boolean) => void;
};

const flow = (onAction: AssistantActionHandler, label: string, step: string, payload: Rec = {}) =>
  onAction(label, "ba_flow", { step, ...payload });

function EquipmentOptions({ card, busy, onAction }: Props) {
  const items = arr(card.items);
  const intent = str(card.intent) || "availability";
  const when = (card.when as Rec | null) ?? null;
  return (
    <Shell title={str(card.title) || "Choose equipment"}>
      <div className="space-y-1.5" role="list">
        {items.map((it) => {
          const id = num(it.equipment_id);
          if (id === null) return null;
          const bookable = it.bookable !== false;
          const free = num(it.free_slots);
          const meta = [str(it.code), str(it.department), str(it.location)].filter(Boolean).join(" · ");
          return (
            <button
              key={id}
              type="button"
              role="listitem"
              disabled={busy}
              onClick={() =>
                bookable
                  ? onAction(str(it.name), "ba_pick_equipment", { equipment_id: id, intent, when })
                  : onAction(str(it.name), "ba_info", { equipment_id: id, topic: "overview" })
              }
              className="flex w-full items-start justify-between gap-2 rounded-lg border bg-background px-3 py-2 text-left text-xs transition-colors hover:border-primary/50 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
            >
              <span className="min-w-0">
                <span className="block font-medium text-foreground">{str(it.name)}</span>
                {meta ? <span className="block truncate text-[11px] text-muted-foreground">{meta}</span> : null}
                {free !== null ? (
                  <span className="block text-[11px] text-muted-foreground">
                    {free > 0
                      ? `${free} free · first ${str(it.first_slot)}${it.first_date ? ` on ${str(it.first_date)}` : ""}`
                      : "No free slots in this window"}
                  </span>
                ) : null}
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                <StatusPill ok={bookable} label={bookable ? str(it.reason) || "Available" : str(it.status_label) || "Unavailable"} />
              </span>
            </button>
          );
        })}
      </div>
    </Shell>
  );
}

function FlowDepartments({ card, busy, onAction }: Props) {
  const items = arr(card.items);
  return (
    <Shell title={str(card.title) || "Choose a department"} step={card.step}>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2" role="list">
        {items.map((d) => {
          const id = num(d.department_id);
          if (id === null) return null;
          const count = num(d.count) ?? 0;
          return (
            <button
              key={id}
              type="button"
              role="listitem"
              disabled={busy}
              onClick={() => flow(onAction, str(d.name), "department", { department_id: id })}
              className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-left text-xs transition-colors hover:border-primary/50 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
            >
              <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-foreground">{str(d.name)}</span>
                <span className="block text-[11px] text-muted-foreground">
                  {count} instrument{count === 1 ? "" : "s"}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </Shell>
  );
}

function FlowEquipment({ card, busy, onAction }: Props) {
  const items = arr(card.items);
  const pick = (id: number, name: string) => flow(onAction, name, "equipment", { equipment_id: id });
  return (
    <Shell title={str(card.title) || "Choose equipment"} step={card.step}>
      <div className="space-y-1.5" role="list">
        {items.map((it) => {
          const id = num(it.equipment_id);
          if (id === null) return null;
          const hint = (it.price_hint as Rec | null) ?? null;
          const modes = arr(it.modes);
          const meta = [str(it.code), str(it.category), str(it.location)].filter(Boolean).join(" · ");
          return (
            <div key={id} role="listitem" className="rounded-lg border bg-background">
              <button
                type="button"
                disabled={busy}
                onClick={() => pick(id, str(it.name))}
                className="flex w-full items-start justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              >
                <span className="min-w-0">
                  <span className="block font-medium text-foreground">{str(it.name)}</span>
                  {meta ? <span className="block truncate text-[11px] text-muted-foreground">{meta}</span> : null}
                  {it.description ? (
                    <span className="mt-0.5 block line-clamp-2 text-[11px] text-muted-foreground">{str(it.description)}</span>
                  ) : null}
                </span>
                {hint && num(hint.total) !== null ? (
                  <span className="shrink-0 text-right text-[11px] text-muted-foreground">
                    <span className="block font-medium text-foreground">{inr(hint.total)}</span>
                    per sample{hint.gst_included ? " incl. GST" : ""}
                  </span>
                ) : null}
              </button>
              {modes.length ? (
                <div className="flex flex-wrap gap-1 border-t px-3 py-1.5">
                  <span className="mr-1 self-center text-[10px] uppercase tracking-wide text-muted-foreground">Modes</span>
                  {modes.map((m) => {
                    const mid = num(m.equipment_id);
                    if (mid === null) return null;
                    return (
                      <Button
                        key={mid}
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        className="h-6 rounded-full px-2 text-[11px]"
                        onClick={() => pick(mid, str(m.name))}
                      >
                        {str(m.name)}
                      </Button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      {num(card.more) ? (
        <p className="mt-2 text-[11px] text-muted-foreground">
          {str(card.more)} more not shown. Type the instrument name to pick it.
        </p>
      ) : null}
    </Shell>
  );
}

function Slots({ card, busy, onAction, onNavigate }: Props) {
  const eqId = num(card.equipment_id);
  const isFlow = card.flow === true;
  const days = arr(card.days);
  const nearest = arr(card.nearest_days);
  const similar = arr(card.similar);
  const nav = arr(card.nav);
  const dayChips = arr(card.day_chips);
  const canBook = card.can_book !== false;
  const est = (card.estimate as Rec | null) ?? null;
  const total = est ? (num(est.gst_amount) ? est.total : est.charge) : null;
  const needed = num(card.slots_needed) ?? 1;
  const minutes = num(card.required_minutes);
  const showWindow = (label: string, when: unknown) =>
    isFlow
      ? flow(onAction, label, "slots", { equipment_id: eqId, when })
      : onAction(label, "ba_availability", { equipment_id: eqId, when });
  const pick = (label: string, ids: number[]) =>
    isFlow
      ? flow(onAction, label, "slot", { equipment_id: eqId, slot_ids: ids })
      : onAction(label, "ba_pick_slot", { equipment_id: eqId, slot_ids: ids });
  return (
    <Shell title={`${str(card.equipment_name)} · ${str(card.window_label)}`} step={card.step}>
      {total !== null && total !== undefined ? (
        <div className="mb-2 flex items-center gap-1 text-[11px] text-muted-foreground">
          <IndianRupee className="h-3 w-3" />
          About {inr(total)} per sample{needed > 1 ? ` · ${needed}-slot blocks` : ""}
        </div>
      ) : null}
      {isFlow && minutes ? (
        <div className="mb-2 text-[11px] text-muted-foreground">
          Needs about {Math.round(minutes)} min{needed > 1 ? ` · ${needed} back-to-back slots` : " · 1 slot"}
        </div>
      ) : null}
      {isFlow && (nav.length || dayChips.length) ? (
        <div className="mb-2 flex flex-wrap items-center gap-1">
          {nav
            .filter((n) => str(n.label) === "Earlier")
            .map((n) => (
              <Button
                key="earlier"
                type="button"
                size="sm"
                variant="ghost"
                disabled={busy}
                className="h-7 gap-0.5 rounded-full px-2 text-xs"
                onClick={() => showWindow("Earlier", n.when)}
                aria-label="Earlier dates"
              >
                <ChevronLeft className="h-3 w-3" />
                Earlier
              </Button>
            ))}
          <div className="flex max-w-full gap-1 overflow-x-auto pb-0.5">
            {dayChips.map((d) => (
              <Button
                key={str((d.when as Rec | null)?.start)}
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                className="h-7 shrink-0 rounded-full px-2.5 text-xs"
                onClick={() => showWindow(str(d.label), d.when)}
              >
                {str(d.label)}
              </Button>
            ))}
          </div>
          {nav
            .filter((n) => str(n.label) === "Later")
            .map((n) => (
              <Button
                key="later"
                type="button"
                size="sm"
                variant="ghost"
                disabled={busy}
                className="h-7 gap-0.5 rounded-full px-2 text-xs"
                onClick={() => showWindow("Later", n.when)}
                aria-label="Later dates"
              >
                Later
                <ChevronRight className="h-3 w-3" />
              </Button>
            ))}
        </div>
      ) : null}
      {days.length ? (
        <div className="space-y-2">
          {days.map((d) => (
            <div key={str(d.date)}>
              <div className="mb-1 flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                <CalendarClock className="h-3 w-3" />
                {str(d.label)}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {arr(d.slots).map((s) => {
                  const ids = arr<number>(s.slot_ids).map(Number).filter(Number.isFinite);
                  return (
                    <Button
                      key={ids.join("-")}
                      type="button"
                      size="sm"
                      variant={s.best ? "default" : "outline"}
                      disabled={busy || !canBook || eqId === null || !ids.length}
                      className="h-7 rounded-full px-2.5 text-xs tabular-nums"
                      aria-label={`Book ${str(d.label)} ${str(s.label)}`}
                      onClick={() => pick(`${str(d.label)} · ${str(s.label)}`, ids)}
                    >
                      {str(s.label)}
                    </Button>
                  );
                })}
                {num(d.more) ? (
                  <button
                    type="button"
                    className="h-7 rounded-full px-2 text-xs text-primary underline-offset-2 hover:underline"
                    onClick={() =>
                      isFlow
                        ? showWindow(str(d.label), { start: str(d.date), end: str(d.date) })
                        : eqId !== null && onNavigate(`/book-equipment?equipment_id=${eqId}&date=${str(d.date)}`)
                    }
                  >
                    +{str(d.more)} more
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No free times in this window.</p>
      )}
      {nearest.length ? (
        <div className="mt-3">
          <div className="mb-1 text-[11px] font-medium text-muted-foreground">Nearest free days</div>
          <div className="flex flex-wrap gap-1.5">
            {nearest.map((n) => (
              <Button
                key={str(n.date)}
                type="button"
                size="sm"
                variant="outline"
                disabled={busy || eqId === null}
                className="h-7 rounded-full px-2.5 text-xs"
                onClick={() => showWindow(`${str(card.equipment_name)} on ${str(n.label)}`, n.when)}
              >
                {str(n.label)} ({str(n.count)})
              </Button>
            ))}
          </div>
        </div>
      ) : null}
      {similar.length ? (
        <div className="mt-3">
          <div className="mb-1 text-[11px] font-medium text-muted-foreground">Similar equipment</div>
          <EquipmentOptions
            card={{ items: similar, intent: "availability", when: card.when, title: "" }}
            busy={busy}
            onAction={onAction}
            onNavigate={onNavigate}
            onHandoff={() => undefined}
          />
        </div>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {card.waitlist_href ? (
          <button
            type="button"
            className="text-xs font-medium text-primary underline-offset-2 hover:underline"
            onClick={() => onNavigate(str(card.waitlist_href))}
          >
            Join the waitlist on the booking page
          </button>
        ) : null}
        {card.urgent_href ? (
          <button
            type="button"
            className="text-xs font-medium text-primary underline-offset-2 hover:underline"
            onClick={() => onNavigate(str(card.urgent_href))}
          >
            Urgent request on the booking page
          </button>
        ) : null}
      </div>
    </Shell>
  );
}

type FormField = {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  default?: unknown;
  help?: string;
  min?: number;
  max?: number;
  step?: number;
  allowed?: string[];
  locked?: string[];
};

type FieldValues = Record<string, string>;

const elementsKey = (f: FormField) => `${f.key}_elements`;
const fieldValueKey = (f: FormField) => (f.type === "PERIODIC_TABLE" ? elementsKey(f) : f.key);
const symbolsOf = (raw: string) =>
  raw
    .split(/[,\s;]+/)
    .map((s) => s.trim())
    .filter(Boolean);

function initialValues(fields: FormField[], source: Rec): FieldValues {
  const out: FieldValues = {};
  for (const f of fields) {
    const k = fieldValueKey(f);
    const v = source[k] ?? (f.type === "PERIODIC_TABLE" ? undefined : f.default);
    if (v !== undefined && v !== null && v !== "") out[k] = String(v);
  }
  return out;
}

function fieldMissing(f: FormField, values: FieldValues): boolean {
  if (!f.required) return false;
  const raw = str(values[fieldValueKey(f)]).trim();
  if (f.type === "PERIODIC_TABLE") {
    const locked = new Set(f.locked ?? []);
    return !symbolsOf(raw).some((s) => !locked.has(s));
  }
  if (f.type === "NUMERIC") return !raw || Number(raw) === 0;
  return !raw;
}

function cleanValues(fields: FormField[], values: FieldValues): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fields) {
    const k = fieldValueKey(f);
    const v = str(values[k]).trim();
    if (v) out[k] = v;
  }
  return out;
}

function PeriodicPicker({
  field,
  value,
  onChange,
  disabled,
}: {
  field: FormField;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const [filter, setFilter] = useState("");
  const selected = useMemo(() => new Set(symbolsOf(value)), [value]);
  const locked = useMemo(() => new Set(field.locked ?? []), [field.locked]);
  const allowed = field.allowed ?? [];
  const shown = filter ? allowed.filter((s) => s.toLowerCase().startsWith(filter.trim().toLowerCase())) : allowed;
  const toggle = (s: string) => {
    const next = new Set(selected);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    onChange(allowed.filter((x) => next.has(x)).join(","));
  };
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter, e.g. Fe"
          className="h-7 w-32 text-xs"
          aria-label={`Filter elements for ${field.label}`}
        />
        <span className="text-[11px] text-muted-foreground">
          {selected.size ? `${[...selected].join(", ")}` : "None selected"}
        </span>
      </div>
      <div className="flex max-h-32 flex-wrap gap-1 overflow-y-auto rounded-md border bg-background p-1.5" role="group" aria-label={field.label}>
        {shown.map((s) => {
          const on = selected.has(s);
          return (
            <button
              key={s}
              type="button"
              disabled={disabled}
              aria-pressed={on}
              title={locked.has(s) ? `${s} (always included, not billed)` : s}
              onClick={() => toggle(s)}
              className={`h-6 min-w-[2rem] rounded px-1 text-[11px] font-medium tabular-nums transition-colors ${
                on
                  ? "bg-primary text-primary-foreground"
                  : "border bg-background text-foreground hover:bg-muted"
              } ${locked.has(s) ? "ring-1 ring-amber-400/70" : ""}`}
            >
              {s}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FieldControl({
  f,
  idPrefix,
  values,
  set,
  disabled,
}: {
  f: FormField;
  idPrefix: string;
  values: FieldValues;
  set: (k: string, v: string) => void;
  disabled?: boolean;
}) {
  const id = `${idPrefix}-${f.key}`;
  const label = (
    <span className="mb-1 block font-medium">
      {f.label}
      {f.required ? <span className="text-destructive"> *</span> : null}
    </span>
  );
  if (f.type === "TOGGLE") {
    return (
      <label htmlFor={id} className="flex items-center gap-2 text-xs">
        <input
          id={id}
          type="checkbox"
          className="h-3.5 w-3.5"
          disabled={disabled}
          checked={str(values[f.key]).toLowerCase() === "true"}
          onChange={(e) => set(f.key, e.target.checked ? "true" : "false")}
        />
        <span className="font-medium">{f.label}</span>
      </label>
    );
  }
  if (f.type === "PERIODIC_TABLE") {
    return (
      <div className="block text-xs">
        {label}
        <PeriodicPicker field={f} value={str(values[elementsKey(f)])} onChange={(v) => set(elementsKey(f), v)} disabled={disabled} />
      </div>
    );
  }
  if ((f.type === "RADIO" || f.type === "COMBO") && f.options?.length) {
    return (
      <label htmlFor={id} className="block text-xs">
        {label}
        <select
          id={id}
          value={str(values[f.key])}
          disabled={disabled}
          onChange={(e) => set(f.key, e.target.value)}
          className="h-8 w-full rounded-md border bg-background px-2 text-xs"
        >
          <option value="">Select…</option>
          {f.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    );
  }
  const n = num(values[f.key]);
  const outOfRange = f.type === "NUMERIC" && n !== null && ((f.min !== undefined && n < f.min) || (f.max !== undefined && n > f.max));
  const atMax = f.type === "NUMERIC" && n !== null && f.max !== undefined && n === f.max;
  return (
    <label htmlFor={id} className="block text-xs">
      {label}
      <Input
        id={id}
        type={f.type === "NUMERIC" ? "number" : "text"}
        inputMode={f.type === "NUMERIC" ? "decimal" : undefined}
        min={f.min}
        max={f.max}
        step={f.step ?? (f.type === "NUMERIC" ? "any" : undefined)}
        value={str(values[f.key])}
        maxLength={500}
        disabled={disabled}
        onChange={(e) => set(f.key, e.target.value)}
        className="h-8 text-xs"
        aria-invalid={outOfRange}
        aria-valuemin={f.type === "NUMERIC" ? f.min : undefined}
        aria-valuemax={f.type === "NUMERIC" ? f.max : undefined}
        aria-describedby={f.type === "NUMERIC" ? `${id}-limit-hint` : undefined}
      />
      {f.type === "NUMERIC" && (f.min !== undefined || f.max !== undefined) ? (
        <span
          id={`${id}-limit-hint`}
          aria-live="polite"
          className={`mt-0.5 block text-[11px] ${outOfRange ? "text-destructive" : atMax ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`}
        >
          {atMax ? `Max ${f.max} reached` : `Allowed ${f.min ?? 1}–${f.max ?? "…"}`}
        </span>
      ) : f.help && f.type !== "NUMERIC" ? (
        <span className="mt-0.5 block text-[11px] text-muted-foreground">{f.help}</span>
      ) : null}
    </label>
  );
}

type SampleSet = { samples: string; values: FieldValues };

function numericOk(fields: FormField[], values: FieldValues): boolean {
  return fields.every((f) => {
    if (f.type !== "NUMERIC") return true;
    const n = num(values[f.key]);
    if (n === null) return true;
    return !((f.min !== undefined && n < f.min) || (f.max !== undefined && n > f.max));
  });
}

function Instruction({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  const long = text.length > 220;
  return (
    <div className="rounded-md border border-sky-300/60 bg-sky-50/60 px-2.5 py-2 text-xs dark:border-sky-800/60 dark:bg-sky-950/30">
      <div className="mb-1 flex items-center gap-1 font-medium text-sky-900 dark:text-sky-100">
        <Info className="h-3 w-3" />
        Important instructions
      </div>
      <p className="whitespace-pre-line text-foreground/90">{open || !long ? text : `${text.slice(0, 220)}…`}</p>
      {long ? (
        <button
          type="button"
          className="mt-1 text-[11px] font-medium text-primary underline-offset-2 hover:underline"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Show less" : "Read all"}
        </button>
      ) : null}
    </div>
  );
}

function BookingForm({ card, busy, onAction, onNavigate }: Props) {
  const samplesSpec = (card.samples as Rec | null) ?? null;
  const fields = arr<FormField>(card.fields);
  const initial = (card.values as Rec | undefined) ?? {};
  const isFlow = card.flow === true;
  const setsSpec = (card.sample_sets as Rec | null) ?? null;
  const setsAllowed = isFlow && setsSpec?.allowed === true;
  const maxSets = num(setsSpec?.max) ?? 20;
  const [samples, setSamples] = useState<string>(str(initial._samples ?? samplesSpec?.default ?? 1));
  const [values, setValues] = useState<FieldValues>(() => initialValues(fields, initial));
  const [sets, setSets] = useState<SampleSet[]>(() =>
    arr<Rec>(card.sets_values).map((s) => ({ samples: str(s.A ?? 1), values: initialValues(fields, s) })),
  );
  const eqId = num(card.equipment_id);
  const slotIds = arr<number>(card.slot_ids).map(Number).filter(Number.isFinite);
  const minS = num(samplesSpec?.min) ?? 1;
  const maxS = num(samplesSpec?.max) ?? 500;
  const countOk = (raw: string) => {
    const n = Math.trunc(Number(raw));
    return !samplesSpec || (Number.isFinite(n) && n >= minS && n <= maxS);
  };
  const samplesOk = countOk(samples);
  const missing = fields.filter((f) => fieldMissing(f, values));
  const setsOk = sets.every((s) => countOk(s.samples) && !fields.some((f) => fieldMissing(f, s.values)) && numericOk(fields, s.values));
  const valid = samplesOk && !missing.length && numericOk(fields, values) && setsOk;
  const set = (k: string, v: string) => setValues((p) => ({ ...p, [k]: v }));
  const setIn = (i: number, k: string, v: string) =>
    setSets((p) => p.map((s, j) => (j === i ? { ...s, values: { ...s.values, [k]: v } } : s)));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (eqId === null || !valid || (!isFlow && !slotIds.length)) return;
    const input_values = cleanValues(fields, values);
    const number_of_samples = samplesSpec ? Math.trunc(Number(samples)) : 1;
    if (!isFlow) {
      onAction("Review booking", "ba_review", { equipment_id: eqId, slot_ids: slotIds, number_of_samples, input_values });
      return;
    }
    const payload: Rec = {
      equipment_id: eqId,
      number_of_samples,
      input_values,
      sample_sets: sets.map((s) => ({ ...cleanValues(fields, s.values), A: String(Math.trunc(Number(s.samples)) || 1) })),
    };
    if (slotIds.length) payload.slot_ids = slotIds;
    flow(onAction, str(card.submit_label) || "Continue", "inputs", payload);
  };

  return (
    <Shell title={`${str(card.equipment_name)}${card.slot_label ? ` · ${str(card.slot_label)}` : ""}`} step={card.step}>
      <form className="space-y-2.5" onSubmit={submit}>
        {card.error ? (
          <p className="flex items-start gap-1 rounded-md bg-destructive/10 px-2 py-1.5 text-xs text-destructive" role="alert">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
            {str(card.error)}
          </p>
        ) : null}
        <Instruction text={str(card.instruction)} />
        {sets.length ? <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Sample set 1</div> : null}
        {samplesSpec ? (
          <label className="block text-xs">
            <span className="mb-1 block font-medium">{str(samplesSpec.label) || "Number of samples"}</span>
            <Input
              type="number"
              inputMode="numeric"
              min={minS}
              max={maxS}
              step={1}
              value={samples}
              onChange={(e) => setSamples(e.target.value)}
              className="h-8 w-28 text-xs"
              aria-invalid={!samplesOk}
            />
          </label>
        ) : null}
        {fields.map((f) => (
          <FieldControl key={f.key} f={f} idPrefix={`ba-${str(card.equipment_id)}`} values={values} set={set} disabled={busy} />
        ))}
        {sets.map((s, i) => (
          <div key={i} className="space-y-2 rounded-lg border border-dashed p-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Sample set {i + 2}</span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-6 gap-1 px-1.5 text-[11px]"
                onClick={() => setSets((p) => p.filter((_, j) => j !== i))}
                aria-label={`Remove sample set ${i + 2}`}
              >
                <Trash2 className="h-3 w-3" /> Remove
              </Button>
            </div>
            {samplesSpec ? (
              <label className="block text-xs">
                <span className="mb-1 block font-medium">{str(samplesSpec.label) || "Number of samples"}</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={minS}
                  max={maxS}
                  step={1}
                  value={s.samples}
                  onChange={(e) => setSets((p) => p.map((x, j) => (j === i ? { ...x, samples: e.target.value } : x)))}
                  className="h-8 w-28 text-xs"
                  aria-invalid={!countOk(s.samples)}
                />
              </label>
            ) : null}
            {fields.map((f) => (
              <FieldControl
                key={f.key}
                f={f}
                idPrefix={`ba-${str(card.equipment_id)}-set${i}`}
                values={s.values}
                set={(k, v) => setIn(i, k, v)}
                disabled={busy}
              />
            ))}
          </div>
        ))}
        {setsAllowed && sets.length < maxSets ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 gap-1 rounded-full px-2.5 text-xs"
            onClick={() => setSets((p) => [...p, { samples: "1", values: initialValues(fields, {}) }])}
          >
            <Plus className="h-3 w-3" /> Add a sample set with different parameters
          </Button>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button type="submit" size="sm" className="h-8 rounded-full px-3 text-xs" disabled={busy || !valid}>
            {str(card.submit_label) || "Review booking"}
          </Button>
          {card.booking_href ? (
            <button
              type="button"
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
              onClick={() => onNavigate(str(card.booking_href))}
            >
              Use the booking page instead
            </button>
          ) : null}
        </div>
        <p className="text-[11px] text-muted-foreground">Nothing is booked yet. You'll see the charges before confirming.</p>
      </form>
    </Shell>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-3 py-0.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`text-right ${strong ? "font-semibold" : ""}`}>{value}</dd>
    </div>
  );
}

function BookingSummary({ card, onHandoff, acked, onAck }: Props) {
  const inputs = arr<{ key: string; label: string; value: unknown }>(card.inputs);
  const warnings = arr<string>(card.warnings);
  const notes = arr<string>(card.notes);
  const lines = arr<{ label: string; amount: number }>(card.charge_lines);
  const spending = (card.spending as Rec | null) ?? null;
  const gst = num(card.gst_amount);
  const executable = card.executable === true;
  const expires = str(card.expires_at);
  const expiresAt = expires ? new Date(expires) : null;
  const ackRequired = executable && card.instruction_ack_required === true;
  const sets = num(card.sample_sets) ?? 0;
  return (
    <Shell title={str(card.title) || "Booking summary"} tone="confirm" step={card.step}>
      <dl className="space-y-0.5 text-xs">
        <SummaryRow label="Equipment" value={str(card.equipment_name)} strong />
        {card.department_name ? <SummaryRow label="Department" value={str(card.department_name)} /> : null}
        <SummaryRow label="When" value={str(card.when_label)} />
        <SummaryRow
          label="Slots"
          value={`${str(card.slot_count)}${num(card.slot_minutes) ? ` · ${str(card.slot_minutes)} min` : ""}`}
        />
        {num(card.required_minutes) ? <SummaryRow label="Analysis time" value={`about ${Math.round(Number(card.required_minutes))} min`} /> : null}
        <SummaryRow label="Samples" value={`${str(card.sample_count)}${sets ? ` + ${sets} more set${sets === 1 ? "" : "s"}` : ""}`} />
        {inputs.map((i) => (
          <SummaryRow key={i.key} label={i.label} value={str(i.value)} />
        ))}
        <div className="my-1 border-t border-border/60" />
        {lines.map((l, i) => (
          <SummaryRow key={`${l.label}-${i}`} label={l.label || "Charge"} value={inr(l.amount)} />
        ))}
        <SummaryRow label="Charge" value={inr(card.charge ?? card.estimated_amount)} />
        {gst ? <SummaryRow label={`GST ${str(card.gst_percent)}%`} value={inr(gst)} /> : null}
        <SummaryRow label="Total" value={inr(card.total_amount ?? card.estimated_amount)} strong />
        <SummaryRow label="Charged to" value={str(card.wallet_label) || "Your wallet"} />
        {num(card.wallet_balance) !== null ? <SummaryRow label="Wallet balance" value={inr(card.wallet_balance)} /> : null}
        {num(card.balance_after_total) !== null ? <SummaryRow label="Balance after" value={inr(card.balance_after_total)} /> : null}
        {num(card.amount_due) ? <SummaryRow label="To pay online" value={inr(card.amount_due)} strong /> : null}
        {spending && num(spending.weekly_remaining) !== null ? (
          <SummaryRow label="Weekly limit left" value={inr(spending.weekly_remaining)} />
        ) : null}
        {spending && num(spending.monthly_remaining) !== null ? (
          <SummaryRow label="Monthly limit left" value={inr(spending.monthly_remaining)} />
        ) : null}
      </dl>
      {card.cancellation_policy_note ? (
        <p className="mt-2 text-[11px] text-muted-foreground">{str(card.cancellation_policy_note)}</p>
      ) : null}
      {notes.map((n) => (
        <p key={n} className="mt-1 text-[11px] text-muted-foreground">
          {n}
        </p>
      ))}
      {warnings.map((w) => (
        <p key={w} className="mt-2 flex items-start gap-1 text-[11px] font-medium text-amber-800 dark:text-amber-200" role="alert">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          {w}
        </p>
      ))}
      {card.instruction ? (
        <div className="mt-2">
          <Instruction text={str(card.instruction)} />
        </div>
      ) : null}
      {ackRequired ? (
        <label className="mt-2 flex items-start gap-2 text-xs font-medium">
          <input
            type="checkbox"
            className="mt-0.5 h-3.5 w-3.5"
            checked={Boolean(acked)}
            disabled={!onAck}
            onChange={(e) => onAck?.(e.target.checked)}
          />
          I have read the instructions above.
        </label>
      ) : null}
      {executable ? (
        <p className="mt-2 flex items-start gap-1 text-[11px] font-medium text-amber-900 dark:text-amber-100">
          <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0" />
          Nothing is booked until you press Confirm booking
          {expiresAt && !Number.isNaN(expiresAt.getTime())
            ? ` (valid until ${expiresAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`
            : ""}
          .
        </p>
      ) : card.booking_href ? (
        <Button
          type="button"
          size="sm"
          className="mt-3 h-8 gap-1 rounded-full px-3 text-xs"
          onClick={() => onHandoff(str(card.booking_href), card.prefill as Rec | undefined)}
        >
          Continue on booking page <ExternalLink className="h-3 w-3" />
        </Button>
      ) : null}
    </Shell>
  );
}

function Handoff({ card, onHandoff }: Props) {
  const reasons = arr<string>(card.reason);
  return (
    <Shell title={`${str(card.equipment_name)}${card.slot_label ? ` · ${str(card.slot_label)}` : ""}`} step={card.step}>
      {reasons.length ? (
        <p className="text-xs text-muted-foreground">Needs on the booking page: {reasons.join(", ")}.</p>
      ) : null}
      <Button
        type="button"
        size="sm"
        className="mt-2 h-8 gap-1 rounded-full px-3 text-xs"
        onClick={() => onHandoff(str(card.href), card.prefill as Rec | undefined)}
      >
        Open booking page <ExternalLink className="h-3 w-3" />
      </Button>
    </Shell>
  );
}

function EquipmentInfo({ card, onNavigate }: Props) {
  const contacts = arr<{ role: string; name: string; email?: string; phone?: string; office?: string }>(card.contacts);
  const charges = (card.charges as Rec | undefined) ?? undefined;
  const inputs = arr<{ key: string; label: string; required?: boolean; options?: string[] }>(card.inputs);
  const rules = arr<string>(card.rules);
  const focus = str(card.focus);
  const bookable = card.bookable === true;
  return (
    <Shell>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <button
            type="button"
            className="text-left text-sm font-semibold text-foreground underline-offset-2 hover:underline"
            onClick={() => onNavigate(str(card.href))}
          >
            {str(card.name)}
          </button>
          <div className="text-[11px] text-muted-foreground">
            {[str(card.code), str(card.department), str(card.category)].filter(Boolean).join(" · ")}
          </div>
        </div>
        <StatusPill ok={bookable} label={str(card.status_label)} />
      </div>
      {(focus === "overview" || focus === "location") && (card.location || card.office_address) ? (
        <div className="mt-2 flex items-start gap-1 text-xs">
          <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
          <span>
            {str(card.location)}
            {card.office_address ? <span className="block text-muted-foreground">Office: {str(card.office_address)}</span> : null}
            {card.maps_url ? (
              <a
                href={str(card.maps_url)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-0.5 inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline"
              >
                Open in Maps <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          </span>
        </div>
      ) : null}
      {focus === "overview" && card.description ? (
        <p className="mt-2 line-clamp-4 text-xs text-muted-foreground">{str(card.description)}</p>
      ) : null}
      {contacts.length ? (
        <div className="mt-2 space-y-1.5">
          {contacts.map((c, i) => (
            <div key={`${c.name}-${i}`} className="rounded-lg border bg-background px-2.5 py-1.5 text-xs">
              <div className="flex items-center gap-1 font-medium">
                <UserRound className="h-3 w-3 text-muted-foreground" />
                {c.name} <span className="font-normal text-muted-foreground">· {c.role}</span>
              </div>
              <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
                {c.email ? (
                  <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline">
                    <Mail className="h-3 w-3" />
                    {c.email}
                  </a>
                ) : null}
                {c.phone ? (
                  <a href={`tel:${c.phone.split("/")[0].trim()}`} className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline">
                    <Phone className="h-3 w-3" />
                    {c.phone}
                  </a>
                ) : null}
                {c.office ? <span className="text-muted-foreground">{c.office}</span> : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {charges && num(charges.charge) !== null ? (
        <dl className="mt-2 space-y-0.5 rounded-lg border bg-background px-2.5 py-1.5 text-xs">
          <SummaryRow label={`1 sample · ${str(charges.user_category)}`} value={inr(charges.charge)} strong />
          {num(charges.gst_amount) ? <SummaryRow label={`Incl. GST ${str(charges.gst_percent)}%`} value={inr(charges.total)} /> : null}
          {num(charges.slots_needed) && Number(charges.slots_needed) > 1 ? (
            <SummaryRow label="Slots per sample" value={str(charges.slots_needed)} />
          ) : null}
        </dl>
      ) : null}
      {focus !== "overview" && card.instructions ? (
        <p className="mt-2 whitespace-pre-line text-xs">{str(card.instructions)}</p>
      ) : null}
      {focus === "inputs" && inputs.length ? (
        <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs">
          {inputs.map((f) => (
            <li key={f.key}>
              {f.label}
              {f.required ? " (required)" : ""}
              {f.options?.length ? <span className="text-muted-foreground"> — {f.options.slice(0, 5).join(", ")}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {focus === "rules" && rules.length ? (
        <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs">
          {rules.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      ) : null}
    </Shell>
  );
}

const STOPPED_STATUSES = new Set(["CANCELLED", "REFUNDED", "ABSENT", "BOOKING_NOT_UTILIZED"]);

function Bookings({ card, busy, onAction, onNavigate }: Props) {
  const items = arr(card.items);
  return (
    <Shell title={str(card.title) || "Bookings"}>
      <ol className="space-y-1.5" aria-label={str(card.title) || "Bookings"}>
        {items.map((b, i) => {
          const actions = arr(b.actions).filter((a) => str(a.action_type) && a.enabled !== false);
          const ref = str(b.reference);
          return (
            <li key={`${ref}-${i}`} className="rounded-lg border bg-background text-xs">
              <button
                type="button"
                onClick={() => onNavigate(str(b.href))}
                aria-label={`${i + 1}. ${str(b.equipment)}, ${str(b.when)}, ${ref}, ${str(b.status_label)} — open in My Bookings`}
                className="flex w-full items-start justify-between gap-2 rounded-t-lg px-3 py-2 text-left hover:bg-muted"
              >
                <span className="flex min-w-0 gap-2">
                  {items.length > 1 ? (
                    <span className="mt-0.5 text-[10px] font-semibold text-muted-foreground" aria-hidden>
                      {i + 1}
                    </span>
                  ) : null}
                  <span className="min-w-0">
                    <span className="block font-medium">{str(b.equipment)}</span>
                    <span className="block break-all text-[11px] text-muted-foreground">
                      {str(b.when)}
                      {ref ? ` · ${ref}` : ""}
                    </span>
                    {b.cutoff && b.self_service_open ? (
                      <span className="block text-[10px] text-muted-foreground">Change or cancel until {str(b.cutoff)}</span>
                    ) : null}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <StatusPill ok={!STOPPED_STATUSES.has(str(b.status))} label={str(b.status_label)} />
                  {num(b.charge) !== null ? <span className="text-[11px] text-muted-foreground">{inr(b.charge)}</span> : null}
                </span>
              </button>
              {actions.length ? (
                <div className="flex flex-wrap gap-1 border-t px-2 py-1.5" role="group" aria-label={`Actions for ${ref || str(b.equipment)}`}>
                  {actions.map((a) => (
                    <Button
                      key={str(a.id) || str(a.label)}
                      type="button"
                      size="sm"
                      variant={a.primary ? "default" : "outline"}
                      disabled={busy}
                      className="h-7 rounded-full px-2.5 text-[11px]"
                      onClick={() => onAction(str(a.utterance) || str(a.label), str(a.action_type), (a.payload as Rec) || {})}
                    >
                      {str(a.label)}
                    </Button>
                  ))}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
      {card.prompt ? <p className="mt-2 text-xs font-medium text-foreground">{str(card.prompt)}</p> : null}
    </Shell>
  );
}

export function AssistantCard(props: Props) {
  switch (str(props.card.type)) {
    case "ba_equipment_options":
      return <EquipmentOptions {...props} />;
    case "ba_flow_departments":
      return <FlowDepartments {...props} />;
    case "ba_flow_equipment":
      return <FlowEquipment {...props} />;
    case "ba_slots":
      return <Slots {...props} />;
    case "ba_booking_form":
      return <BookingForm {...props} />;
    case "ba_booking_summary":
      return <BookingSummary {...props} />;
    case "ba_booking_handoff":
      return <Handoff {...props} />;
    case "ba_equipment_info":
      return <EquipmentInfo {...props} />;
    case "ba_bookings":
      return <Bookings {...props} />;
    default:
      return null;
  }
}
