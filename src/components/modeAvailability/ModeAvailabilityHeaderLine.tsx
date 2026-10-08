import { Fragment, useEffect, useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { apiClient } from "@/lib/api";
import {
  familyColors,
  modeSummaryText,
  modesForHeader,
  type ModeAvailabilitySummary,
} from "@/lib/modeAvailability";
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

  const parts = useMemo(() => {
    if (!data) return [];
    const colors = familyColors(data.modes);
    return modesForHeader(data.modes, data.equipment_id).map((m) => ({
      id: m.equipment_id,
      code: m.code,
      text: modeSummaryText(m),
      color: colors.get(m.equipment_id)!,
    }));
  }, [data]);

  if (state === "loading") return <Skeleton className={cn("h-4 w-56 max-w-full", className)} data-testid="mode-header-line-loading" />;
  if (state === "none" || parts.length === 0) return null;

  const full = parts.map((p) => `${p.code} ${p.text}`).join(" | ");
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onOpen}
            aria-label={`Availability by mode: ${full}. Open the availability calendar.`}
            className={cn(
              "flex min-w-0 max-w-full items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-md px-1 py-0.5 text-left text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm",
              className,
            )}
            data-testid="mode-header-line"
          >
            <span className="min-w-0 truncate">
              {parts.map((p, i) => (
                <Fragment key={p.id}>
                  {i > 0 ? <span className="px-1.5 text-border" aria-hidden>|</span> : null}
                  <span
                    className="mr-1 inline-block h-2 w-2 rounded-full align-middle"
                    style={{ backgroundColor: p.color }}
                    aria-hidden
                  />
                  <span className="font-medium text-foreground/80">{p.code}</span> {p.text}
                </Fragment>
              ))}
            </span>
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
