import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Props = {
  /** Unset (new equipment, older API data) counts as ticked: the switch defaults to on. */
  checked?: boolean;
  /** Only the main administrator or a superuser may change the switch; others see it read-only. */
  canEdit: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
};

/**
 * Who may change the switch, as decided by the API (main administrator or superuser). Until the
 * form choices load, or on an older API without the flag, fall back to the main-admin user type.
 */
export function canEditSampleSetsSwitch(apiFlag: boolean | undefined, isMainAdmin: boolean): boolean {
  return typeof apiFlag === "boolean" ? apiFlag : isMainAdmin;
}

/** Equipment form switch: "Allow samples with different parameters" (extra sample sets in one booking). */
export function AllowSampleSetsField({ checked, canEdit, onCheckedChange, className }: Props) {
  return (
    <div className={cn("flex items-start gap-2", className)} data-testid="allow-multiple-sample-sets">
      <Checkbox
        id="equipment-allow-multiple-sample-sets"
        className="mt-0.5"
        checked={checked !== false}
        disabled={!canEdit}
        onCheckedChange={(c) => onCheckedChange(c === true)}
      />
      <div className="space-y-0.5">
        <Label
          htmlFor="equipment-allow-multiple-sample-sets"
          className={cn("text-sm font-normal", canEdit ? "cursor-pointer" : "cursor-not-allowed opacity-70")}
        >
          Allow samples with different parameters
        </Label>
        <p className="text-xs text-muted-foreground">
          Users can add extra sample sets to one booking; each set is charged and timed separately. Existing bookings
          keep their sets.
          {!canEdit && " Only the main administrator can change this."}
        </p>
      </div>
    </div>
  );
}
