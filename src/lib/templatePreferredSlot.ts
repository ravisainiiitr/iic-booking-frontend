import { parseISO } from "date-fns";
import type {
  BookingTemplate,
  BookingTemplateWriteBody,
  TemplateIfSlotTaken,
  TemplatePreferredSlot,
} from "@/lib/api";

export const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export const MAX_PREFERRED_SLOT_COUNT = 24;

export const IF_SLOT_TAKEN_OPTIONS: Array<{ value: TemplateIfSlotTaken; label: string; description: string }> = [
  {
    value: "ask",
    label: "Ask me (recommended)",
    description: "Nothing is booked. You see the nearest free slots and choose one yourself.",
  },
  {
    value: "next_available_same_day",
    label: "Book the next free slot later the same day",
    description: "Same number of slots and duration, after your preferred time, on the same date.",
  },
  {
    value: "next_available_any",
    label: "Book the next free slot on any day I can book",
    description: "Same number of slots and duration, after your preferred time, within the open booking window.",
  },
];

export const autoBookConsentText = (mode: TemplateIfSlotTaken) =>
  `I agree that if my preferred slot has just been taken when I click Book, the portal may book the next free slot ` +
  `after it (${mode === "next_available_same_day" ? "later the same day" : "on any day in the open booking window"}) ` +
  "with these same inputs and charge my wallet for it. Wallet balance, spending limits and booking quotas are still " +
  "checked, and the booking can be cancelled under the usual rules.";

export interface PreferredSlotDraft {
  enabled: boolean;
  weekday: number;
  startTime: string;
  slotCount: number;
  slotMaster: number | null;
  ifSlotTaken: TemplateIfSlotTaken;
  consent: boolean;
  /** Mode the server already holds consent for (consent need not be re-ticked to keep it). */
  consentedMode: TemplateIfSlotTaken | null;
}

export const emptyPreferredSlotDraft = (): PreferredSlotDraft => ({
  enabled: false,
  weekday: 2,
  startTime: "10:00",
  slotCount: 1,
  slotMaster: null,
  ifSlotTaken: "ask",
  consent: false,
  consentedMode: null,
});

export const draftFromTemplate = (t: Pick<BookingTemplate, "preferred_slot" | "if_slot_taken" | "if_slot_taken_consented_at">) => {
  const draft = emptyPreferredSlotDraft();
  const p = t.preferred_slot;
  if (p) {
    draft.enabled = true;
    draft.weekday = p.weekday;
    draft.startTime = p.start_time;
    draft.slotCount = p.slot_count || 1;
    draft.slotMaster = p.slot_master ?? null;
  }
  draft.ifSlotTaken = t.if_slot_taken ?? "ask";
  draft.consentedMode = t.if_slot_taken_consented_at && draft.ifSlotTaken !== "ask" ? draft.ifSlotTaken : null;
  draft.consent = draft.consentedMode != null;
  return draft;
};

export const draftFromPreferredSlot = (p: TemplatePreferredSlot): PreferredSlotDraft => ({
  ...emptyPreferredSlotDraft(),
  enabled: true,
  weekday: p.weekday,
  startTime: p.start_time,
  slotCount: p.slot_count || 1,
  slotMaster: p.slot_master ?? null,
});

export const draftNeedsConsent = (d: PreferredSlotDraft) =>
  d.enabled && d.ifSlotTaken !== "ask" && !d.consent && d.consentedMode !== d.ifSlotTaken;

export const draftToBody = (d: PreferredSlotDraft): Pick<BookingTemplateWriteBody, "preferred_slot" | "if_slot_taken" | "auto_book_consent"> => {
  if (!d.enabled) return { preferred_slot: null, if_slot_taken: "ask" };
  return {
    preferred_slot: {
      weekday: d.weekday,
      start_time: d.startTime,
      slot_count: Math.min(MAX_PREFERRED_SLOT_COUNT, Math.max(1, Math.round(d.slotCount) || 1)),
      slot_master: d.slotMaster,
    },
    if_slot_taken: d.ifSlotTaken,
    ...(d.ifSlotTaken !== "ask" && d.consent ? { auto_book_consent: true } : {}),
  };
};

const pad = (n: number) => String(n).padStart(2, "0");

/** Weekly preference from concrete slots (earliest start; local weekday/time like the slot grid). */
export const preferredSlotFromSlots = (
  slots: Array<{ start_datetime?: string | null; slot_master?: number | null } | null | undefined>
): TemplatePreferredSlot | null => {
  const starts = slots
    .filter((s): s is { start_datetime: string; slot_master?: number | null } => !!s?.start_datetime)
    .map((s) => ({ at: parseISO(s.start_datetime), master: s.slot_master ?? null }))
    .filter((s) => !Number.isNaN(s.at.getTime()))
    .sort((a, b) => a.at.getTime() - b.at.getTime());
  if (starts.length === 0) return null;
  const first = starts[0];
  return {
    weekday: (first.at.getDay() + 6) % 7,
    start_time: `${pad(first.at.getHours())}:${pad(first.at.getMinutes())}`,
    slot_count: Math.min(MAX_PREFERRED_SLOT_COUNT, starts.length),
    slot_master: first.master,
  };
};

export const describePreferredSlot = (p: Pick<TemplatePreferredSlot, "weekday" | "start_time" | "slot_count">) =>
  `${WEEKDAY_NAMES[p.weekday] ?? "?"} ${p.start_time}${p.slot_count > 1 ? ` · ${p.slot_count} slots` : ""}`;
