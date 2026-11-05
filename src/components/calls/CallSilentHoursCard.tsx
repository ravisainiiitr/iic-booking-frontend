import { useEffect, useState } from "react";
import { BellOff } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { apiClient, type CallSilentHours } from "@/lib/api";

/**
 * For the Officer In Charge, on the instrument's page: when users cannot call this instrument's staff. The server decides
 * who may see and change this, and enforces the hours. Shows nothing if it refuses.
 */
export default function CallSilentHoursCard({ equipmentId }: { equipmentId: number }) {
  const [values, setValues] = useState<CallSilentHours | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void apiClient.getCallSilentHours(equipmentId).then((res) => {
      if (!cancelled) setValues(res.data ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [equipmentId]);

  if (!values) return null;
  const change = (patch: Partial<CallSilentHours>) => setValues({ ...values, ...patch });

  const save = async () => {
    setSaving(true);
    const res = await apiClient.saveCallSilentHours(equipmentId, values);
    setSaving(false);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not save silent hours.");
      return;
    }
    setValues(res.data);
    toast.success("Silent hours saved.");
  };

  return (
    <div className="rounded-md border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <BellOff className="h-4 w-4" aria-hidden /> Silent hours for calls
          </h4>
          <p className="mt-1 text-sm text-muted-foreground">
            When on, users cannot call the Lab Operator, Officer In Charge or Accounts In Charge about this instrument outside office hours. Lab staff can still call users.
          </p>
        </div>
        <Switch aria-label="Silent hours" checked={values.enabled} onCheckedChange={(enabled) => change({ enabled })} />
      </div>

      {values.follows_base_equipment ? (
        <p className="mt-2 text-sm text-muted-foreground">This mode follows the silent hours of its base equipment until you save its own.</p>
      ) : null}
      {values.active_now ? <p className="mt-2 text-sm font-medium text-amber-700 dark:text-amber-300">Users cannot call right now.</p> : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="silent-office-start">Office hours start</Label>
          <Input id="silent-office-start" type="time" value={values.office_start} onChange={(e) => change({ office_start: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="silent-office-end">Office hours end</Label>
          <Input id="silent-office-end" type="time" value={values.office_end} onChange={(e) => change({ office_end: e.target.value })} />
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center gap-2">
          <Checkbox id="silent-weekends" checked={values.silent_weekends} onCheckedChange={(on) => change({ silent_weekends: on === true })} />
          <Label htmlFor="silent-weekends">Silent on Saturdays and Sundays</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="silent-holidays" checked={values.silent_holidays} onCheckedChange={(on) => change({ silent_holidays: on === true })} />
          <Label htmlFor="silent-holidays">Silent on holidays</Label>
        </div>
      </div>

      <Button type="button" size="sm" className="mt-4" disabled={saving} onClick={() => void save()}>
        {saving ? "Saving..." : "Save"}
      </Button>
    </div>
  );
}
