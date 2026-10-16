import type { SlotChoice } from "./slotOptions";

/** "30 min", "1 h", "1 h 30 min". */
export function formatSlotMinutes(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${rest} min`;
  return rest === 0 ? `${h} h` : `${h} h ${rest} min`;
}

/** One line under the Step 3 heading: how many slots are needed and what to do next. */
export function slotStepGuidance(opts: {
  slotCount: number;
  requiredMinutes: number | null | undefined;
  choice: SlotChoice;
  selectedCount: number;
}): string | null {
  const { slotCount, requiredMinutes, choice, selectedCount } = opts;
  if (!Number.isFinite(slotCount) || slotCount <= 0 || choice === "preferred") return null;
  const slots = `${slotCount} slot${slotCount === 1 ? "" : "s"}`;
  const need = requiredMinutes && requiredMinutes > 0 ? `${slots} (${formatSlotMinutes(requiredMinutes)})` : slots;
  if (selectedCount >= slotCount) {
    return choice === "auto"
      ? `We selected ${slots} for you. Check the time below, or click Clear Selection to pick your own.`
      : `All ${slots} selected. Check the time below, then confirm.`;
  }
  if (choice === "auto" && selectedCount === 0) {
    return `You need ${need}. Auto-select picks them for you when they are free; choose I'll pick to click slots yourself.`;
  }
  if (selectedCount > 0) {
    return `${selectedCount} of ${slotCount} slots selected. Click a green slot next to your selection to add the rest.`;
  }
  if (slotCount === 1) return `You need ${need}. Click a green Available slot to select it.`;
  return `You need ${need}. Click a green Available slot to start — we'll select ${slotCount} back-to-back slots from there.`;
}
