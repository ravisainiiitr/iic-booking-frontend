import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Info, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import {
  apiClient,
  type BookingTemplate,
  type BookingTemplateOptions,
  type TemplatePreferredSlot,
  type TemplateSlotAlternative,
  type TemplateSlotFallback,
} from "@/lib/api";
import { describePreferredSlot } from "@/lib/templatePreferredSlot";
import { preferredSlotDraftProblem, type WeeklySlotRow } from "@/lib/weeklySlotTemplate";
import { WeeklyPreferredSlotPicker, type WeeklySlotSelection } from "@/components/WeeklyPreferredSlotPicker";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Booking-form parameters captured just before a book request (the form is reset afterwards). */
export interface BookingAttemptSnapshot {
  equipmentId: number;
  equipmentName: string;
  inputValues: Record<string, unknown>;
  options: BookingTemplateOptions;
  preferredSlot: TemplatePreferredSlot | null;
  templateId: number | null;
  templateName: string | null;
  /** The equipment's weekly slot timings, for choosing the template's preferred slot. */
  slotRows?: WeeklySlotRow[];
  slotRowsHideTimes?: boolean;
  /** Slots the attempt's sample details need; null when unknown. */
  slotsRequired?: number | null;
  slotDurationMinutes?: number | null;
}

const MAX_NAME = 80;

const suggestedName = (s: BookingAttemptSnapshot) => {
  const base = s.preferredSlot ? `${s.equipmentName} – ${describePreferredSlot(s.preferredSlot)}` : `${s.equipmentName} – usual run`;
  return base.slice(0, MAX_NAME);
};

const filledInputs = (values: Record<string, unknown>) =>
  Object.entries(values || {}).filter(([key, v]) => {
    if (key === "comments") return false;
    if (Array.isArray(v)) return v.length > 0;
    return v !== null && v !== undefined && String(v).trim() !== "";
  }).length;

