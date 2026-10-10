import { useEffect, useId, useState } from "react";
import { Boxes, Plus, Trash2 } from "lucide-react";
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
import { pmGet, type PmSuggestedLine } from "@/lib/procurementApi";

const MAX_ITEMS = 50;

export const EMPTY_PROCUREMENT_DRAFT: ProcurementRequestDraft = {
  category: "",
  items: [{ ...EMPTY_PROCUREMENT_ITEM }],
  notes: "",
};

/** Draft row for an equipment-linked inventory item (quantity defaults to the suggested refill). */
export function suggestionToDraftItem(s: PmSuggestedLine): ProcurementItemDraft {
  const stock = Number(s.central_stock) + Number(s.lab_stock);
  const notes = [s.part_number ? `Part no. ${s.part_number}` : "", `${s.code}; in stock: ${stock} ${s.uom}`.trim()]
    .filter(Boolean)
    .join("; ");
  return {
    item_id: s.item_id,
    name: s.name,
    quantity: String(Number(s.suggested_quantity) || Number(s.typical_quantity) || 1),
    estimated_cost: s.last_unit_price ? String(Number(s.last_unit_price)) : "",
    recommended_by_service_person: true,
    notes,
  };
}

function LinkedItems({
  equipmentId,
  picked,
  onPick,
}: {
  equipmentId: number;
  picked: number[];
  onPick: (s: PmSuggestedLine) => void;
}) {
  const [rows, setRows] = useState<PmSuggestedLine[] | null>(null);
  useEffect(() => {
    let alive = true;
    pmGet<{ results: PmSuggestedLine[] }>(`equipment/${equipmentId}/suggested-lines/`)
      .then((r) => alive && setRows(r.results ?? []))
      .catch(() => alive && setRows([]));
    return () => {
      alive = false;
    };
  }, [equipmentId]);
  if (!rows || rows.length === 0) return null;
  return (
    <div className="space-y-1.5 rounded-md bg-muted/40 p-2.5" data-testid="linked-items">
      <p className="flex items-center gap-1.5 text-xs font-medium">
        <Boxes className="h-3.5 w-3.5" aria-hidden />
        Items linked to this equipment (from inventory)
      </p>
      <div className="flex flex-wrap gap-1.5">
        {rows.map((s) => {
          const stock = Number(s.central_stock) + Number(s.lab_stock);
          const added = picked.includes(s.item_id);
          return (
            <Button
              key={s.item_id}
              type="button"
              size="sm"
              variant={added ? "secondary" : "outline"}
              className="h-7 text-xs"
              disabled={added}
              title={`${s.code} · in stock ${stock} ${s.uom}${s.reorder_due ? " · below reorder level" : ""}`}
              onClick={() => onPick(s)}
            >
              {added ? "✓ " : "+ "}
              {s.name}
              <span className={s.reorder_due ? "ml-1 text-amber-700 dark:text-amber-400" : "ml-1 text-muted-foreground"}>
                ({stock} {s.uom})
              </span>
            </Button>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Stores will issue from stock where enough is on hand and buy only the rest.
      </p>
    </div>
  );
}

/**
 * Items the service person recommended (consumables, minor or major assets). Raised as a Procurement &
 * Assets request that follows the department's normal approval workflow.
 */
export function ProcurementItemsFields({
  categories,
  value,
  onChange,
  equipmentId,
}: {
  categories: ReasonCategoryOption[];
  value: ProcurementRequestDraft;
  onChange: (next: ProcurementRequestDraft) => void;
  /** When set, offers the equipment's linked consumables / spares from inventory. */
  equipmentId?: number | null;
}) {
  const baseId = useId();
  const setItem = (index: number, patch: Partial<ProcurementItemDraft>) =>
    onChange({ ...value, items: value.items.map((it, i) => (i === index ? { ...it, ...patch } : it)) });
  const pickLinked = (s: PmSuggestedLine) => {
    const blank = value.items.filter((it) => it.name.trim() || it.item_id);
    if (blank.length >= MAX_ITEMS) return;
    onChange({ ...value, items: [...blank, suggestionToDraftItem(s)] });
  };
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
      {equipmentId ? (
        <LinkedItems
          equipmentId={equipmentId}
          picked={value.items.map((it) => it.item_id ?? 0).filter(Boolean)}
          onPick={pickLinked}
        />
      ) : null}
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
