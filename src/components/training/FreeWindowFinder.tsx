import { useState } from "react";
import { CalendarSearch, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trainingApi } from "@/lib/trainingApi";
import type { TrainingWindow } from "@/lib/trainingTypes";
import { addMinutesIso, formatWindow, toDateInputValue } from "./trainingHelpers";

type Props = {
  equipmentId: number | null | undefined;
  durationMinutes: number | null | undefined;
  /** Called with the chosen start (ISO) and its end (start + duration). */
  onPick: (start: string, end: string) => void;
  compact?: boolean;
};

/** Looks up free contiguous instrument time and lets the user pick a start. */
export function FreeWindowFinder({ equipmentId, durationMinutes, onPick, compact = false }: Props) {
  const today = new Date();
  const [from, setFrom] = useState(() => toDateInputValue(new Date(today.getTime() + 86_400_000)));
  const [to, setTo] = useState(() => toDateInputValue(new Date(today.getTime() + 14 * 86_400_000)));
  const [windows, setWindows] = useState<TrainingWindow[] | null>(null);
  const [loading, setLoading] = useState(false);

  const duration = Number(durationMinutes) || 0;
  const canSearch = Boolean(equipmentId) && duration > 0 && Boolean(from);

  const search = async () => {
    if (!equipmentId || !canSearch) return;
    setLoading(true);
    const res = await trainingApi.freeWindows(equipmentId, { date_from: from, date_to: to || undefined, duration });
    setLoading(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setWindows(res.data?.windows ?? []);
  };

  return (
    <div className="space-y-2 rounded-lg border border-dashed border-border/80 bg-muted/20 p-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label className="text-xs">From</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 w-[9.5rem] text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">To</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 w-[9.5rem] text-sm" />
        </div>
        <Button type="button" size="sm" variant="secondary" className="h-8" onClick={() => void search()} disabled={!canSearch || loading}>
          {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CalendarSearch className="mr-1.5 h-4 w-4" />}
          Find free windows
        </Button>
      </div>
      {!equipmentId || duration <= 0 ? (
        <p className="text-xs text-muted-foreground">Choose equipment and a duration to search free instrument time.</p>
      ) : null}
      {windows ? (
        windows.length === 0 ? (
          <p className="text-xs text-muted-foreground">No free windows of this length in the selected dates.</p>
        ) : (
          <div className={compact ? "flex max-h-40 flex-wrap gap-1.5 overflow-y-auto" : "flex max-h-52 flex-wrap gap-1.5 overflow-y-auto"}>
            {windows.map((w) => {
              const end = addMinutesIso(w.start, duration) || w.end;
              return (
                <Button
                  key={w.start}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-auto whitespace-normal py-1 text-left text-xs"
                  onClick={() => onPick(w.start, end)}
                >
                  {formatWindow(w.start, end)}
                </Button>
              );
            })}
          </div>
        )
      ) : null}
    </div>
  );
}
