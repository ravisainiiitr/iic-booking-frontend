import { format, parseISO } from "date-fns";
import type { BookingTemplate, BookingTemplateOptions, BookingTemplateWriteBody } from "@/lib/api";
import { catalogParentId, type CatalogEquipmentLike } from "@/lib/equipmentCatalog";
import { normaliseTemplateSlotOptions, slotFallbackFrom, slotFallbackSummary } from "@/lib/slotOptions";

export const BOOKING_TEMPLATES_PATH = "/booking-templates";
const MAX_TEMPLATE_NAME_LENGTH = 80;
const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Option badges on template cards; how slots are chosen and the fallback are shown by templateSlotSummary. */
export const TEMPLATE_OPTION_LABELS: Array<[keyof BookingTemplateOptions, string]> = [
  ["waitlist_on_failure", "Waitlist if nothing is booked"],
  ["auto_allocate_alternative", "Auto-allocate alternate equipment"],
  ["sample_return_after_analysis", "Return sample"],
  ["atmosphere_sensitive_sample", "Atmosphere-sensitive sample"],
];

/** "Auto-select slots" / "You pick the slots" and "If taken: …" for a template card (preferred slot shown separately). */
export function templateSlotSummary(t: Pick<BookingTemplate, "options" | "preferred_slot" | "if_slot_taken" | "if_slot_taken_consented_at">) {
  const { options, ifSlotTaken } = normaliseTemplateSlotOptions(t);
  const fallback = slotFallbackFrom({
    bookAny: options.book_any_available_slots === true,
    single: options.book_even_if_single_slot_available === true,
    templateMode: t.if_slot_taken_consented_at ? ifSlotTaken : null,
  });
  return {
    choice: t.preferred_slot ? null : options.auto_slot_selection ? "Auto-select slots" : "You pick the slots",
    fallback,
    fallbackLabel: slotFallbackSummary(fallback),
    autoBooks: fallback !== "none",
  };
}

export const filledInputCount = (values: Record<string, unknown>) =>
  Object.entries(values || {}).filter(([key, v]) => {
    // A periodic-table field and its chosen elements are one input.
    if (key === "comments" || key.startsWith("_") || key.endsWith("_elements")) return false;
    if (Array.isArray(v)) return v.length > 0;
    return v !== null && v !== undefined && String(v).trim() !== "";
  }).length;

export const formatTemplateUpdated = (iso: string | null | undefined) => {
  if (!iso) return null;
  try {
    return format(parseISO(iso), "d MMM yyyy, HH:mm");
  } catch {
    return null;
  }
};

/** e.g. "Tue · 10:00, 1 slot" */
export const shortPreferredSlotLabel = (p: NonNullable<BookingTemplate["preferred_slot"]>) => {
  const count = p.slot_count || 1;
  return `${WEEKDAY_SHORT[p.weekday] ?? "?"} · ${p.start_time}, ${count} slot${count === 1 ? "" : "s"}`;
};

const withReturn = (params: URLSearchParams, returnTo?: string) => {
  if (returnTo) params.set("return_to", returnTo);
  return `/book-equipment?${params.toString()}`;
};

export const bookWithTemplateUrl = (t: Pick<BookingTemplate, "id" | "equipment">) =>
  `/book-equipment?${new URLSearchParams({ equipment_id: String(t.equipment), template: String(t.id) }).toString()}`;

export const createTemplateUrl = (equipmentId: number, returnTo?: string) =>
  withReturn(new URLSearchParams({ equipment_id: String(equipmentId), mode: "template" }), returnTo);

export const editTemplateUrl = (t: Pick<BookingTemplate, "id" | "equipment">, returnTo?: string) =>
  withReturn(
    new URLSearchParams({ equipment_id: String(t.equipment), mode: "template", template_id: String(t.id) }),
    returnTo
  );

/** "Name (copy)", "Name (copy 2)", … not already used for this equipment, within the name length limit. */
export const copyTemplateName = (name: string, takenNames: Iterable<string>) => {
  const taken = new Set([...takenNames].map((n) => n.trim().toLowerCase()));
  for (let i = 1; i < 100; i += 1) {
    const suffix = i === 1 ? " (copy)" : ` (copy ${i})`;
    const candidate = `${name.slice(0, MAX_TEMPLATE_NAME_LENGTH - suffix.length).trimEnd()}${suffix}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return `${name.slice(0, MAX_TEMPLATE_NAME_LENGTH - 9).trimEnd()} (copy ${Date.now() % 1000})`;
};

type PickerEquipment = CatalogEquipmentLike & { name: string; status?: string | null };

/** Operational equipment with each multi-mode child listed right under its parent, as in the catalog. */
export function orderEquipmentForPicker<T extends PickerEquipment>(list: T[]): Array<{ equipment: T; parentName: string | null }> {
  const active = list.filter((eq) => (eq.status || "").toUpperCase() === "ACTIVE");
  const byName = (a: T, b: T) => a.name.localeCompare(b.name);
  const ids = new Set(active.map((eq) => Number(eq.equipment_id)));
  const childrenOf = new Map<number, T[]>();
  const roots: T[] = [];
  for (const eq of active) {
    const parent = catalogParentId(eq);
    if (parent != null && ids.has(parent)) {
      childrenOf.set(parent, [...(childrenOf.get(parent) ?? []), eq]);
    } else {
      roots.push(eq);
    }
  }
  const rows: Array<{ equipment: T; parentName: string | null }> = [];
  for (const root of roots.sort(byName)) {
    rows.push({ equipment: root, parentName: null });
    for (const child of (childrenOf.get(Number(root.equipment_id)) ?? []).sort(byName)) {
      rows.push({ equipment: child, parentName: root.name });
    }
  }
  return rows;
}

/**
 * Body for a copy of ``t``. Automatic booking of the next free slot needs its own consent,
 * so the copy goes back to "Ask me" until the user edits it.
 */
export const duplicateTemplateBody = (
  t: BookingTemplate,
  name: string
): BookingTemplateWriteBody & { equipment: number } => ({
  equipment: t.equipment,
  name,
  input_values: t.input_values || {},
  options: t.options || {},
  preferred_slot: t.preferred_slot
    ? {
        weekday: t.preferred_slot.weekday,
        start_time: t.preferred_slot.start_time,
        slot_count: t.preferred_slot.slot_count || 1,
        slot_master: t.preferred_slot.slot_master ?? null,
      }
    : null,
  if_slot_taken: "ask",
});
