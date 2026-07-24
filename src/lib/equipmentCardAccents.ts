export type EquipmentCardAccent = {
  gradient: string;
  bar: string;
  button: string;
  border: string;
};

/** Navy Ocean accent for equipment catalog cards (white cards + navy actions). */
export const EQUIPMENT_CARD_NAVY_ACCENT: EquipmentCardAccent = {
  gradient: "from-primary to-[hsl(215_62%_22%)]",
  bar: "from-primary to-[hsl(215_62%_22%)]",
  button: "bg-primary hover:bg-primary/90 shadow-md shadow-primary/25",
  border: "border-border/70",
};

/** @deprecated Use EQUIPMENT_CARD_NAVY_ACCENT */
export const EQUIPMENT_CARD_TEAL_ACCENT: EquipmentCardAccent = EQUIPMENT_CARD_NAVY_ACCENT;

/** @deprecated Use EQUIPMENT_CARD_NAVY_ACCENT */
export const EQUIPMENT_CARD_PURPLE_ACCENT: EquipmentCardAccent = EQUIPMENT_CARD_NAVY_ACCENT;

/** @deprecated Use EQUIPMENT_CARD_NAVY_ACCENT — kept so length-based helpers stay valid. */
export const EQUIPMENT_CARD_ACCENTS: EquipmentCardAccent[] = [EQUIPMENT_CARD_NAVY_ACCENT];

/**
 * Deterministic accent index for an equipment id.
 * Kept for API compatibility; all cards now share the navy theme.
 */
export function accentIndexForEquipmentId(id: string | number, mod = EQUIPMENT_CARD_ACCENTS.length): number {
  const s = String(id ?? "");
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
  }
  const n = Math.abs(h) % (mod || 1);
  return n;
}

export function accentForEquipmentId(_id: string | number): EquipmentCardAccent {
  return EQUIPMENT_CARD_NAVY_ACCENT;
}
