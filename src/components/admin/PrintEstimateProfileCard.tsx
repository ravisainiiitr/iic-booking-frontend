import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Gauge, Loader2 } from "lucide-react";
import {
  apiClient,
  type FabricationEquipmentRow,
  type MasterPrintMaterial,
  type PrintEstimateCalibration,
  type PrintEstimateProfile,
} from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const DETECTED = "__detected__";

function presetLabel(profile: PrintEstimateProfile, key: string): string {
  return profile.presets.find((p) => p.key === key)?.label ?? key;
}

function overrideDraft(profile: PrintEstimateProfile): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(profile.overrides ?? {})) out[k] = String(v);
  return out;
}

function pct(value: number | null | undefined): string {
  return value == null ? "—" : `${value}%`;
}

function CalibrationSummary({ calibration }: { calibration: PrintEstimateCalibration }) {
  const rows: Array<[string, number | null, number, number | null, number | null]> = [
    ["Weight", calibration.weight_factor, calibration.weight_samples, calibration.weight_error_before_pct, calibration.weight_error_after_pct],
    ["Time", calibration.time_factor, calibration.time_samples, calibration.time_error_before_pct, calibration.time_error_after_pct],
  ];
  return (
    <ul className="space-y-1 text-xs" data-testid="print-estimate-calibration">
      {rows.map(([label, factor, samples, before, after]) => (
        <li key={label}>
          <span className="font-medium">{label}:</span>{" "}
          {factor == null
            ? `not enough parts with actuals (${samples} of ${calibration.min_samples} needed)`
            : `× ${factor} from ${samples} part(s); median error ${pct(before)} → ${pct(after)}`}
        </li>
      ))}
    </ul>
  );
}

/** OIC: printer type and parameters of the 3D print weight / time estimate, calibration from actual prints,
 * and the separate support materials offered on the printer. */
