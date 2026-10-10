import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Timer } from "lucide-react";
import { apiClient, type FabricationEquipmentRow, type LaserEstimateProfile } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const DETECTED = "__detected__";
const SPEED_RANGE = [0.05, 5000] as const;
const PIERCE_RANGE = [0, 600] as const;

type MaterialDraft = Record<string, { speed: string; pierce: string }>;

function presetLabel(profile: LaserEstimateProfile, key: string): string {
  return profile.presets.find((p) => p.key === key)?.label ?? key;
}

function overrideDraft(profile: LaserEstimateProfile): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(profile.overrides ?? {})) out[k] = String(v);
  return out;
}

function materialDraft(profile: LaserEstimateProfile): MaterialDraft {
  const out: MaterialDraft = {};
  for (const m of profile.materials) {
    out[String(m.material_id)] = {
      speed: m.cut_speed_mm_s == null ? "" : String(m.cut_speed_mm_s),
      pierce: m.pierce_s == null ? "" : String(m.pierce_s),
    };
  }
  return out;
}

function inRange(raw: string, [min, max]: readonly [number, number]): number | null {
  const n = Number(raw);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

/** OIC: machine type, motion parameters and per-sheet cutting speeds of the DXF machine-time estimate. */
export function LaserEstimateProfileCard({
  equipment,
  disabled,
  onSaved,
}: {
  equipment: FabricationEquipmentRow;
  disabled?: boolean;
  onSaved: (row: FabricationEquipmentRow) => void;
}) {
  const profile = equipment.laser_estimate;
  const [preset, setPreset] = useState(DETECTED);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [materials, setMaterials] = useState<MaterialDraft>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setPreset(profile.preset || DETECTED);
    setDraft(overrideDraft(profile));
    setMaterials(materialDraft(profile));
  }, [equipment.equipment_id, profile]);

  const savedDraft = useMemo(() => (profile ? overrideDraft(profile) : {}), [profile]);
  const savedMaterials = useMemo(() => (profile ? materialDraft(profile) : {}), [profile]);
  if (!profile) return null;

  const presetChanged = (preset === DETECTED ? "" : preset) !== (profile.preset || "");
  const cleanedDraft = Object.fromEntries(Object.entries(draft).filter(([, v]) => v.trim() !== ""));
  const overridesChanged = JSON.stringify(cleanedDraft) !== JSON.stringify(savedDraft);
  const materialsChanged = profile.materials.some((m) => {
    const id = String(m.material_id);
    const a = materials[id] ?? { speed: "", pierce: "" };
    const b = savedMaterials[id] ?? { speed: "", pierce: "" };
    return a.speed.trim() !== b.speed.trim() || a.pierce.trim() !== b.pierce.trim();
  });
  const dirty = presetChanged || overridesChanged || materialsChanged;

  const onSave = async () => {
    const overrides: Record<string, number> = {};
    for (const p of profile.parameters) {
      const raw = (draft[p.key] ?? "").trim();
      if (raw === "") continue;
      const n = Number(raw);
      if (!Number.isFinite(n) || (p.min != null && n < p.min) || (p.max != null && n > p.max)) {
        toast.error(`${p.label} must be between ${p.min} and ${p.max}${p.unit ? ` ${p.unit}` : ""}.`);
        return;
      }
      overrides[p.key] = n;
    }
    const materialOverrides: Record<string, { cut_speed_mm_s?: number; pierce_s?: number }> = {};
    for (const m of profile.materials) {
      const row = materials[String(m.material_id)];
      if (!row) continue;
      const out: { cut_speed_mm_s?: number; pierce_s?: number } = {};
      if (row.speed.trim()) {
        const n = inRange(row.speed.trim(), SPEED_RANGE);
        if (n === null) {
          toast.error(`${m.name}: cutting speed must be between ${SPEED_RANGE[0]} and ${SPEED_RANGE[1]} mm/s.`);
          return;
        }
        out.cut_speed_mm_s = n;
      }
      if (row.pierce.trim()) {
        const n = inRange(row.pierce.trim(), PIERCE_RANGE);
        if (n === null) {
          toast.error(`${m.name}: pierce time must be between ${PIERCE_RANGE[0]} and ${PIERCE_RANGE[1]} s.`);
          return;
        }
        out.pierce_s = n;
      }
      if (Object.keys(out).length) materialOverrides[String(m.material_id)] = out;
    }
    setBusy(true);
    const res = await apiClient.updateFabricationMaterialEquipment({
      equipment_id: equipment.equipment_id,
      ...(presetChanged ? { laser_estimate_preset: preset === DETECTED ? "" : preset } : {}),
      // A different machine type resets the parameters and sheet speeds on the server.
      ...(overridesChanged && !presetChanged ? { laser_estimate_overrides: overrides } : {}),
      ...(materialsChanged && !presetChanged ? { laser_estimate_material_overrides: materialOverrides } : {}),
    });
    setBusy(false);
    if (res.error || !res.data?.equipment) {
      toast.error(res.error || "Could not save the estimate settings.");
      return;
    }
    onSaved(res.data.equipment);
    toast.success("Cutting time settings saved. New quotes use them; existing bookings keep their charges.");
  };

  const setMaterial = (id: string, patch: Partial<{ speed: string; pierce: string }>) =>
    setMaterials((prev) => ({ ...prev, [id]: { ...(prev[id] ?? { speed: "", pierce: "" }), ...patch } }));

  return (
    <Card data-testid="laser-estimate-profile">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Timer className="h-5 w-5" /> Cutting time estimate
        </CardTitle>
        <CardDescription>
          The machine time of a booking is worked out from each DXF: total cut length at the sheet&apos;s cutting speed
          (slowed for tight arcs and sharp corners by the acceleration), one pierce per closed shape or open path, the
          head moves between them, plus setup, sheet loading and the allowance. It sets the slot length and the
          machine-time charge. Changes apply to new quotes and recalculations; existing bookings keep their charges.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="laser-estimate-preset">Machine type</Label>
          <Select value={preset} onValueChange={setPreset} disabled={disabled}>
            <SelectTrigger id="laser-estimate-preset" data-testid="laser-estimate-preset">
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
            In use: {profile.effective_preset_label}. Changing the machine type resets the parameters and sheet speeds
            below to its defaults.
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Machine parameters</p>
          <p className="text-xs text-muted-foreground">Leave a field empty to use the machine type&apos;s default.</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {profile.parameters.map((p) => (
              <div key={p.key} className="space-y-1">
                <Label htmlFor={`le-${p.key}`} className="text-xs">
                  {p.label}
                  {p.unit ? ` (${p.unit})` : ""}
                </Label>
                <Input
                  id={`le-${p.key}`}
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
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2" data-testid="laser-estimate-materials">
          <p className="text-sm font-medium">Cutting speed and pierce time per sheet</p>
          <p className="text-xs text-muted-foreground">
            The grey values are typical for this machine type at the sheet&apos;s thickness. Enter the speed you actually
            cut at (from the machine&apos;s material library) to make the estimate match your machine.
          </p>
          {profile.materials.length === 0 ? (
            <p className="text-xs text-muted-foreground">No sheet materials are enabled for this machine yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs">
                    <th className="px-3 py-2 font-medium">Sheet</th>
                    <th className="px-3 py-2 font-medium">Cutting speed (mm/s)</th>
                    <th className="px-3 py-2 font-medium">Pierce time (s)</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.materials.map((m) => {
                    const id = String(m.material_id);
                    const row = materials[id] ?? { speed: "", pierce: "" };
                    return (
                      <tr key={id} className="border-b last:border-0 align-top" data-testid={`laser-estimate-material-${id}`}>
                        <td className="px-3 py-2">
                          <span className="font-medium">{m.name}</span>{" "}
                          <span className="text-xs text-muted-foreground">
                            ({m.code}, {m.thickness_mm} mm)
                          </span>
                          {m.warning && <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">{m.warning}</p>}
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            inputMode="decimal"
                            step="any"
                            min={SPEED_RANGE[0]}
                            className="h-8 w-28"
                            aria-label={`Cutting speed for ${m.name}`}
                            placeholder={String(m.chart_cut_speed_mm_s)}
                            value={row.speed}
                            disabled={disabled || presetChanged}
                            onChange={(e) => setMaterial(id, { speed: e.target.value })}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            inputMode="decimal"
                            step="any"
                            min={PIERCE_RANGE[0]}
                            className="h-8 w-24"
                            aria-label={`Pierce time for ${m.name}`}
                            placeholder={String(m.chart_pierce_s)}
                            value={row.pierce}
                            disabled={disabled || presetChanged}
                            onChange={(e) => setMaterial(id, { pierce: e.target.value })}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <Button type="button" onClick={() => void onSave()} disabled={disabled || !dirty || busy}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save cutting time settings
        </Button>
      </CardContent>
    </Card>
  );
}

export default LaserEstimateProfileCard;
