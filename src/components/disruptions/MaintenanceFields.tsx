import { useId } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MaintenanceDraft, ReasonCategoryOption } from "@/lib/disruptions";

const FALLBACK_KINDS: ReasonCategoryOption[] = [
  { value: "BREAKDOWN", label: "Breakdown repair" },
  { value: "PREVENTIVE", label: "Preventive maintenance" },
  { value: "CALIBRATION", label: "Calibration" },
];

/** Maintenance history fields offered when equipment is marked back to functional. */
export function MaintenanceFields({
  kinds,
  value,
  onChange,
}: {
  kinds: ReasonCategoryOption[];
  value: MaintenanceDraft;
  onChange: (next: MaintenanceDraft) => void;
}) {
  const baseId = useId();
  const options = kinds.length > 0 ? kinds : FALLBACK_KINDS;
  const set = (patch: Partial<MaintenanceDraft>) => onChange({ ...value, ...patch });
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" data-testid="maintenance-fields">
      <div className="space-y-1">
        <Label htmlFor={`${baseId}-kind`} className="text-xs">
          Type
        </Label>
        <select
          id={`${baseId}-kind`}
          className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
          value={value.kind}
          onChange={(e) => set({ kind: e.target.value })}
        >
          {options.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${baseId}-provider`} className="text-xs">
          Service provider <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id={`${baseId}-provider`}
          className="h-8"
          maxLength={255}
          value={value.service_provider}
          onChange={(e) => set({ service_provider: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${baseId}-service`} className="text-xs">
          Service charges (₹)
        </Label>
        <Input
          id={`${baseId}-service`}
          className="h-8"
          type="number"
          min={0}
          inputMode="decimal"
          value={value.service_cost}
          onChange={(e) => set({ service_cost: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${baseId}-other`} className="text-xs">
          Other costs (₹)
        </Label>
        <Input
          id={`${baseId}-other`}
          className="h-8"
          type="number"
          min={0}
          inputMode="decimal"
          value={value.other_cost}
          onChange={(e) => set({ other_cost: e.target.value })}
        />
      </div>
      <label className="flex items-center gap-2 text-xs sm:col-span-2">
        <Checkbox
          checked={value.under_warranty_or_amc}
          onCheckedChange={(c) => set({ under_warranty_or_amc: c === true })}
        />
        Covered by warranty / AMC
      </label>
      <div className="space-y-1 sm:col-span-2">
        <Label htmlFor={`${baseId}-remarks`} className="text-xs">
          Remarks <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id={`${baseId}-remarks`}
          className="h-8"
          maxLength={2000}
          value={value.remarks}
          onChange={(e) => set({ remarks: e.target.value })}
        />
      </div>
    </div>
  );
}
