import { useState } from "react";
import { Landmark, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient, type IstemInstituteStatus } from "@/lib/api";

/**
 * Main Admin: the I-STEM institute this portal works with, when I-STEM's sign-in names none. Saved on the portal (not in
 * code); I-STEM is asked for the institute's departments before it is saved.
 */
export default function IstemInstituteCard({ status, onSaved, onCancel }: {
  status: IstemInstituteStatus;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const [value, setValue] = useState(status.saved?.institute_id ?? "");
  const [saving, setSaving] = useState(false);
  const valid = /^\d{1,12}$/.test(value.trim());

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    const res = await apiClient.saveIstemInstitute(value.trim());
    setSaving(false);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not save the institute.");
      return;
    }
    toast.success(res.data.departments != null
      ? `I-STEM institute ${res.data.institute_id} saved (${res.data.departments} departments on I-STEM).`
      : `I-STEM institute ${res.data.institute_id} saved.`);
    res.data.warnings.forEach((w) => toast.warning(w));
    onSaved();
  };

  return (
    <section className="rounded-xl border border-sky-200 bg-sky-50/70 p-5 shadow-sm dark:border-sky-900 dark:bg-sky-950/30" aria-label="I-STEM institute"
      data-testid="istem-institute-card">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-600 text-white"><Landmark className="h-4 w-4" /></div>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h2 className="text-base font-semibold">Set the I-STEM institute</h2>
            <p className="text-sm text-muted-foreground">
              I-STEM signs the portal in without naming an institute ({status.user_entity ? `account type ${status.user_entity}` : "no institute_id"}),
              so its equipment cannot be limited to this institute. Enter this institute's I-STEM ID once; it is checked
              on I-STEM and used until I-STEM's sign-in names an institute itself.
            </p>
          </div>
          <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); void save(); }}>
            <div className="space-y-1">
              <Label htmlFor="istem-institute">I-STEM institute ID</Label>
              <Input id="istem-institute" inputMode="numeric" className="w-40" value={value} placeholder="e.g. 213"
                onChange={(e) => setValue(e.target.value)} />
            </div>
            <Button type="submit" disabled={!valid || saving}>
              {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}Check and save
            </Button>
            {onCancel ? <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button> : null}
          </form>
          {status.saved ? (
            <p className="text-xs text-muted-foreground">
              Saved now: institute {status.saved.institute_id}{status.saved.set_by ? `, set by ${status.saved.set_by}` : ""}.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
