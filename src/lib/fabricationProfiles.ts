export const FABRICATION_PROFILE_TYPES = ["PRINT_3D", "LASER_CUT_2D"] as const;

export function isFabricationProfile(profileType?: string | null): boolean {
  return (FABRICATION_PROFILE_TYPES as readonly string[]).includes(String(profileType || "").toUpperCase());
}

/** Shown to users when the equipment supports no enabled material from the Fabrication Materials master list. */
export const NO_FABRICATION_MATERIALS_MESSAGE = "No materials configured — contact the OIC.";
