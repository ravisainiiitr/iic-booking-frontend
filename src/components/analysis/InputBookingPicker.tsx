import { useEffect, useId, useState } from "react";
import { Loader2, Lock, Search } from "lucide-react";
import type { AnalysisInputSource } from "@/lib/analysisSetupTypes";
import { inputSourceSummary, loadInputSources } from "@/lib/analysisInputSources";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = {
  bookingId: number;
  selectedId: number | null;
  onSelect: (row: AnalysisInputSource) => void;
  preferLegacy?: boolean;
  disabled?: boolean;
};

export function InputBookingPicker({ bookingId, selectedId, onSelect, preferLegacy = false, disabled }: Props) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [rows, setRows] = useState<AnalysisInputSource[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchId = useId();
  const groupName = useId();

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query.trim()), 300);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    setPage(1);
  }, [debounced]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    loadInputSources(bookingId, { q: debounced, page, preferLegacy })
      .then((res) => {
        if (!alive) return;
        setRows((prev) => (page === 1 ? res.rows : [...prev, ...res.rows]));
        setHasMore(res.hasMore);
      })
      .catch((err: unknown) => {
        if (alive) setError(err instanceof Error ? err.message : "Couldn't load your bookings.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [bookingId, debounced, page, preferLegacy]);

  return (
    <div className="space-y-2 rounded-lg border bg-background p-3" data-testid="input-booking-picker">
      <label htmlFor={searchId} className="sr-only">
        Search your bookings
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
        <Input
          id={searchId}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by booking ID, equipment or sample"
          className="h-9 pl-8"
          disabled={disabled}
        />
      </div>
      <fieldset disabled={disabled} className="max-h-64 space-y-1 overflow-y-auto pr-1">
        <legend className="sr-only">Choose the booking whose data you want to analyze</legend>
        {rows.map((row) => {
          const locked = Boolean(row.locked_reason);
          const empty = row.file_count === 0;
          return (
            <label
              key={row.booking_id}
              className={cn(
                "flex cursor-pointer items-start gap-2.5 rounded-md border border-transparent px-2.5 py-2 text-sm transition hover:bg-muted/50",
                "has-[:checked]:border-primary/50 has-[:checked]:bg-primary/5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                (locked || empty) && "cursor-not-allowed opacity-60 hover:bg-transparent",
              )}
            >
              <input
                type="radio"
                name={groupName}
                className="mt-1 h-4 w-4 shrink-0 accent-[#0b3d91]"
                checked={selectedId === row.booking_id}
                disabled={locked || empty}
                onChange={() => onSelect(row)}
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-[13px] font-semibold">{row.virtual_id}</span>
                  {row.is_current ? (
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                      This booking
                    </Badge>
                  ) : null}
                </span>
                <span className="block text-xs text-muted-foreground">{inputSourceSummary(row)}</span>
                {locked ? (
                  <span className="mt-0.5 flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300">
                    <Lock className="h-3 w-3" aria-hidden /> {row.locked_reason}
                  </span>
                ) : null}
              </span>
            </label>
          );
        })}
        {!loading && !error && rows.length === 0 ? (
          <p className="px-2 py-4 text-center text-sm text-muted-foreground">No bookings with data match your search.</p>
        ) : null}
      </fieldset>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {loading ? (
        <div className="flex justify-center py-1">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Loading bookings" />
        </div>
      ) : hasMore ? (
        <Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => setPage((p) => p + 1)}>
          Show more bookings
        </Button>
      ) : null}
    </div>
  );
}