export function PrintEstimateProfileCard({
  equipment,
  master,
  disabled,
  onSaved,
}: {
  equipment: FabricationEquipmentRow;
  master: MasterPrintMaterial[];
  disabled?: boolean;
  onSaved: (row: FabricationEquipmentRow) => void;
}) {
  const profile = equipment.print_estimate;
  const [preset, setPreset] = useState(DETECTED);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [supportIds, setSupportIds] = useState<number[]>([]);
  const [busy, setBusy] = useState<null | "save" | "fit" | "apply" | "off">(null);

  useEffect(() => {
    if (!profile) return;
    setPreset(profile.preset || DETECTED);
    setDraft(overrideDraft(profile));
    setSupportIds(profile.support_material_ids ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipment.equipment_id, profile]);

  const savedDraft = useMemo(() => (profile ? overrideDraft(profile) : {}), [profile]);
  const activeMaterials = useMemo(() => master.filter((m) => m.is_active !== false), [master]);
  if (!profile) return null;

  const presetChanged = (preset === DETECTED ? "" : preset) !== (profile.preset || "");
  const cleanedDraft = Object.fromEntries(Object.entries(draft).filter(([, v]) => v.trim() !== ""));
  const overridesChanged = JSON.stringify(cleanedDraft) !== JSON.stringify(savedDraft);
  const supportsChanged = JSON.stringify([...supportIds].sort((a, b) => a - b)) !== JSON.stringify(profile.support_material_ids ?? []);
  const dirty = presetChanged || overridesChanged || supportsChanged;

  const send = async (payload: Parameters<typeof apiClient.updateFabricationMaterialEquipment>[0], kind: NonNullable<typeof busy>) => {
    setBusy(kind);
    const res = await apiClient.updateFabricationMaterialEquipment(payload);
    setBusy(null);
    if (res.error || !res.data?.equipment) {
      toast.error(res.error || "Could not save the estimate settings.");
      return false;
    }
    onSaved(res.data.equipment);
    return true;
  };

  const onSave = async () => {
    const overrides: Record<string, number | boolean | null> = {};
    for (const p of profile.parameters) {
      const raw = (draft[p.key] ?? "").trim();
      if (raw === "") continue;
      if (p.kind === "bool") {
        overrides[p.key] = raw === "true";
        continue;
      }
      const n = Number(raw);
      if (!Number.isFinite(n) || (p.min != null && n < p.min) || (p.max != null && n > p.max)) {
        toast.error(`${p.label} must be between ${p.min} and ${p.max}${p.unit ? ` ${p.unit}` : ""}.`);
        return;
      }
      overrides[p.key] = n;
    }
    const ok = await send(
      {
        equipment_id: equipment.equipment_id,
        ...(presetChanged ? { print_estimate_preset: preset === DETECTED ? "" : preset } : {}),
        // A different printer technology resets the parameters on the server.
        ...(overridesChanged && !presetChanged ? { print_estimate_overrides: overrides } : {}),
        ...(supportsChanged ? { print_estimate_support_material_ids: supportIds } : {}),
      },
      "save",
    );
    if (ok) toast.success("Estimate settings saved. New uploads use them; existing bookings keep their charges.");
  };

  const calibration = profile.calibration;
  const canApply = !!calibration && (calibration.weight_factor != null || calibration.time_factor != null);

  return (
    <Card data-testid="print-estimate-profile">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Gauge className="h-5 w-5" /> Weight &amp; time estimate
        </CardTitle>
        <CardDescription>
          Estimates come from the model&apos;s geometry (walls, top / bottom skin, infill, supports, waste) and this
          printer&apos;s profile. Speeds are effective averages, not the slicer&apos;s maximum speeds. Changes apply to new
          uploads and recalculations; existing bookings keep their charges.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="print-estimate-preset">Printer type</Label>
          <Select value={preset} onValueChange={setPreset} disabled={disabled}>
            <SelectTrigger id="print-estimate-preset" data-testid="print-estimate-preset">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={DETECTED}>Detected: {presetLabel(profile, profile.detected_preset)}</SelectItem>
              {profile.presets.map((p) => (
                <SelectItem key={p.key} value={p.key}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            In use: {presetLabel(profile, profile.effective_preset)} ({profile.technology_label}). Changing the technology
            resets the parameters below to its defaults.
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Parameters</p>
          <p className="text-xs text-muted-foreground">Leave a field empty to use the printer type&apos;s default.</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {profile.parameters.map((p) => (
              <div key={p.key} className="space-y-1">
                <Label htmlFor={`pe-${p.key}`} className="text-xs">
                  {p.label}
                  {p.unit ? ` (${p.unit})` : ""}
                </Label>
                {p.kind === "bool" ? (
                  <div className="flex items-center gap-2">
                    <Switch
                      id={`pe-${p.key}`}
                      checked={(draft[p.key] ?? String(p.default)) === "true"}
                      disabled={disabled}
                      onCheckedChange={(v) => setDraft((d) => ({ ...d, [p.key]: v === Boolean(p.default) ? "" : String(v) }))}
                    />
                    {draft[p.key] && <Badge variant="secondary">changed</Badge>}
                  </div>
                ) : (
                  <Input
                    id={`pe-${p.key}`}
                    type="number"
                    inputMode="decimal"
                    min={p.min ?? undefined}
                    max={p.max ?? undefined}
                    step="any"
                    value={draft[p.key] ?? ""}
                    placeholder={p.default == null ? "" : String(p.default)}
                    disabled={disabled || presetChanged}
                    onChange={(e) => setDraft((d) => ({ ...d, [p.key]: e.target.value }))}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {profile.supports_available && (
          <div className="space-y-2" data-testid="print-estimate-support-materials">
            <p className="text-sm font-medium">Separate support materials</p>
            <p className="text-xs text-muted-foreground">
              Users can print supports in one of these (e.g. soluble PVA on a dual-extruder printer), charged at its own
              rate. With none ticked, supports are printed in the model material.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {activeMaterials.map((m) => (
                <label key={m.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={supportIds.includes(m.id)}
                    disabled={disabled}
                    onCheckedChange={(v) =>
                      setSupportIds((ids) => (v === true ? [...ids, m.id] : ids.filter((i) => i !== m.id)))
                    }
                    aria-label={`Support material ${m.name}`}
                  />
                  {m.name} <span className="text-xs text-muted-foreground">({m.code})</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <Button type="button" onClick={() => void onSave()} disabled={disabled || !dirty || busy !== null}>
          {busy === "save" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save estimate settings
        </Button>

        <div className="space-y-2 rounded-md border p-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">Calibration from actual prints</p>
            {calibration?.applied ? <Badge>Applied</Badge> : <Badge variant="secondary">Off</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">
            Compares the estimates with the actual weight and time staff enter after printing (parts whose actuals were
            left unchanged are skipped) and suggests a correction factor.
          </p>
          {calibration ? <CalibrationSummary calibration={calibration} /> : <p className="text-xs">Not fitted yet.</p>}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled || busy !== null}
              onClick={() => void send({ equipment_id: equipment.equipment_id, print_estimate_calibration: "fit" }, "fit")}
            >
              {busy === "fit" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Fit from actuals
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={disabled || busy !== null || !canApply || calibration?.applied}
              onClick={() => void send({ equipment_id: equipment.equipment_id, print_estimate_calibration: "apply" }, "apply")}
            >
              Apply factors
            </Button>
            {calibration?.applied && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={disabled || busy !== null}
                onClick={() => void send({ equipment_id: equipment.equipment_id, print_estimate_calibration: "off" }, "off")}
              >
                Turn off
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default PrintEstimateProfileCard;
