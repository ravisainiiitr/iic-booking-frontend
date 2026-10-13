import { useEffect, useState } from "react";
import { format, parseISO, startOfWeek } from "date-fns";
import { CalendarClock, MapPin, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { apiClient, type SimilarAvailability, type SimilarInstrument } from "@/lib/api";
import { cn } from "@/lib/utils";

type Props = {
  equipmentId: number;
  /** Grid week key starting with its Monday (yyyy-MM-dd); the card refreshes when the user changes weeks. */
  weekKey: string;
  onGoToWeek: (date: string) => void;
  onOpenInstrument: (instrument: SimilarInstrument) => void;
  className?: string;
};

function whenLabel(earliest: NonNullable<SimilarInstrument["earliest"]>): string {
  try {
    return format(parseISO(earliest.start), "EEE d MMM, HH:mm");
  } catch {
    return earliest.date;
  }
}

/** Shown when the visible week has no free slots: the next open slot here and on equivalent instruments. */
export function SimilarInstrumentsCard({ equipmentId, weekKey, onGoToWeek, onOpenInstrument, className }: Props) {
  const [data, setData] = useState<SimilarAvailability | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiClient.getSimilarAvailability(equipmentId).then((res) => {
      if (cancelled) return;
      setData(res.error || !res.data?.equipment ? null : res.data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [equipmentId, weekKey]);

  if (loading || !data) return null;
  const own = data.equipment.earliest;
  const ownWeekVisible = own
    ? weekKey.startsWith(format(startOfWeek(parseISO(own.date), { weekStartsOn: 1 }), "yyyy-MM-dd"))
    : false;
  const alternatives = data.alternatives.filter((alt) => alt.earliest);
  if ((!own || ownWeekVisible) && alternatives.length === 0) return null;

  return (
    <section
      aria-label="Next available slots"
      data-testid="similar-instruments"
      className={cn("rounded-lg border border-primary/25 bg-primary/5 p-3 text-sm", className)}
    >
      <p className="flex items-center gap-2 font-medium text-foreground">
        <Sparkles className="h-4 w-4 text-primary" aria-hidden />
        No free slots this week — here is what's open next
      </p>
      {own && !ownWeekVisible && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="flex items-center gap-1.5">
            <CalendarClock className="h-4 w-4 text-muted-foreground" aria-hidden />
            This instrument: <span className="font-medium">{whenLabel(own)}</span>
          </span>
          <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => onGoToWeek(own.date)}>
            Go to that week
          </Button>
        </div>
      )}
      {alternatives.length > 0 && (
        <>
          <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {data.basis === "group" ? "Equivalent instruments" : `Other ${data.equipment.category || "similar"} instruments`}
          </p>
          <ul className="mt-1 divide-y divide-border/60">
            {alternatives.map((alt) => (
              <li key={alt.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <div className="min-w-[12rem] flex-1">
                  <p className="font-medium text-foreground">{alt.name}</p>
                  <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    {alt.department && <span>{alt.department}</span>}
                    {alt.location && (
                      <span className="flex items-center gap-0.5">
                        <MapPin className="h-3 w-3" aria-hidden />
                        {alt.location}
                      </span>
                    )}
                  </p>
                </div>
                <span className="text-foreground">
                  Free from <span className="font-medium">{whenLabel(alt.earliest!)}</span>
                </span>
                <Button type="button" size="sm" className="h-7" onClick={() => onOpenInstrument(alt)}>
                  Book this instead
                </Button>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-muted-foreground">
            Your sample details carry over where the other instrument asks for the same fields.
          </p>
        </>
      )}
    </section>
  );
}

export default SimilarInstrumentsCard;