export function SaveAsTemplateDialog({
  open,
  onOpenChange,
  snapshot,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  snapshot: BookingAttemptSnapshot;
  onSaved?: (template: BookingTemplate) => void;
}) {
  const [name, setName] = useState("");
  const [rememberSlot, setRememberSlot] = useState(true);
  const [selection, setSelection] = useState<WeeklySlotSelection | null>(null);
  const [slotMaster, setSlotMaster] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const rows = snapshot.slotRows ?? [];
  const useCalendar = rows.length > 0;

  useEffect(() => {
    if (!open) return;
    const p = snapshot.preferredSlot;
    setName(suggestedName(snapshot));
    setRememberSlot(p != null);
    setSelection(
      p ? { weekday: p.weekday, startTime: p.start_time, slotCount: snapshot.slotsRequired ?? (p.slot_count || 1) } : null
    );
    setSlotMaster(p?.slot_master ?? null);
  }, [open, snapshot]);

  const inputs = useMemo(() => filledInputs(snapshot.inputValues), [snapshot.inputValues]);

  const preferredSlotBody = () => {
    if (!rememberSlot) return {};
    if (!useCalendar) {
      return snapshot.preferredSlot ? { preferred_slot: { ...snapshot.preferredSlot }, if_slot_taken: "ask" as const } : {};
    }
    if (!selection) return {};
    return {
      preferred_slot: {
        weekday: selection.weekday,
        start_time: selection.startTime,
        slot_count: selection.slotCount,
        slot_master: slotMaster,
      },
      if_slot_taken: "ask" as const,
    };
  };

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Give the template a name.");
      return;
    }
    if (rememberSlot && useCalendar) {
      const problem = preferredSlotDraftProblem(
        { enabled: true, weekday: selection?.weekday ?? 0, startTime: selection?.startTime ?? "", slotCount: selection?.slotCount ?? 1 },
        rows
      );
      if (problem) {
        toast.error(problem);
        return;
      }
    }
    setSaving(true);
    try {
      const res = await apiClient.createBookingTemplate({
        equipment: snapshot.equipmentId,
        name: trimmed,
        input_values: snapshot.inputValues,
        options: snapshot.options,
        ...preferredSlotBody(),
      });
      if (res.error || !res.data) {
        toast.error(res.error || "Could not save the template.");
        return;
      }
      toast.success(`Template "${res.data.name}" saved. Choose it on the booking page next time.`);
      onSaved?.(res.data);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className={useCalendar && rememberSlot ? "max-w-3xl max-h-[90vh] overflow-y-auto" : "max-w-md"}>
        <DialogHeader>
          <DialogTitle>Save as a booking template</DialogTitle>
          <DialogDescription>
            Saves the sample details and booking options you just used for {snapshot.equipmentName}
            {inputs > 0 ? ` (${inputs} input${inputs === 1 ? "" : "s"} filled)` : ""}. Choose the template on the booking page
            to fill the form in one step.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="save-attempt-template-name">Template name</Label>
            <Input
              id="save-attempt-template-name"
              value={name}
              maxLength={MAX_NAME}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void save();
                }
              }}
            />
          </div>
          {useCalendar && (
            <div className="space-y-3 rounded-lg border p-3">
              <label htmlFor="save-attempt-remember-slot" className="flex items-start gap-3 cursor-pointer">
                <Checkbox
                  id="save-attempt-remember-slot"
                  checked={rememberSlot}
                  onCheckedChange={(c) => setRememberSlot(c === true)}
                  className="mt-0.5 h-4 w-4"
                />
                <span className="space-y-0.5 text-sm">
                  <span className="block">Pre-select a weekly preferred slot next time</span>
                  <span className="block text-xs text-muted-foreground">
                    Saved as a weekly preference. If it is taken you will be asked; edit the template to allow booking the
                    next free slot automatically.
                  </span>
                </span>
              </label>
              {rememberSlot && (
                <WeeklyPreferredSlotPicker
                  rows={rows}
                  hideTimes={snapshot.slotRowsHideTimes}
                  slotsRequired={snapshot.slotsRequired ?? null}
                  slotDurationMinutes={snapshot.slotDurationMinutes}
                  requiredBasis="based on the sample details you just used"
                  value={selection}
                  onChange={(next, reason) => {
                    setSelection(next);
                    if (reason !== "resize") setSlotMaster(null);
                  }}
                />
              )}
            </div>
          )}
          {!useCalendar && snapshot.preferredSlot && (
            <label htmlFor="save-attempt-remember-slot" className="flex items-start gap-3 cursor-pointer rounded-lg border p-3">
              <Checkbox
                id="save-attempt-remember-slot"
                checked={rememberSlot}
                onCheckedChange={(c) => setRememberSlot(c === true)}
                className="mt-0.5 h-4 w-4"
              />
              <span className="space-y-0.5 text-sm">
                <span className="block">
                  Pre-select this slot next time: <strong>{describePreferredSlot(snapshot.preferredSlot)}</strong>
                </span>
                <span className="block text-xs text-muted-foreground">
                  Saved as a weekly preference. If it is taken you will be asked; edit the template to allow booking the
                  next free slot automatically.
                </span>
              </span>
            </label>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={saving || !name.trim()} onClick={() => void save()}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Extra content for the booking result dialog: fallback notice, nearby free slots and "save as template". */
export function BookingAttemptFollowUp({
  snapshot,
  slotFallback,
  slotAlternatives,
  onPickAlternative,
  onTemplateSaved,
}: {
  snapshot: BookingAttemptSnapshot | null;
  slotFallback?: TemplateSlotFallback | null;
  slotAlternatives?: TemplateSlotAlternative[] | null;
  onPickAlternative?: (alternative: TemplateSlotAlternative) => void;
  onTemplateSaved?: (template: BookingTemplate) => void;
}) {
  const [saveOpen, setSaveOpen] = useState(false);
  if (!snapshot && !slotFallback) return null;
  return (
    <div className="space-y-3">
      {slotFallback && (
        <div className="rounded-lg border border-amber-300/70 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-50">
          <div className="flex gap-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p>{slotFallback.message}</p>
          </div>
        </div>
      )}
      {slotAlternatives && slotAlternatives.length > 0 && onPickAlternative && (
        <div className="space-y-1.5">
          <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <CalendarClock className="h-4 w-4" aria-hidden />
            Nearest free slots of the same length
          </p>
          <div className="flex flex-wrap gap-1.5">
            {slotAlternatives.map((a) => (
              <Button
                key={a.slot_ids.join("-")}
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs"
                onClick={() => onPickAlternative(a)}
              >
                {a.label}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Choosing one reloads your template and selects that slot; then click Book.</p>
        </div>
      )}
      {snapshot && (
        <>
          <Button type="button" variant="outline" size="sm" className="w-full gap-2" onClick={() => setSaveOpen(true)}>
            <Save className="h-4 w-4" />
            Save these parameters as a template
          </Button>
          <SaveAsTemplateDialog open={saveOpen} onOpenChange={setSaveOpen} snapshot={snapshot} onSaved={onTemplateSaved} />
        </>
      )}
    </div>
  );
}

export default BookingAttemptFollowUp;
