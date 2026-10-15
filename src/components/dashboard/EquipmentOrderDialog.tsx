import { useEffect, useState, type DragEvent } from "react";
import { ArrowDown, ArrowUp, GripVertical, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { moveItem } from "@/lib/equipmentPriority";
import { cn } from "@/lib/utils";

export interface EquipmentOrderItem {
  id: number;
  label: string;
}

interface EquipmentOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Equipment in the current priority order. */
  items: EquipmentOrderItem[];
  /** Equipment in the order used when no priority is saved (for Reset to default). */
  defaultItems: EquipmentOrderItem[];
  /** Saves the ids top priority first (empty = default order); resolves to an error message or null. */
  onSave: (equipmentIds: number[]) => Promise<string | null>;
}

const DRAG_TYPE = "application/x-iic-equipment-order";

export default function EquipmentOrderDialog({ open, onOpenChange, items, defaultItems, onSave }: EquipmentOrderDialogProps) {
  const [draft, setDraft] = useState<EquipmentOrderItem[]>(items);
  const [resetPending, setResetPending] = useState(false);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(items);
      setResetPending(false);
      setDropIndex(null);
      setError(null);
    }
  }, [open, items]);

  const move = (from: number, to: number) => {
    if (from === to) return;
    setDraft((d) => moveItem(d, from, to));
    setResetPending(false);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    const err = await onSave(resetPending ? [] : draft.map((item) => item.id));
    setSaving(false);
    if (err) setError(err);
    else onOpenChange(false);
  };

  const rowDropProps = (index: number) => ({
    onDragOver: (e: DragEvent) => {
      if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDropIndex(index);
    },
    onDragLeave: () => setDropIndex(null),
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      const from = Number(e.dataTransfer.getData(DRAG_TYPE));
      setDropIndex(null);
      if (Number.isInteger(from)) move(from, index);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto" data-testid="equipment-order-dialog">
        <DialogHeader>
          <DialogTitle>Set equipment order</DialogTitle>
          <DialogDescription>
            Drag the equipment, or use the up and down arrows, to set your priority (1 is the top). The Lab dashboard
            opens on your top equipment and lists them in this order. Equipment assigned to you later is added at the
            end.
          </DialogDescription>
        </DialogHeader>

        <ol className="space-y-1" aria-label="Equipment priority">
          {draft.map((item, index) => (
            <li
              key={item.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(DRAG_TYPE, String(index));
                e.dataTransfer.effectAllowed = "move";
              }}
              {...rowDropProps(index)}
              className={cn(
                "flex items-center gap-2 rounded-md border bg-card px-2 py-1.5 text-sm",
                dropIndex === index && "border-t-2 border-t-primary",
              )}
              data-testid="equipment-order-row"
            >
              <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground" aria-hidden />
              <span
                className="min-w-[1.6rem] rounded bg-muted px-1 text-center text-xs font-semibold tabular-nums text-muted-foreground"
                title="Priority (1 = loaded by default)"
              >
                {index + 1}
              </span>
              <span className="min-w-0 flex-1 break-words">{item.label}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 sm:h-7 sm:w-7"
                aria-label={`Move ${item.label} up`}
                title="Move up"
                disabled={index === 0 || saving}
                onClick={() => move(index, index - 1)}
              >
                <ArrowUp className="h-4 w-4 sm:h-3.5 sm:w-3.5" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 sm:h-7 sm:w-7"
                aria-label={`Move ${item.label} down`}
                title="Move down"
                disabled={index >= draft.length - 1 || saving}
                onClick={() => move(index, index + 1)}
              >
                <ArrowDown className="h-4 w-4 sm:h-3.5 sm:w-3.5" aria-hidden />
              </Button>
            </li>
          ))}
        </ol>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            className="gap-1.5"
            onClick={() => {
              setDraft(defaultItems);
              setResetPending(true);
            }}
            disabled={saving}
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            Reset to default
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void save()} disabled={saving}>
              {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />}
              Save order
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
