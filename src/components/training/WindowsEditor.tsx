import { useState } from "react";
import { CalendarSearch, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateTimeInput } from "@/components/ui/datetime-input";
import { FreeWindowFinder } from "./FreeWindowFinder";
import { addMinutesIso, fromLocalInputValue, toLocalInputValue } from "./trainingHelpers";

export type LocalWindow = { start: string; end: string };

export const MAX_PREFERRED_WINDOWS = 3;

/** Local datetime-input rows → ISO windows; returns an error message when a row is incomplete or in the past. */
export function windowsToIso(rows: LocalWindow[]): { windows: Array<{ start: string; end: string }>; error?: string } {
  const now = Date.now();
  const windows: Array<{ start: string; end: string }> = [];
  for (const [i, row] of rows.entries()) {
    if (!row.start && !row.end) continue;
    const start = fromLocalInputValue(row.start);
    const end = fromLocalInputValue(row.end);
    if (!start || !end) return { windows, error: `Window ${i + 1}: enter both start and end.` };
    if (new Date(end) <= new Date(start)) return { windows, error: `Window ${i + 1}: end must be after start.` };
    if (new Date(start).getTime() <= now) return { windows, error: `Window ${i + 1}: must be in the future.` };
    windows.push({ start, end });
  }
  if (!windows.length) return { windows, error: "Add at least one preferred window." };
  return { windows };
}

type Props = {
  value: LocalWindow[];
  onChange: (rows: LocalWindow[]) => void;
  equipmentId?: number | null;
  durationMinutes?: number | null;
};

/** 1–3 preferred time windows with an optional free-window finder. */
export function WindowsEditor({ value, onChange, equipmentId, durationMinutes }: Props) {
  const [finderFor, setFinderFor] = useState<number | null>(null);
  const rows = value.length ? value : [{ start: "", end: "" }];
  const duration = Number(durationMinutes) || 0;

  const update = (index: number, patch: Partial<LocalWindow>) => {
    const next = rows.map((row, i) => (i === index ? { ...row, ...patch } : row));
    onChange(next);
  };

  const setStart = (index: number, local: string) => {
    const iso = fromLocalInputValue(local);
    const row = rows[index];
    const autoEnd = iso && duration > 0 && (!row.end || row.end <= local) ? toLocalInputValue(addMinutesIso(iso, duration)) : row.end;
    update(index, { start: local, end: autoEnd });
  };

  return (
    <div className="space-y-2">
      {rows.map((row, index) => (
        <div key={index} className="space-y-2 rounded-lg border border-border/70 p-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-full text-xs font-medium text-muted-foreground sm:w-auto">Window {index + 1}</span>
            <DateTimeInput
              aria-label={`Window ${index + 1} start`}
              value={row.start}
              onChange={(e) => setStart(index, e.target.value)}
              className="w-full sm:w-auto" inputClassName="h-9"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <DateTimeInput
              aria-label={`Window ${index + 1} end`}
              value={row.end}
              onChange={(e) => update(index, { end: e.target.value })}
              className="w-full sm:w-auto" inputClassName="h-9"
            />
            <div className="flex gap-1 sm:ml-auto">
              {equipmentId ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2"
                  onClick={() => setFinderFor(finderFor === index ? null : index)}
                  title="Find free windows"
                >
                  <CalendarSearch className="h-4 w-4" aria-hidden />
                  <span className="sr-only">Find free windows</span>
                </Button>
              ) : null}
              {rows.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-destructive hover:text-destructive"
                  onClick={() => onChange(rows.filter((_, i) => i !== index))}
                  title="Remove window"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                  <span className="sr-only">Remove window</span>
                </Button>
              ) : null}
            </div>
          </div>
          {finderFor === index ? (
            <FreeWindowFinder
              compact
              equipmentId={equipmentId}
              durationMinutes={duration}
              onPick={(start, end) => {
                update(index, { start: toLocalInputValue(start), end: toLocalInputValue(end) });
                setFinderFor(null);
              }}
            />
          ) : null}
        </div>
      ))}
      {rows.length < MAX_PREFERRED_WINDOWS ? (
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...rows, { start: "", end: "" }])}>
          <Plus className="mr-1.5 h-4 w-4" aria-hidden /> Add another window
        </Button>
      ) : null}
    </div>
  );
}
