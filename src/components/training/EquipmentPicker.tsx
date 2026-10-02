import { useEffect, useRef, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trainingApi } from "@/lib/trainingApi";
import type { TrainingEquipmentRef } from "@/lib/trainingTypes";
import { cn } from "@/lib/utils";

type Props = {
  value: TrainingEquipmentRef | null;
  onChange: (equipment: TrainingEquipmentRef | null) => void;
  /** Only equipment the signed-in OIC/admin manages. */
  managed?: boolean;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Internal department (Department/Centre) to list equipment from; "all" or unset lists every department. */
  departmentId?: number | "all";
  /** Shown when nothing matches (defaults to a generic message). */
  emptyText?: string;
};

/** Search-as-you-type equipment picker backed by `training/equipment/`. */
export function EquipmentPicker({ value, onChange, managed = false, id, placeholder, disabled, departmentId, emptyText }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TrainingEquipmentRef[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    if (value || !open) return;
    const current = ++seq.current;
    setLoading(true);
    const handle = window.setTimeout(() => {
      void trainingApi.equipment({ q: query.trim() || undefined, managed, department_id: departmentId }).then((res) => {
        if (current !== seq.current) return;
        setResults(res.data?.results ?? []);
        setLoading(false);
      });
    }, 250);
    return () => window.clearTimeout(handle);
  }, [query, managed, value, open, departmentId]);

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{value.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {[value.code, value.department].filter(Boolean).join(" · ")}
          </p>
        </div>
        {!disabled ? (
          <Button type="button" variant="ghost" size="sm" className="h-7 shrink-0 px-2" onClick={() => onChange(null)}>
            <X className="h-4 w-4" aria-hidden />
            <span className="sr-only">Change equipment</span>
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          id={id}
          value={query}
          disabled={disabled}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          placeholder={placeholder ?? "Search equipment by name or code"}
          className="pl-8"
          autoComplete="off"
        />
      </div>
      {open ? (
        <div className="max-h-56 overflow-y-auto rounded-md border border-border/70 bg-popover">
          {loading ? (
            <p className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Searching…
            </p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              {emptyText ?? (managed ? "No equipment you manage matches." : "No matching equipment.")}
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {results.map((eq) => (
                <li key={eq.equipment_id}>
                  <button
                    type="button"
                    className={cn("w-full px-3 py-2 text-left hover:bg-muted/60 focus:bg-muted/60 focus:outline-none")}
                    onClick={() => {
                      onChange(eq);
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    <p className="text-sm font-medium">{eq.name}</p>
                    <p className="text-xs text-muted-foreground">{[eq.code, eq.department].filter(Boolean).join(" · ")}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
