/**
 * Slot Tolerance allocation helpers (mirrors backend slot_allocation.py).
 *
 * NumberOfSlots = max(1, ceil((AnalysisTime − SlotTolerance) / SlotDuration))
 * When tolerance is 0 this equals ceil(AnalysisTime / SlotDuration).
 */

export function slotsNeededForAnalysisTime(
  analysisTimeMinutes: number,
  slotDurationMinutes: number,
  slotToleranceMinutes = 0
): number {
  const analysis = Math.max(0, Math.floor(Number(analysisTimeMinutes) || 0));
  const duration = Math.max(0, Math.floor(Number(slotDurationMinutes) || 0));
  const tolerance = Math.max(0, Math.floor(Number(slotToleranceMinutes) || 0));

  if (analysis <= 0) return 0;
  if (duration <= 0) return 1;

  const adjusted = analysis - tolerance;
  if (adjusted <= 0) return 1;
  return Math.max(1, Math.ceil(adjusted / duration));
}

/** allocated + tolerance >= analysis */
export function allocatedCapacityCoversAnalysis(
  allocatedSlotMinutes: number,
  analysisTimeMinutes: number,
  slotToleranceMinutes = 0
): boolean {
  const allocated = Math.max(0, Math.floor(Number(allocatedSlotMinutes) || 0));
  const analysis = Math.max(0, Math.floor(Number(analysisTimeMinutes) || 0));
  const tolerance = Math.max(0, Math.floor(Number(slotToleranceMinutes) || 0));
  if (analysis <= 0) return true;
  return allocated + tolerance >= analysis;
}
