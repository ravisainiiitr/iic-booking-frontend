export const FABRICATION_PROFILE_TYPES = ["PRINT_3D", "LASER_CUT_2D"] as const;

export function isFabricationProfile(profileType?: string | null): boolean {
  return (FABRICATION_PROFILE_TYPES as readonly string[]).includes(String(profileType || "").toUpperCase());
}
