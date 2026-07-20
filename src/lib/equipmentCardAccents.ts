export type EquipmentCardAccent = {
  gradient: string;
  bar: string;
  button: string;
  border: string;
};

/** Unified teal theme for all equipment catalog cards (matches portal branding). */
export const EQUIPMENT_CARD_TEAL_ACCENT: EquipmentCardAccent = {
  gradient: "from-teal-600 to-cyan-700",
  bar: "from-teal-600 to-teal-800",
  button: "bg-teal-700 hover:bg-teal-800 shadow-sm shadow-teal-900/20",
  border: "border-border/80 hover:border-teal-300/60 dark:hover:border-teal-700/50",
};

/** @deprecated Use EQUIPMENT_CARD_TEAL_ACCENT */
export const EQUIPMENT_CARD_PURPLE_ACCENT: EquipmentCardAccent = EQUIPMENT_CARD_TEAL_ACCENT;

/** @deprecated Use EQUIPMENT_CARD_TEAL_ACCENT — kept so length-based helpers stay valid. */
export const EQUIPMENT_CARD_ACCENTS: EquipmentCardAccent[] = [EQUIPMENT_CARD_TEAL_ACCENT];

/**
 * Deterministic accent index for an equipment id.
 * Kept for API compatibility; all cards now share the teal theme.
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
  return EQUIPMENT_CARD_TEAL_ACCENT;
}
