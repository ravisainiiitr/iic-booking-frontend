/** Change slot status page for one equipment; `month` (YYYY-MM) focuses its calendar on that month. */
export function changeSlotStatusPath(equipmentId: number, month?: string): string {
  const params = new URLSearchParams({ equipment_id: String(equipmentId) });
  if (month && /^\d{4}-\d{2}/.test(month)) params.set("month", month.slice(0, 7));
  return `/change-slot-status?${params.toString()}`;
}
