import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle,
  CalendarClock,
  ExternalLink,
  IndianRupee,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  UserRound,
} from "lucide-react";

/** Booking Assistant cards (`ba_*`): live availability, equipment facts and the confirm-gated booking flow. */

type Rec = Record<string, unknown>;

export type AssistantActionHandler = (label: string, type: string, payload: Rec) => void;

export const ASSISTANT_CARD_TYPES = new Set([
  "ba_equipment_options",
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

function Shell({ title, children, tone = "default" }: { title?: string; children: React.ReactNode; tone?: "default" | "confirm" }) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        tone === "confirm" ? "border-amber-300/70 bg-amber-50/50 dark:border-amber-700/60 dark:bg-amber-950/20" : "bg-background/70"
      }`}
    >
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
};

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

function Slots({ card, busy, onAction, onNavigate }: Props) {
  const eqId = num(card.equipment_id);
  const days = arr(card.days);
  const nearest = arr(card.nearest_days);
  const similar = arr(card.similar);
  const canBook = card.can_book !== false;
  const est = (card.estimate as Rec | null) ?? null;
  const total = est ? (num(est.gst_amount) ? est.total : est.charge) : null;
  return (
    <Shell title={`${str(card.equipment_name)} · ${str(card.window_label)}`}>
      {total !== null && total !== undefined ? (
        <div className="mb-2 flex items-center gap-1 text-[11px] text-muted-foreground">
          <IndianRupee className="h-3 w-3" />
          About {inr(total)} per sample{num(card.slots_needed) && Number(card.slots_needed) > 1 ? ` · ${str(card.slots_needed)}-slot blocks` : ""}
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
                      onClick={() => onAction(`${str(d.label)} · ${str(s.label)}`, "ba_pick_slot", { equipment_id: eqId, slot_ids: ids })}
                    >
                      {str(s.label)}
                    </Button>
                  );
                })}
                {num(d.more) ? (
                  <button
                    type="button"
                    className="h-7 rounded-full px-2 text-xs text-primary underline-offset-2 hover:underline"
                    onClick={() => eqId !== null && onNavigate(`/book-equipment?equipment_id=${eqId}&date=${str(d.date)}`)}
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
                onClick={() => onAction(`${str(card.equipment_name)} on ${str(n.label)}`, "ba_availability", { equipment_id: eqId, when: n.when })}
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
      {card.waitlist_href ? (
        <button
          type="button"
          className="mt-2 text-xs font-medium text-primary underline-offset-2 hover:underline"
          onClick={() => onNavigate(str(card.waitlist_href))}
        >
          Join the waitlist on the booking page
        </button>
      ) : null}
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
};

function BookingForm({ card, busy, onAction, onNavigate }: Props) {
  const samplesSpec = (card.samples as Rec | null) ?? null;
  const fields = arr<FormField>(card.fields);
  const initial = (card.values as Rec | undefined) ?? {};
  const [samples, setSamples] = useState<string>(str(initial._samples ?? samplesSpec?.default ?? 1));
  const [values, setValues] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const f of fields) {
      const v = initial[f.key] ?? f.default;
      if (v !== undefined && v !== null && v !== "") out[f.key] = String(v);
    }
    return out;
  });
  const eqId = num(card.equipment_id);
  const slotIds = arr<number>(card.slot_ids).map(Number).filter(Number.isFinite);
  const minS = num(samplesSpec?.min) ?? 1;
  const maxS = num(samplesSpec?.max) ?? 500;
  const sampleN = Math.trunc(Number(samples));
  const samplesOk = !samplesSpec || (Number.isFinite(sampleN) && sampleN >= minS && sampleN <= maxS);
  const missing = fields.filter((f) => f.required && !str(values[f.key]).trim());
  const set = (k: string, v: string) => setValues((p) => ({ ...p, [k]: v }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (eqId === null || !slotIds.length || !samplesOk || missing.length) return;
    const input_values: Record<string, string> = {};
    for (const f of fields) if (str(values[f.key]).trim()) input_values[f.key] = str(values[f.key]).trim();
    onAction("Review booking", "ba_review", {
      equipment_id: eqId,
      slot_ids: slotIds,
      number_of_samples: samplesSpec ? sampleN : 1,
      input_values,
    });
  };

  return (
    <Shell title={`${str(card.equipment_name)} · ${str(card.slot_label)}`}>
      <form className="space-y-2.5" onSubmit={submit}>
        {card.error ? (
          <p className="flex items-start gap-1 rounded-md bg-destructive/10 px-2 py-1.5 text-xs text-destructive" role="alert">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
            {str(card.error)}
          </p>
        ) : null}
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
        {fields.map((f) => {
          const id = `ba-${str(card.equipment_id)}-${f.key}`;
          const label = (
            <span className="mb-1 block font-medium">
              {f.label}
              {f.required ? <span className="text-destructive"> *</span> : null}
            </span>
          );
          if (f.type === "TOGGLE") {
            return (
              <label key={f.key} htmlFor={id} className="flex items-center gap-2 text-xs">
                <input
                  id={id}
                  type="checkbox"
                  className="h-3.5 w-3.5"
                  checked={str(values[f.key]).toLowerCase() === "true"}
                  onChange={(e) => set(f.key, e.target.checked ? "true" : "false")}
                />
                <span className="font-medium">{f.label}</span>
              </label>
            );
          }
          if ((f.type === "RADIO" || f.type === "COMBO") && f.options?.length) {
            return (
              <label key={f.key} htmlFor={id} className="block text-xs">
                {label}
                <select
                  id={id}
                  value={str(values[f.key])}
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
          return (
            <label key={f.key} htmlFor={id} className="block text-xs">
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
                onChange={(e) => set(f.key, e.target.value)}
                className="h-8 text-xs"
              />
              {f.help && f.type !== "NUMERIC" ? <span className="mt-0.5 block text-[11px] text-muted-foreground">{f.help}</span> : null}
            </label>
          );
        })}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button type="submit" size="sm" className="h-8 rounded-full px-3 text-xs" disabled={busy || !samplesOk || missing.length > 0}>
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

function BookingSummary({ card, onHandoff }: Props) {
  const inputs = arr<{ key: string; label: string; value: unknown }>(card.inputs);
  const warnings = arr<string>(card.warnings);
  const notes = arr<string>(card.notes);
  const gst = num(card.gst_amount);
  const executable = card.executable === true;
  const expires = str(card.expires_at);
  const expiresAt = expires ? new Date(expires) : null;
  return (
    <Shell title={str(card.title) || "Booking summary"} tone="confirm">
      <dl className="space-y-0.5 text-xs">
        <SummaryRow label="Equipment" value={str(card.equipment_name)} strong />
        <SummaryRow label="When" value={str(card.when_label)} />
        <SummaryRow label="Slots" value={str(card.slot_count)} />
        <SummaryRow label="Samples" value={str(card.sample_count)} />
        {inputs.map((i) => (
          <SummaryRow key={i.key} label={i.label} value={str(i.value)} />
        ))}
        <div className="my-1 border-t border-border/60" />
        <SummaryRow label="Charge" value={inr(card.charge ?? card.estimated_amount)} />
        {gst ? <SummaryRow label={`GST ${str(card.gst_percent)}%`} value={inr(gst)} /> : null}
        <SummaryRow label="Estimated total" value={inr(card.total_amount ?? card.estimated_amount)} strong />
        <SummaryRow label="Charged to" value={str(card.wallet_label) || "Your wallet"} />
        {num(card.wallet_balance) !== null ? <SummaryRow label="Wallet balance" value={inr(card.wallet_balance)} /> : null}
        {num(card.balance_after_total) !== null ? <SummaryRow label="Balance after" value={inr(card.balance_after_total)} /> : null}
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
    <Shell title={`${str(card.equipment_name)}${card.slot_label ? ` · ${str(card.slot_label)}` : ""}`}>
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

function Bookings({ card, onNavigate }: Props) {
  const items = arr(card.items);
  return (
    <Shell title={str(card.title) || "Bookings"}>
      <div className="space-y-1.5">
        {items.map((b) => (
          <button
            key={str(b.booking_id)}
            type="button"
            onClick={() => onNavigate(str(b.href))}
            className="flex w-full items-start justify-between gap-2 rounded-lg border bg-background px-3 py-2 text-left text-xs hover:bg-muted"
          >
            <span className="min-w-0">
              <span className="block font-medium">{str(b.equipment)}</span>
              <span className="block text-[11px] text-muted-foreground">
                {str(b.when)} · #{str(b.reference)}
              </span>
            </span>
            <span className="flex shrink-0 flex-col items-end gap-1">
              <StatusPill ok={str(b.status) !== "CANCELLED"} label={str(b.status_label)} />
              {num(b.charge) !== null ? <span className="text-[11px] text-muted-foreground">{inr(b.charge)}</span> : null}
            </span>
          </button>
        ))}
      </div>
    </Shell>
  );
}

export function AssistantCard(props: Props) {
  switch (str(props.card.type)) {
    case "ba_equipment_options":
      return <EquipmentOptions {...props} />;
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
