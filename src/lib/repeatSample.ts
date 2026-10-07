import { withoutSampleSets, type SampleSetValues } from "@/lib/sampleSets";

type RepeatSourceLike = { booked_by_staff?: boolean } | null | undefined;

export type RepeatInputChange = { key: string; label: string; old: string; new: string };

/** Repeat requested by the booking user: parameters stay exactly as in the original booking. */
export function repeatParamsLocked(source: RepeatSourceLike): boolean {
  return !!source && !source.booked_by_staff;
}

/** OIC / Admin repeat: parameters are prefilled from the original booking and can be edited. */
export function repeatParamsEditable(source: RepeatSourceLike): boolean {
  return !!source?.booked_by_staff;
}

/** Book-on-behalf page for a staff repeat of a completed booking (the original user is preselected there). */
export function repeatSampleBookPath(equipmentId: number | string, bookingPk: number | string): string {
  return `/book-equipment?equipment_id=${encodeURIComponent(String(equipmentId))}&mode=book&repeatOf=${encodeURIComponent(String(bookingPk))}`;
}

/**
 * "Mark as repeat & book": go straight to booking slots for the original user. From View Booking the current
 * entry is first pointed at the opened booking so Back reopens its details.
 */
export function openRepeatSampleBooking(
  navigate: (to: string, options?: { replace?: boolean }) => void,
  currentPathname: string,
  equipmentId: number | string,
  bookingPk: number | string,
): void {
  if (currentPathname === "/booking-management") {
    navigate(`/booking-management?expand=${encodeURIComponent(String(bookingPk))}`, { replace: true });
  }
  navigate(repeatSampleBookPath(equipmentId, bookingPk));
}

/** Sample sets are always sent so removing every extra set is a change too. */
export function repeatInputPayload(
  values: Record<string, unknown>,
  sampleSets: SampleSetValues[],
): Record<string, unknown> {
  return { ...withoutSampleSets(values), _sample_sets: sampleSets };
}

export function repeatChangesSummary(changes: RepeatInputChange[]): string {
  return changes.map((c) => `${c.label}: ${c.old} → ${c.new}`).join("; ");
}
