import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BadgeCheck, CalendarClock, MapPin, UserRound } from "lucide-react";

/** Structured cards produced by the Copilot intelligence layer (metadata.intelligence === true). */

export type ChoiceHandler = (kind: string, value: string, label: string) => void;

type Rec = Record<string, unknown>;

type ChoiceOption = { value: string; label: string; description?: string };

type RowAction = { id?: string; label: string; choice?: { kind: string; value: string } };

export const INTELLIGENCE_CARD_TYPES = new Set([
  "choice_list",
  "equipment_list",
  "equipment_card",
  "slot_list",
  "form_request",
  "cost_estimate",
  "technique_comparison",
  "booking_selection",
  "cancel_mode",
  "knowledge_answer",
  "support_offer",
]);

const inr = (v: unknown) => {
  if (v === null || v === undefined || v === "") return "not available";
  const n = Number(v);
  return Number.isFinite(n)
    ? `\u20b9${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : String(v);
};

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

function slotValue(item: Rec): string {
  const ids = Array.isArray(item.slot_ids) ? (item.slot_ids as unknown[]) : [];
  return ids.map((x) => String(x)).join(",");
}

/** `kind:value` keys of choices a card already renders, so duplicate action buttons can be hidden. */
export function renderedChoiceKeys(cards: Rec[] | undefined): Set<string> {
  const keys = new Set<string>();
  for (const card of cards || []) {
    const items = (Array.isArray(card.items) ? card.items : []) as Rec[];
    if (card.type === "equipment_list") {
      for (const item of items) {
        for (const a of (Array.isArray(item.actions) ? item.actions : []) as RowAction[]) {
          if (a.choice) keys.add(`${a.choice.kind}:${a.choice.value}`);
        }
      }
    } else if (card.type === "slot_list") {
      const kind = str(card.choice_kind) || "slot";
      for (const item of items) keys.add(`${kind}:${slotValue(item)}`);
    } else if (card.type === "booking_selection") {
      for (const item of items) keys.add(`${str(card.kind)}:${str(item.booking_id)}`);
    } else if (card.type === "cancel_mode") {
      for (const o of (Array.isArray(card.options) ? card.options : []) as ChoiceOption[]) {
        keys.add(`cancel_mode:${o.value}`);
      }
    } else if (card.type === "choice_list" && card.multi) {
      for (const o of (Array.isArray(card.options) ? card.options : []) as ChoiceOption[]) {
        keys.add(`${str(card.kind)}:${o.value}`);
      }
    }
  }
  return keys;
}

function CardShell({ title, children, tone = "default" }: { title?: string; children: React.ReactNode; tone?: "default" | "verified" }) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        tone === "verified" ? "border-emerald-300/60 bg-emerald-50/40 dark:bg-emerald-950/20" : "bg-background/70"
      }`}
    >
      {title ? (
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      ) : null}
      {children}
    </div>
  );
}

