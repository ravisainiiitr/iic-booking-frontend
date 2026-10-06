import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Building2, CheckCircle2, CornerDownRight, Loader2, Microscope, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InlineError } from "@/components/my-research/researchUi";
import {
  DEFAULT_CATALOG_DEPARTMENT_NAME,
  findPreferredDepartment,
  loadCatalogDepartments,
  loadCatalogEquipment,
  type CatalogDepartment,
  type CatalogEquipmentRow,
} from "@/lib/catalogCache";
import { orderEquipmentForPicker } from "@/lib/bookingTemplates";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Department to start on (e.g. the page's department filter). */
  initialDepartmentId?: number | null;
  /** Existing template count per equipment id, shown beside each instrument. */
  templateCounts: Map<number, number>;
  onContinue: (equipmentId: number) => void;
};

/** Step 1 of a new booking template: choose the department, then one of its bookable instruments. */
export function NewBookingTemplateDialog({ open, onOpenChange, initialDepartmentId, templateCounts, onContinue }: Props) {
  const [departments, setDepartments] = useState<CatalogDepartment[] | null>(null);
  const [departmentsError, setDepartmentsError] = useState<string | null>(null);
  const [departmentId, setDepartmentId] = useState<number | null>(null);
  const [equipment, setEquipment] = useState<CatalogEquipmentRow[] | null>(null);
  const [equipmentError, setEquipmentError] = useState<string | null>(null);
  const [equipmentReload, setEquipmentReload] = useState(0);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelectedId(null);
    setQuery("");
    setDepartmentsError(null);
    let cancelled = false;
    void loadCatalogDepartments().then((list) => {
      if (cancelled) return;
      if (!list) {
        setDepartmentsError("Could not load departments.");
        return;
      }
      setDepartments(list);
      const start =
        list.find((d) => d.id === initialDepartmentId) ??
        findPreferredDepartment(list, DEFAULT_CATALOG_DEPARTMENT_NAME) ??
        list[0];
      setDepartmentId(start ? start.id : null);
    });
    return () => {
      cancelled = true;
    };
  }, [open, initialDepartmentId]);

  useEffect(() => {
    if (!open || departmentId == null) return;
    let cancelled = false;
    setEquipment(null);
    setEquipmentError(null);
    setSelectedId(null);
    loadCatalogEquipment(departmentId, null)
      .then((list) => {
        if (!cancelled) setEquipment(list);
      })
      .catch((err: unknown) => {
        if (!cancelled) setEquipmentError(err instanceof Error ? err.message : "Could not load equipment.");
      });
    return () => {
      cancelled = true;
    };
  }, [open, departmentId, equipmentReload]);

  const rows = useMemo(() => orderEquipmentForPicker(equipment ?? []), [equipment]);
  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.equipment.name.toLowerCase().includes(q) ||
        (r.equipment.code || "").toLowerCase().includes(q) ||
        (r.parentName || "").toLowerCase().includes(q)
    );
  }, [rows, query]);

  const selected = rows.find((r) => Number(r.equipment.equipment_id) === selectedId) ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-border/60 px-6 pb-4 pt-6">
          <DialogTitle>New booking template</DialogTitle>
          <DialogDescription>
            Choose the department and the instrument. Next you fill its sample details, booking options and an optional
            preferred weekly slot, exactly as on the booking page.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 px-6 py-4">
          {departmentsError ? (
            <InlineError message={departmentsError} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="new-template-department" className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5" aria-hidden /> Department
                </Label>
                <Select
                  value={departmentId != null ? String(departmentId) : undefined}
                  onValueChange={(v) => setDepartmentId(Number(v))}
                  disabled={!departments}
                >
                  <SelectTrigger id="new-template-department">
                    <SelectValue placeholder={departments ? "Choose a department" : "Loading departments…"} />
                  </SelectTrigger>
                  <SelectContent>
                    {(departments ?? []).map((d) => (
                      <SelectItem key={d.id} value={String(d.id)}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-template-equipment-search" className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Search className="h-3.5 w-3.5" aria-hidden /> Find equipment
                </Label>
                <Input
                  id="new-template-equipment-search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Name or code"
                  disabled={!equipment || rows.length === 0}
                />
              </div>
            </div>
          )}

          <div className="min-h-0 flex-1 rounded-lg border border-border/70">
            {equipmentError ? (
              <div className="p-3">
                <InlineError message={equipmentError} onRetry={() => setEquipmentReload((n) => n + 1)} />
              </div>
            ) : equipment == null ? (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground" role="status">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading equipment…
              </div>
            ) : visibleRows.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                {rows.length === 0
                  ? "No operational equipment you can book in this department."
                  : "No equipment matches your search."}
              </div>
            ) : (
              <ScrollArea className="h-[min(22rem,45dvh)]">
                <ul className="divide-y divide-border/60" role="listbox" aria-label="Equipment">
                  {visibleRows.map(({ equipment: eq, parentName }) => {
                    const id = Number(eq.equipment_id);
                    const isSelected = id === selectedId;
                    const count = templateCounts.get(id) ?? 0;
                    return (
                      <li key={id}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => setSelectedId(id)}
                          onDoubleClick={() => onContinue(id)}
                          className={cn(
                            "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none",
                            parentName && "pl-8",
                            isSelected && "bg-primary/10 hover:bg-primary/10 dark:bg-primary/20"
                          )}
                        >
                          {parentName ? (
                            <CornerDownRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                          ) : (
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary dark:text-sky-200">
                              <Microscope className="h-4 w-4" aria-hidden />
                            </span>
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-foreground">{eq.name}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {eq.code}
                              {parentName ? ` · Mode of ${parentName}` : ""}
                            </span>
                          </span>
                          {count > 0 ? (
                            <Badge variant="secondary" className="shrink-0 font-normal">
                              {count} template{count === 1 ? "" : "s"}
                            </Badge>
                          ) : null}
                          {isSelected ? <CheckCircle2 className="h-4 w-4 shrink-0 text-primary dark:text-sky-300" aria-hidden /> : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </ScrollArea>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 border-t border-border/60 px-6 py-4 sm:items-center sm:justify-between">
          <p className="min-w-0 truncate text-sm text-muted-foreground">
            {selected ? (
              <>
                Selected: <span className="font-medium text-foreground">{selected.equipment.name}</span>
              </>
            ) : (
              "Select an instrument to continue."
            )}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={selectedId == null} onClick={() => selectedId != null && onContinue(selectedId)}>
              Continue
              <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden />
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default NewBookingTemplateDialog;
