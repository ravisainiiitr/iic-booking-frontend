import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import ConfidencePill from "@/components/istem/ConfidencePill";
import type { IstemEquipmentSearchRow } from "@/lib/api";

type Scored = IstemEquipmentSearchRow & { score?: number };

function detail(r: IstemEquipmentSearchRow): string {
  return [r.abbr, r.make, r.model, r.location].filter(Boolean).join(" · ");
}

/**
 * Searchable list of I-STEM equipment for one portal instrument: the equipment of the department's linked I-STEM
 * departments, best matches first; "All I-STEM equipment" widens it to the institute's whole list.
 */
export default function IstemEquipmentPicker({
  departmentRows,
  allRows,
  suggestions,
  value,
  busy,
  onPick,
}: {
  /** I-STEM equipment of the linked I-STEM departments (empty when the department is not linked). */
  departmentRows: IstemEquipmentSearchRow[];
  allRows: IstemEquipmentSearchRow[];
  /** Server suggestions for this instrument (score 0..1), best first. */
  suggestions: Scored[];
  value?: string | null;
  busy?: boolean;
  onPick: (row: IstemEquipmentSearchRow) => void;
}) {
  const [open, setOpen] = useState(false);
  const [everything, setEverything] = useState(departmentRows.length === 0);

  const { best, rest } = useMemo(() => {
    const pool = everything ? allRows : departmentRows;
    const scores = new Map(suggestions.map((s) => [s.equipment_id, s.score ?? 0]));
    const top = suggestions.filter((s) => (s.score ?? 0) >= 0.45).map((s) => pool.find((r) => r.equipment_id === s.equipment_id) ?? s);
    const topIds = new Set(top.map((r) => r.equipment_id));
    const others = pool
      .filter((r) => !topIds.has(r.equipment_id))
      .sort((a, b) => (scores.get(b.equipment_id) ?? 0) - (scores.get(a.equipment_id) ?? 0) || a.equipment_name.localeCompare(b.equipment_name));
    return { best: top.map((r) => ({ ...r, score: scores.get(r.equipment_id) })), rest: others };
  }, [everything, allRows, departmentRows, suggestions]);

  const chosen = value ? allRows.find((r) => r.equipment_id === value) : undefined;
  const pick = (row: IstemEquipmentSearchRow) => {
    setOpen(false);
    onPick(row);
  };

  const item = (r: Scored) => (
    <CommandItem key={r.equipment_id} value={`${r.equipment_name} ${r.equipment_id} ${detail(r)}`} onSelect={() => pick(r)}
      className="flex items-start gap-2 py-2">
      <Check className={`mt-0.5 h-4 w-4 shrink-0 ${value === r.equipment_id ? "opacity-100" : "opacity-0"}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm">{r.equipment_name}</span>
          {r.score != null && r.score >= 0.45 ? <ConfidencePill score={r.score} /> : null}
        </div>
        <div className="truncate text-xs opacity-70">
          <span className="font-mono">{r.equipment_id}</span>{detail(r) ? ` · ${detail(r)}` : ""}
          {r.mapped_to.length ? <span className="text-amber-700 dark:text-amber-400"> · mapped to {r.mapped_to.map((m) => m.name).join(", ")}</span> : null}
        </div>
      </div>
    </CommandItem>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} aria-label="Choose I-STEM equipment" disabled={busy}
          className="h-auto min-h-9 w-full justify-between gap-2 px-3 py-1.5 text-left font-normal">
          <span className="min-w-0 truncate">
            {chosen ? chosen.equipment_name : <span className="text-muted-foreground">Choose I-STEM equipment…</span>}
          </span>
          {busy ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(36rem,calc(100vw-2rem))] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search name, short name, make, model or ID…" />
          <div className="flex items-center justify-between border-b px-3 py-1.5 text-xs text-muted-foreground">
            <span>{everything ? `All I-STEM equipment (${allRows.length})` : `Linked I-STEM department (${departmentRows.length})`}</span>
            {departmentRows.length ? (
              <button type="button" className="font-medium text-primary hover:underline" onClick={() => setEverything((v) => !v)}>
                {everything ? "Only the linked department" : "Search all I-STEM equipment"}
              </button>
            ) : null}
          </div>
          <CommandList className="max-h-80">
            <CommandEmpty>No I-STEM equipment matches.</CommandEmpty>
            {best.length ? <CommandGroup heading="Best matches">{best.map(item)}</CommandGroup> : null}
            <CommandGroup heading={best.length ? "Other equipment" : undefined}>{rest.map(item)}</CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
