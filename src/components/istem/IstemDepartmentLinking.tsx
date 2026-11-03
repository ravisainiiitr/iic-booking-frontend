import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Loader2, Search, Sparkles, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { IstemDepartmentRow } from "@/lib/api";

type Portal = { id: number; name: string };

function PortalDepartmentPicker({ row, portal, busy, onPick }: {
  row: IstemDepartmentRow; portal: Portal[]; busy: boolean; onPick: (id: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = row.department;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} disabled={busy}
          aria-label={`Portal department for ${row.name || row.istem_department_id}`}
          className="h-9 w-full justify-between gap-2 font-normal sm:w-72">
          <span className="truncate">{current ? current.name : <span className="text-muted-foreground">Choose portal department…</span>}</span>
          {busy ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <Command>
          <CommandInput placeholder="Find a portal department…" />
          <CommandList className="max-h-72">
            <CommandEmpty>No department matches.</CommandEmpty>
            {row.suggested && row.suggested.id !== current?.id ? (
              <CommandGroup heading="Suggested">
                <CommandItem value={`suggested ${row.suggested.name}`} onSelect={() => { setOpen(false); onPick(row.suggested!.id); }}>
                  <Sparkles className="mr-2 h-4 w-4 text-amber-500" />{row.suggested.name}
                </CommandItem>
              </CommandGroup>
            ) : null}
            <CommandGroup heading="All portal departments">
              {portal.map((d) => (
                <CommandItem key={d.id} value={d.name} onSelect={() => { setOpen(false); onPick(d.id); }}>
                  <Check className={`mr-2 h-4 w-4 ${current?.id === d.id ? "opacity-100" : "opacity-0"}`} />{d.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Main Admin: the distinct departments in I-STEM's equipment list, each matched to a portal department. Departments
 * with no active equipment on I-STEM are listed on request.
 */
export default function IstemDepartmentLinking({ rows, portal, busy, onLink }: {
  rows: IstemDepartmentRow[];
  portal: Portal[];
  busy: string;
  onLink: (items: { istem_department_id: string; department_id: number | null }[]) => void;
}) {
  const [text, setText] = useState("");
  const [showEmpty, setShowEmpty] = useState(false);
  const real = rows.filter((r) => r.istem_department_id);
  const empty = real.filter((r) => r.equipment_count === 0).length;
  const shown = useMemo(() => {
    const needle = text.trim().toLowerCase();
    return real
      .filter((r) => showEmpty || r.equipment_count > 0)
      .filter((r) => !needle || `${r.name} ${r.istem_department_id} ${r.department?.name ?? ""}`.toLowerCase().includes(needle));
  }, [real, text, showEmpty]);
  const pending = real.filter((r) => !r.department && r.suggested);
  const linked = real.filter((r) => r.department).length;

  return (
    <section className="rounded-xl border bg-card shadow-sm" aria-label="I-STEM departments" data-testid="department-linking">
      <div className="flex flex-wrap items-center gap-3 border-b p-4">
        <div className="mr-auto">
          <h2 className="text-base font-semibold">I-STEM departments</h2>
          <p className="text-sm text-muted-foreground">
            {linked} of {real.length - empty} departments with equipment on I-STEM are matched to a portal department.
          </p>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="h-9 w-56 pl-8" placeholder="Find a department" value={text} onChange={(e) => setText(e.target.value)}
            aria-label="Find an I-STEM department" />
        </div>
        <Button size="sm" disabled={!pending.length || busy === "link-all"}
          onClick={() => onLink(pending.map((r) => ({ istem_department_id: r.istem_department_id, department_id: r.suggested!.id })))}>
          {busy === "link-all" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
          Accept all suggestions ({pending.length})
        </Button>
      </div>
      <ul className="divide-y">
        {shown.map((r) => (
          <li key={r.istem_department_id} data-testid="istem-department-row"
            className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{r.name || `I-STEM department ${r.istem_department_id}`}</span>
                <span className="font-mono text-xs text-muted-foreground">#{r.istem_department_id}</span>
                <Badge variant="secondary" className="h-5 px-1.5 text-[11px]">{r.equipment_count} equipment</Badge>
                {r.department ? <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400"><Check className="h-3 w-3" />Matched</span> : null}
              </div>
              {r.sample_equipment.length ? (
                <div className="truncate text-xs text-muted-foreground">{r.sample_equipment.slice(0, 3).join(" · ")}</div>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              {!r.department && r.suggested ? (
                <Button size="sm" variant="secondary" disabled={busy === `link:${r.istem_department_id}`}
                  onClick={() => onLink([{ istem_department_id: r.istem_department_id, department_id: r.suggested!.id }])}
                  title={r.suggested.by === "name" ? "Similar name" : "From instruments already mapped"}>
                  <Sparkles className="mr-1 h-3.5 w-3.5" />{r.suggested.name}
                </Button>
              ) : null}
              <PortalDepartmentPicker row={r} portal={portal} busy={busy === `link:${r.istem_department_id}`}
                onPick={(id) => onLink([{ istem_department_id: r.istem_department_id, department_id: id }])} />
              {r.department ? (
                <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`Unmatch ${r.name || r.istem_department_id}`}
                  onClick={() => onLink([{ istem_department_id: r.istem_department_id, department_id: null }])}>
                  <X className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          </li>
        ))}
        {!shown.length ? <li className="px-4 py-10 text-center text-sm text-muted-foreground">No I-STEM department matches.</li> : null}
      </ul>
      {empty ? (
        <div className="border-t px-4 py-2.5 text-center">
          <button type="button" className="text-sm font-medium text-primary hover:underline" onClick={() => setShowEmpty((v) => !v)}>
            {showEmpty ? "Hide" : "Show"} {empty} department{empty === 1 ? "" : "s"} with no active equipment on I-STEM
          </button>
        </div>
      ) : null}
    </section>
  );
}
