export type EquipmentCardAccent = {
  gradient: string;
  bar: string;
  button: string;
  border: string;
};

// Same accent definitions used by /equipments cards.
export const EQUIPMENT_CARD_ACCENTS: EquipmentCardAccent[] = [
  { gradient: "from-indigo-500 to-blue-600", bar: "from-indigo-500 to-blue-500", button: "bg-indigo-600 hover:bg-indigo-700", border: "hover:border-indigo-200 dark:hover:border-indigo-800" },
  { gradient: "from-emerald-500 to-teal-600", bar: "from-emerald-500 to-teal-500", button: "bg-emerald-600 hover:bg-emerald-700", border: "hover:border-emerald-200 dark:hover:border-emerald-800" },
  { gradient: "from-violet-500 to-purple-600", bar: "from-violet-500 to-purple-500", button: "bg-violet-600 hover:bg-violet-700", border: "hover:border-violet-200 dark:hover:border-violet-800" },
  { gradient: "from-amber-500 to-orange-600", bar: "from-amber-500 to-orange-500", button: "bg-amber-600 hover:bg-amber-700", border: "hover:border-amber-200 dark:hover:border-amber-800" },
  { gradient: "from-sky-500 to-blue-600", bar: "from-sky-500 to-blue-500", button: "bg-sky-600 hover:bg-sky-700", border: "hover:border-sky-200 dark:hover:border-sky-800" },
  { gradient: "from-rose-500 to-pink-600", bar: "from-rose-500 to-pink-500", button: "bg-rose-600 hover:bg-rose-700", border: "hover:border-rose-200 dark:hover:border-rose-800" },
];

/**
 * Deterministic accent index for an equipment id.
 * Keeps the same equipment card accent across pages and sessions.
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

export function accentForEquipmentId(id: string | number): EquipmentCardAccent {
  return EQUIPMENT_CARD_ACCENTS[accentIndexForEquipmentId(id, EQUIPMENT_CARD_ACCENTS.length)];
}

