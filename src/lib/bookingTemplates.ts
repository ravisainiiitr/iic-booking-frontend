import { format, parseISO } from "date-fns";
import type { BookingTemplate, BookingTemplateOptions, BookingTemplateWriteBody, TemplateIfSlotTaken } from "@/lib/api";
import { catalogParentId, type CatalogEquipmentLike } from "@/lib/equipmentCatalog";

export const BOOKING_TEMPLATES_PATH = "/booking-templates";
const MAX_TEMPLATE_NAME_LENGTH = 80;
const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const TEMPLATE_OPTION_LABELS: Array<[keyof BookingTemplateOptions, string]> = [
  ["auto_slot_selection", "Auto-select slots"],
  ["book_any_available_slots", "Book any available slots"],
  ["book_even_if_single_slot_available", "Single slot is fine"],
  ["waitlist_on_failure", "Waitlist if unsuccessful"],
  ["auto_allocate_alternative", "Auto-allocate alternate equipment"],
  ["sample_return_after_analysis", "Return sample"],
  ["atmosphere_sensitive_sample", "Atmosphere-sensitive sample"],
];

export const IF_SLOT_TAKEN_SHORT: Record<TemplateIfSlotTaken, string> = {
  ask: "Ask me if it is taken",
  next_available_same_day: "Auto-book next free slot same day",
  next_available_any: "Auto-book next free slot any day",
};

export const filledInputCount = (values: Record<string, unknown>) =>
  Object.entries(values || {}).filter(([key, v]) => {
    if (key === "comments" || key.startsWith("_")) return false;
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
