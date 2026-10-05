import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  getCategoryColor,
  parsePeriodicHelpText,
  periodicSelectionChargeSummaryFromHelpText,
  periodicTableElements,
  type Element,
} from "@/data/periodicTableData";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** help_text of the PERIODIC_TABLE field (disabled / locked preselected elements, charge rules). */
  helpText?: string | null;
  selected: Set<string>;
  onSelectedChange: (next: Set<string>) => void;
  onApply: () => void;
};

/** Periodic-table element picker used for PERIODIC_TABLE input fields. */
export default function PeriodicElementsDialog({
  open,
  onOpenChange,
  helpText,
  selected,
  onSelectedChange,
  onApply,
}: Props) {
  const { disabled: disabledSet, preselected: preselectedSet } = parsePeriodicHelpText(helpText);

  const toggle = (symbol: string) => {
    if (disabledSet.has(symbol) || preselectedSet.has(symbol)) return;
    const next = new Set(selected);
    if (next.has(symbol)) next.delete(symbol);
    else next.add(symbol);
    // Locked preselected elements always stay selected.
    preselectedSet.forEach((s) => next.add(s));
    onSelectedChange(next);
  };

  const grid: (Element | null)[][] = Array(7)
    .fill(null)
    .map(() => Array(18).fill(null));
  periodicTableElements.forEach((el) => {
    if (el.row <= 7 && el.col <= 18) grid[el.row - 1][el.col - 1] = el;
  });
  const lanthanides = periodicTableElements.filter((el) => el.category === "lanthanide");
  const actinides = periodicTableElements.filter((el) => el.category === "actinide");

  const elButton = (el: Element) => {
    const isDisabled = disabledSet.has(el.symbol);
    const isLocked = preselectedSet.has(el.symbol);
    const isSelected = selected.has(el.symbol) || isLocked;
    return (
      <button
        key={el.atomicNumber}
        type="button"
        onClick={() => toggle(el.symbol)}
        disabled={isDisabled || isLocked}
        title={
          isDisabled
            ? `${el.name} (disabled)`
            : isLocked
              ? `${el.name} (locked preselected — not charged)`
              : el.name
        }
        className={cn(
          "w-10 h-10 border-2 rounded flex flex-col items-center justify-center text-xs transition-all relative",
          getCategoryColor(el.category),
          isSelected && "ring-2 ring-primary ring-offset-1 ring-offset-background scale-105",
          isLocked && "ring-2 ring-sky-500 ring-offset-1",
          (isDisabled || isLocked) && "opacity-60 cursor-not-allowed pointer-events-none",
          isDisabled && "bg-muted dark:bg-muted border-dashed"
        )}
      >
        {isSelected && <Check className="w-3 h-3 absolute top-0 right-0" />}
        <span className="font-bold">{el.symbol}</span>
      </button>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Select elements</DialogTitle>
        </DialogHeader>
        {/* min-w-0 lets the table scroll sideways inside the dialog instead of widening it past a phone screen. */}
        <div className="min-w-0 space-y-4">
          <p className="text-sm text-muted-foreground">
            {periodicSelectionChargeSummaryFromHelpText(selected, helpText)}
          </p>
          <div className="overflow-x-auto">
            <div className="inline-block min-w-max">
              <div className="flex flex-col gap-1">
                {grid.map((row, ri) => (
                  <div key={ri} className="flex gap-1">
                    {row.map((el, ci) => (
                      <div key={`${ri}-${ci}`}>{el ? elButton(el) : <div className="w-10 h-10" />}</div>
                    ))}
                  </div>
                ))}
                <div className="flex gap-1 mt-1">
                  <div className="w-10 h-10 flex items-center justify-center text-xs font-semibold">Ln</div>
                  {lanthanides.map((el) => elButton(el))}
                </div>
                <div className="flex gap-1 mt-1">
                  <div className="w-10 h-10 flex items-center justify-center text-xs font-semibold">Ac</div>
                  {actinides.map((el) => elButton(el))}
                </div>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onApply}>Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
