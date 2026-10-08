import { useEffect, useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import ModeSummaryText from "@/components/modeAvailability/ModeSummaryText";
import { apiClient } from "@/lib/api";
import { modeSummaryLine, modeSummaryParts, type ModeAvailabilitySummary } from "@/lib/modeAvailability";
import { cn } from "@/lib/utils";

type Props = {
  equipmentId: number;
  /** Opens the Availability tab with the full calendar. */
  onOpen: () => void;
  className?: string;
};

/** One-line mode summary beside the equipment name: "APREO Mon–Fri · next Wed 21 Oct | EBSD not scheduled". */
export default function ModeAvailabilityHeaderLine({ equipmentId, onOpen, className }: Props) {
  const [data, setData] = useState<ModeAvailabilitySummary | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "none">("loading");

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    setData(null);
    void apiClient.getEquipmentModeAvailability(equipmentId).then((res) => {
      if (cancelled) return;
      if (res.error || !res.data || !res.data.multi_mode) {
        setState("none");
        return;
      }
      setData(res.data);
      setState("ready");
    });
    return () => {
      cancelled = true;
    };
  }, [equipmentId]);

  const parts = useMemo(() => (data ? modeSummaryParts(data.modes, data.equipment_id) : []), [data]);

  if (state === "loading") return <Skeleton className={cn("h-4 w-56 max-w-full", className)} data-testid="mode-header-line-loading" />;
  if (state === "none" || parts.length === 0) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onOpen}
            aria-label={`Availability by mode: ${modeSummaryLine(parts)}. Open the availability calendar.`}
            className={cn(
              "flex min-w-0 max-w-full items-center overflow-hidden whitespace-nowrap rounded-md px-1 py-0.5 text-left text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm",
              className,
            )}
            data-testid="mode-header-line"
          >
            <ModeSummaryText parts={parts} codeClassName="text-foreground/80" separatorClassName="text-border" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-sm text-xs">
          {parts.map((p) => (
            <p key={p.id}>
              <span className="font-medium">{p.code}</span> {p.text}
            </p>
          ))}
          <p className="mt-1 text-muted-foreground">Click to open the availability calendar.</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
