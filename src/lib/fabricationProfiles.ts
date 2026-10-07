export const FABRICATION_PROFILE_TYPES = ["PRINT_3D", "LASER_CUT_2D"] as const;

export function isFabricationProfile(profileType?: string | null): boolean {
  return (FABRICATION_PROFILE_TYPES as readonly string[]).includes(String(profileType || "").toUpperCase());
}

/** Shown to users when the equipment supports no enabled material from the Fabrication Materials master list. */
export const NO_FABRICATION_MATERIALS_MESSAGE = "No materials configured — contact the OIC.";

/** Input A of 3D print / laser equipment: how many times the whole job (every file with its copies) is made. */
export const FABRICATION_QUANTITY_KEY = "A";
export const FABRICATION_QUANTITY_LABEL = "Quantity Required";
export const MAX_FABRICATION_QUANTITY = 1000;

/** Quantity Required from a form value: a whole number from 1 to 1000, otherwise 1. */
export function fabricationJobQuantity(value: unknown): number {
  const n = typeof value === "number" ? value : Number(String(value ?? "").trim());
  if (!Number.isInteger(n) || n < 1 || n > MAX_FABRICATION_QUANTITY) return 1;
  return n;
}

/** Inputs the server fills for a 3D print booking from the STL analysis (B = material, C = print time). */
export const PRINT_3D_SERVER_KEYS: readonly string[] = ["B", "C"];
