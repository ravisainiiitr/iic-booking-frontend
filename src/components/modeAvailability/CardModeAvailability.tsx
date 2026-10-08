import ModeSummaryText from "@/components/modeAvailability/ModeSummaryText";
import {
  modeSummaryLine,
  modeSummaryParts,
  type CardModeAvailability as CardModeAvailabilityData,
} from "@/lib/modeAvailability";
import { cn } from "@/lib/utils";

type Props = {
  availability: CardModeAvailabilityData;
  /** The card's equipment: on a mode's card that mode leads. */
  equipmentId: number;
  /** Opens the equipment page at its availability calendar. */
  onOpen: (e: React.MouseEvent) => void;
  className?: string;
};

/** Single-line mode summary laid over the catalog card photo. */
export default function CardModeAvailability({ availability, equipmentId, onOpen, className }: Props) {
  const parts = modeSummaryParts(availability.modes ?? [], equipmentId);
  if (parts.length === 0) return null;
  const line = modeSummaryLine(parts);
  return (
    <button
      type="button"
      onClick={onOpen}
      title={line}
      aria-label={`Availability by mode: ${line}. Open the availability calendar.`}
      className={cn(
        "flex min-w-0 items-center overflow-hidden whitespace-nowrap rounded-md bg-slate-950/65 px-2 py-1 text-left text-[11px] leading-4 text-white/90 shadow-sm ring-1 ring-white/15 backdrop-blur-sm transition-colors hover:bg-slate-950/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
        className,
      )}
      data-testid="card-mode-availability"
    >
      <ModeSummaryText parts={parts} codeClassName="text-white" separatorClassName="text-white/40" />
    </button>
  );
}
