export type EquipmentCardAccent = {
  gradient: string;
  bar: string;
  button: string;
  border: string;
};

/** Unified purple theme for all equipment catalog cards (matches Book now CTA). */
export const EQUIPMENT_CARD_PURPLE_ACCENT: EquipmentCardAccent = {
  gradient: "from-[#5849E8] to-[#6B5CEB]",
  bar: "from-[#5849E8] to-[#7B8CF0]",
  button: "bg-[#5849E8] hover:bg-[#4A3CD4]",
  border: "hover:border-[#C5BFF8] dark:hover:border-[#5849E8]/40",
};

/** @deprecated Use EQUIPMENT_CARD_PURPLE_ACCENT — kept so length-based helpers stay valid. */
export const EQUIPMENT_CARD_ACCENTS: EquipmentCardAccent[] = [EQUIPMENT_CARD_PURPLE_ACCENT];

/**
 * Deterministic accent index for an equipment id.
 * Kept for API compatibility; all cards now share the purple theme.
 */
export function accentIndexForEquipmentId(id: string | number, mod = EQUIPMENT_CARD_ACCENTS.length): number {
  const s = String(id ?? "");
  // Lightweight non-cryptographic hash (djb2 variant).
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
  }
  const n = Math.abs(h) % (mod || 1);
  return n;
}

export function accentForEquipmentId(_id: string | number): EquipmentCardAccent {
  return EQUIPMENT_CARD_PURPLE_ACCENT;
}
