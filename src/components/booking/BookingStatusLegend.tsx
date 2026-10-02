import { useState } from "react";
import { ChevronDown, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { BOOKING_STATUS_LEGEND } from "@/lib/bookingStatusLegend";
import { cn } from "@/lib/utils";

export function BookingStatusLegend({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className={cn("text-sm", className)}>
      <CollapsibleTrigger
        type="button"
        className="inline-flex min-h-9 items-center gap-1.5 rounded px-1 text-xs font-medium text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <Info className="h-3.5 w-3.5" aria-hidden />
        What do these statuses mean?
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} aria-hidden />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <dl className="mt-2 grid gap-x-6 gap-y-2 rounded-md border bg-background p-3 sm:grid-cols-2">
          {BOOKING_STATUS_LEGEND.map((entry) => (
            <div key={entry.status} className="flex items-start gap-2">
              <dt className="shrink-0">
                <Badge className={cn("whitespace-nowrap", entry.badgeClass)}>{entry.label}</Badge>
              </dt>
              <dd className="pt-0.5 text-xs text-muted-foreground">{entry.meaning}</dd>
            </div>
          ))}
        </dl>
      </CollapsibleContent>
    </Collapsible>
  );
}
