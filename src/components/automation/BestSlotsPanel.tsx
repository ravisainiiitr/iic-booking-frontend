import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Loader2, Sparkles } from "lucide-react";
import { apiClient } from "@/lib/api";
import type { SlotSuggestion, SlotSuggestionsResponse } from "@/lib/automationTypes";
import { useAutomationFeatures } from "@/components/automation/useAutomationFeatures";
import { cn } from "@/lib/utils";

type Props = {
  equipmentId: number;
  slotCount: number | null;
  /** Ids of the currently selected slots, to mark the matching suggestion. */
  selectedSlotIds: number[];
  onPick: (s: SlotSuggestion) => void;
  className?: string;
};

/** "Best times for you": free runs of the needed length, earliest and at the user's usual times. Read-only. */
export default function BestSlotsPanel({ equipmentId, slotCount, selectedSlotIds, onPick, className }: Props) {
  const features = useAutomationFeatures();
  const [data, setData] = useState<SlotSuggestionsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const enabled = features?.smart_slots === true && slotCount != null && slotCount > 0 && slotCount <= 24;

  useEffect(() => {
    if (!enabled || slotCount == null) return;
    let alive = true;
    setLoading(true);
    void apiClient.slotSuggestions(equipmentId, slotCount).then((res) => {
      if (!alive) return;
      setLoading(false);
      setData(res.data ?? null);
    });
    return () => {
      alive = false;
    };
  }, [enabled, equipmentId, slotCount]);

  if (!enabled) return null;
  if (loading && !data) {
    return (
      <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Finding the best times for you…
      </div>
    );
  }
  if (!data?.enabled || (data.suggestions.length === 0 && data.alternatives.length === 0)) return null;

  const selectedKey = [...selectedSlotIds].sort((a, b) => a - b).join(",");

  return (
    <section
      aria-label="Best times for you"
      className={cn("rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5", className)}
    >
      <div className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
        <Sparkles className="h-4 w-4 text-primary" />
        Best times for you
        <span className="text-xs font-normal text-muted-foreground">
          {data.slot_count && data.slot_count > 1 ? `${data.slot_count} back-to-back slots` : "1 slot"}, next {data.window_days ?? 14} days
        </span>
      </div>
      {data.suggestions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {data.suggestions.map((s) => {
            const selected = [...s.slot_ids].sort((a, b) => a - b).join(",") === selectedKey;
            return (
              <button
                key={s.slot_ids.join("-")}
                type="button"
                onClick={() => onPick(s)}
                aria-pressed={selected}
                className={cn(
                  "rounded-md border bg-background px-2.5 py-1.5 text-left text-sm transition hover:border-primary hover:bg-primary/10",
                  selected && "border-primary ring-1 ring-primary",
                )}
              >
                <span className="flex items-center gap-1 font-medium">
                  {selected && <Check className="h-3.5 w-3.5 text-primary" />}
                  {s.label}
                </span>
                <span className="block text-[11px] text-muted-foreground">{s.reasons.join(" · ")}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{data.message}</p>
      )}
      {data.alternatives.length > 0 && (
        <div className="mt-2 space-y-1">
          <p className="text-xs text-muted-foreground">Free sooner on a similar instrument:</p>
          {data.alternatives.map((a) => (
            <Link
              key={a.equipment_id}
              to={a.href}
              className="flex items-center gap-1 text-sm text-primary hover:underline"
            >
              {a.name}
              {a.code ? ` (${a.code})` : ""}: {a.first_label}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