function MultiChoice({
  card,
  interactive,
  busy,
  onChoice,
}: {
  card: Rec;
  interactive: boolean;
  busy?: boolean;
  onChoice: ChoiceHandler;
}) {
  const options = (Array.isArray(card.options) ? card.options : []) as ChoiceOption[];
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (v: string) => setPicked((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]));
  return (
    <CardShell title={str(card.prompt) || "Select"}>
      <div className="space-y-1">
        {options.map((o) => (
          <label key={o.value} className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-xs hover:bg-muted">
            <input
              type="checkbox"
              className="h-3.5 w-3.5"
              checked={picked.includes(o.value)}
              disabled={!interactive || busy}
              onChange={() => toggle(o.value)}
            />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
      <Button
        type="button"
        size="sm"
        className="mt-2 h-8 text-xs"
        disabled={!interactive || busy || picked.length === 0}
        onClick={() => {
          const labels = options.filter((o) => picked.includes(o.value)).map((o) => o.label);
          onChoice(str(card.kind), picked.join(","), labels.join("; "));
        }}
      >
        {str(card.submit_label) || "Continue"}
        {picked.length ? ` (${picked.length})` : ""}
      </Button>
    </CardShell>
  );
}

function FormRequest({
  card,
  interactive,
  busy,
  onText,
}: {
  card: Rec;
  interactive: boolean;
  busy?: boolean;
  onText: (text: string) => void;
}) {
  const fields = (Array.isArray(card.fields) ? card.fields : []) as Rec[];
  const field = fields[0];
  const [value, setValue] = useState("");
  if (!field || (Array.isArray(field.options) && field.options.length > 0) || str(field.type) === "TOGGLE") return null;
  const numeric = str(field.type) === "NUMERIC";
  const submit = () => {
    const v = value.trim();
    if (!v) return;
    onText(v);
    setValue("");
  };
  return (
    <CardShell title={str(card.equipment_name) || undefined}>
      <label className="mb-1 block text-xs font-medium">{str(field.label)}</label>
      {field.help ? <p className="mb-1 text-[11px] text-muted-foreground">{str(field.help)}</p> : null}
      <div className="flex gap-2">
        <Input
          type={numeric ? "number" : "text"}
          inputMode={numeric ? "numeric" : undefined}
          min={numeric && field.min !== undefined ? Number(field.min) : undefined}
          max={numeric && field.max !== undefined ? Number(field.max) : undefined}
          value={value}
          disabled={!interactive || busy}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className="h-8 text-xs"
        />
        <Button type="button" size="sm" className="h-8 text-xs" disabled={!interactive || busy || !value.trim()} onClick={submit}>
          {str(card.submit_label) || "Continue"}
        </Button>
      </div>
    </CardShell>
  );
}

export function IntelligenceCard({
  card,
  interactive,
  busy,
  onChoice,
  onText,
}: {
  card: Rec;
  interactive: boolean;
  busy?: boolean;
  onChoice: ChoiceHandler;
  onText: (text: string) => void;
}) {
  const items = (Array.isArray(card.items) ? card.items : []) as Rec[];
  const choiceButton = (kind: string, value: string, label: string, key: string, primary = false) => (
    <Button
      key={key}
      type="button"
      size="sm"
      variant={primary ? "default" : "outline"}
      className="h-7 px-2 text-[11px]"
      disabled={!interactive || busy}
      onClick={() => onChoice(kind, value, label)}
    >
      {label}
    </Button>
  );

  switch (card.type) {
    case "choice_list":
      return card.multi ? <MultiChoice card={card} interactive={interactive} busy={busy} onChoice={onChoice} /> : null;

    case "equipment_list":
      if (!items.length) return null;
      return (
        <CardShell title={str(card.title)}>
          <ul className="space-y-2">
            {items.map((item) => {
              const actions = (Array.isArray(item.actions) ? item.actions : []) as RowAction[];
              return (
                <li key={str(item.id)} className="rounded-lg border border-border/60 p-2">
                  <div className="text-xs font-semibold">
                    {str(item.name)}
                    {item.bookable === false ? (
                      <span className="ml-1 font-normal text-amber-700 dark:text-amber-300">({str(item.status_label)})</span>
                    ) : null}
                  </div>
                  {item.department || item.location ? (
                    <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {[str(item.department), str(item.location)].filter(Boolean).join(" \u00b7 ")}
                    </div>
                  ) : null}
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {actions.map((a, i) =>
                      a.choice ? choiceButton(a.choice.kind, a.choice.value, a.label, `${a.choice.value}-${i}`, a.label === "Book") : null,
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          {Number(card.total) > items.length + Number(card.offset || 0) ? (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Showing {Number(card.offset || 0) + 1}-{Number(card.offset || 0) + items.length} of {Number(card.total)}
            </p>
          ) : null}
        </CardShell>
      );

    case "equipment_card":
      return (
        <CardShell title="Equipment">
          <div className="text-sm font-semibold">
            {str(card.name)}
            {card.code ? <span className="ml-1 text-xs font-normal text-muted-foreground">({str(card.code)})</span> : null}
          </div>
          <ul className="mt-1 space-y-0.5 text-xs">
            <li>Status: {str(card.status_label) || "Unknown"}</li>
            {card.department ? <li>Department: {str(card.department)}</li> : null}
            {card.location ? (
              <li className="flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {str(card.location)}
              </li>
            ) : null}
            {Array.isArray(card.oic) && card.oic.length ? (
              <li className="flex items-center gap-1">
                <UserRound className="h-3 w-3" /> Officer in charge: {(card.oic as unknown[]).map(str).join(", ")}
              </li>
            ) : null}
          </ul>
        </CardShell>
      );

    case "slot_list": {
      const kind = str(card.choice_kind) || "slot";
      return (
        <CardShell title={`${str(card.equipment_name)}${card.window ? ` \u00b7 ${str(card.window)}` : ""}`}>
          {items.length ? (
            <div className="flex flex-wrap gap-1.5">
              {items.map((item, i) => (
                <Button
                  key={`${slotValue(item)}-${i}`}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1 px-2 text-[11px]"
                  disabled={!interactive || busy}
                  onClick={() => onChoice(kind, slotValue(item), str(item.label))}
                >
                  <CalendarClock className="h-3 w-3" />
                  {str(item.label)}
                </Button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No slots in this window.</p>
          )}
        </CardShell>
      );
    }

    case "form_request":
      return <FormRequest card={card} interactive={interactive} busy={busy} onText={onText} />;

    case "cost_estimate":
      return (
        <CardShell title="Cost estimate">
          <div className="space-y-2">
            {items.map((item, i) => (
              <div key={i} className="rounded-lg border border-border/60 p-2 text-xs">
                <div className="font-semibold">{str(item.equipment_name)}</div>
                {item.charge === null || item.charge === undefined ? (
                  <div className="text-muted-foreground">No estimate available.</div>
                ) : (
                  <ul className="mt-1 space-y-0.5">
                    <li>
                      {str(item.sample_label) || "Samples"}: {str(item.samples)}
                    </li>
                    {item.total_time_minutes ? <li>Instrument time: {Math.round(Number(item.total_time_minutes))} min</li> : null}
                    {item.profile_type ? (
                      <li className="text-muted-foreground">
                        Pricing basis: {str(item.profile_type).replace(/_/g, " ").toLowerCase()} profile
                      </li>
                    ) : null}
                    <li>Charge: {inr(item.charge)}</li>
                    {Number(item.gst_percent) > 0 ? (
                      <li>
                        GST ({Number(item.gst_percent)}%): {inr(item.gst_amount)}
                      </li>
                    ) : null}
                    <li className="font-semibold">Estimated total: {inr(item.total)}</li>
                  </ul>
                )}
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">The booking page shows the final charge.</p>
        </CardShell>
      );

    case "technique_comparison":
      return (
        <CardShell title="Comparison">
          <div className="grid gap-2 sm:grid-cols-2">
            {items.map((item, i) => {
              const rows = (Array.isArray(item.items) ? item.items : []) as Rec[];
              return (
                <div key={i} className="rounded-lg border border-border/60 p-2 text-xs">
                  <div className="font-semibold">{str(item.technique)}</div>
                  <p className="mt-0.5 text-muted-foreground">{str(item.summary)}</p>
                  <div className="mt-1 text-[11px]">
                    IIC: {rows.length ? rows.map((r) => str(r.name)).join(", ") : "none listed for your account"}
                  </div>
                </div>
              );
            })}
          </div>
        </CardShell>
      );

    case "booking_selection":
      return (
        <CardShell title="Your upcoming bookings">
          <ul className="space-y-1.5">
            {items.map((item) => (
              <li key={str(item.booking_id)} className="flex items-center justify-between gap-2 text-xs">
                <span className="min-w-0">
                  <span className="font-medium">{str(item.label)}</span>
                  {item.self_service_open === false ? (
                    <span className="ml-1 text-amber-700 dark:text-amber-300">(admin only)</span>
                  ) : null}
                </span>
                {choiceButton(str(card.kind), str(item.booking_id), "Select", `b-${str(item.booking_id)}`)}
              </li>
            ))}
          </ul>
        </CardShell>
      );

    case "cancel_mode": {
      const options = (Array.isArray(card.options) ? card.options : []) as ChoiceOption[];
      return (
        <CardShell title="Entire booking or part of it?">
          <div className="flex flex-wrap gap-1.5">
            {options.map((o) => choiceButton("cancel_mode", o.value, o.label, o.value, o.value === "entire"))}
          </div>
        </CardShell>
      );
    }

    case "knowledge_answer":
      return (
        <div className="flex items-center gap-1.5 text-[11px] text-emerald-800 dark:text-emerald-200">
          <BadgeCheck className="h-3.5 w-3.5" />
          Verified IIC answer
          {card.updated_at ? (
            <span className="text-muted-foreground">
              {" \u00b7 updated "}
              {new Date(str(card.updated_at)).toLocaleDateString()}
            </span>
          ) : null}
        </div>
      );

    default:
      return null;
  }
}
