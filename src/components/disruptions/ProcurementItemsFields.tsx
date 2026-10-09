import { useId } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DisruptionCategoryChips } from "./DisruptionCategoryChips";
import {
  EMPTY_PROCUREMENT_ITEM,
  type ProcurementItemDraft,
  type ProcurementRequestDraft,
  type ReasonCategoryOption,
} from "@/lib/disruptions";

const MAX_ITEMS = 50;

export const EMPTY_PROCUREMENT_DRAFT: ProcurementRequestDraft = {
  category: "",
  items: [{ ...EMPTY_PROCUREMENT_ITEM }],
  notes: "",
};

/**
 * Items the service person recommended (consumables, minor or major assets). Raised as a Procurement &
 * Assets request that follows the department's normal approval workflow.
 */
export function ProcurementItemsFields({
  categories,
  value,
  onChange,
}: {
  categories: ReasonCategoryOption[];
  value: ProcurementRequestDraft;
  onChange: (next: ProcurementRequestDraft) => void;
}) {
  const baseId = useId();
  const setItem = (index: number, patch: Partial<ProcurementItemDraft>) =>
    onChange({ ...value, items: value.items.map((it, i) => (i === index ? { ...it, ...patch } : it)) });
  const removeItem = (index: number) => {
    const items = value.items.filter((_, i) => i !== index);
    onChange({ ...value, items: items.length > 0 ? items : [{ ...EMPTY_PROCUREMENT_ITEM }] });
  };

  return (
    <div className="space-y-3" data-testid="procurement-items">
      <DisruptionCategoryChips
        label="Request type"
        optional={false}
        options={categories}
        value={value.category}
        onChange={(category) => onChange({ ...value, category })}
      />
      <ul className="space-y-2">
        {value.items.map((item, index) => (
          <li key={index} className="space-y-2 rounded-md border border-border p-2.5">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_5rem_7rem_auto]">
              <div className="space-y-1">
                <Label htmlFor={`${baseId}-name-${index}`} className="text-xs">
                  Item {index + 1}
                </Label>
                <Input
                  id={`${baseId}-name-${index}`}
                  className="h-8"
                  maxLength={255}
                  placeholder="For example: vacuum pump oil"
                  value={item.name}
                  onChange={(e) => setItem(index, { name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`${baseId}-qty-${index}`} className="text-xs">
                  Quantity
                </Label>
                <Input
                  id={`${baseId}-qty-${index}`}
                  className="h-8"
                  type="number"
                  min={1}
                  inputMode="decimal"
                  value={item.quantity}
                  onChange={(e) => setItem(index, { quantity: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`${baseId}-cost-${index}`} className="text-xs">
                  Est. cost (₹ each)
                </Label>
                <Input
                  id={`${baseId}-cost-${index}`}
                  className="h-8"
                  type="number"
                  min={0}
                  inputMode="decimal"
                  value={item.estimated_cost}
                  onChange={(e) => setItem(index, { estimated_cost: e.target.value })}
                />
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  aria-label={`Remove item ${index + 1}`}
                  onClick={() => removeItem(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                aria-label={`Notes for item ${index + 1}`}
                className="h-8 sm:flex-1"
                maxLength={2000}
                placeholder="Notes (part number, specification…)"
                value={item.notes}
                onChange={(e) => setItem(index, { notes: e.target.value })}
              />
              <label className="flex shrink-0 items-center gap-2 text-xs">
                <Checkbox
                  checked={item.recommended_by_service_person}
                  onCheckedChange={(c) => setItem(index, { recommended_by_service_person: c === true })}
                />
                Recommended by service person
              </label>
            </div>
          </li>
        ))}
      </ul>
      {value.items.length < MAX_ITEMS ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange({ ...value, items: [...value.items, { ...EMPTY_PROCUREMENT_ITEM }] })}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          Add item
        </Button>
      ) : null}
      <div className="space-y-1">
        <Label htmlFor={`${baseId}-notes`} className="text-xs">
          Justification / notes <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id={`${baseId}-notes`}
          rows={2}
          maxLength={4000}
          value={value.notes}
          onChange={(e) => onChange({ ...value, notes: e.target.value })}
        />
      </div>
    </div>
  );
}
