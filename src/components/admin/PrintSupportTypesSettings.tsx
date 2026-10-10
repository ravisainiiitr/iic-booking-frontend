import type { PrintSupportOptionsConfig, PrintSupportOptionsUpdate } from "@/lib/api";
import { SupportTypeIcon } from "@/components/PrintSupportTypeControls";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const SUPPORT_FACTOR_LIMITS = { volume: [0.05, 3], speed: [0.2, 3] } as const;

export interface SupportOptionsDraft {
  types: string[];
  defaultType: string;
  /** "" = the preset factor. */
  factors: Record<string, { volume: string; speed: string }>;
  adhesion: string[];
}

export function supportOptionsDraft(config: PrintSupportOptionsConfig | undefined): SupportOptionsDraft {
  const factors: SupportOptionsDraft["factors"] = {};
  for (const t of config?.types ?? []) {
    factors[t.key] = {
      volume: t.volume_factor !== t.default_volume_factor ? String(t.volume_factor) : "",
      speed: t.speed_factor !== t.default_speed_factor ? String(t.speed_factor) : "",
    };
  }
  return {
    types: (config?.types ?? []).filter((t) => t.enabled).map((t) => t.key),
    defaultType: config?.default_type ?? "",
    factors,
    adhesion: (config?.adhesion ?? []).filter((a) => a.enabled).map((a) => a.key),
  };
}

/** The PATCH body for a draft, or an error message. */
export function supportOptionsUpdate(
  draft: SupportOptionsDraft,
  config: PrintSupportOptionsConfig,
): { value?: PrintSupportOptionsUpdate; error?: string } {
  if (config.types.length > 0 && draft.types.length === 0) {
    return { error: "Offer at least one support type (turn off 'Add supports in Auto' to print without them by default)." };
  }
  const factors: NonNullable<PrintSupportOptionsUpdate["factors"]> = {};
  for (const t of config.types) {
    const own = draft.factors[t.key];
    for (const [kind, field, [lo, hi]] of [
      ["volume", "volume_factor", SUPPORT_FACTOR_LIMITS.volume],
      ["speed", "speed_factor", SUPPORT_FACTOR_LIMITS.speed],
    ] as const) {
      const raw = (own?.[kind] ?? "").trim();
      if (!raw) continue;
      const n = Number(raw);
      if (!Number.isFinite(n) || n < lo || n > hi) {
        return { error: `${t.label}: ${kind === "volume" ? "material" : "speed"} factor must be between ${lo} and ${hi}.` };
      }
      factors[t.key] = { ...factors[t.key], [field]: n };
    }
  }
  const defaultType = draft.types.includes(draft.defaultType) ? draft.defaultType : draft.types[0] ?? "";
  return {
    value: {
      types: draft.types,
      default_type: defaultType,
      factors,
      ...(config.adhesion.length ? { adhesion: draft.adhesion } : {}),
    },
  };
}

/** OIC: which support types and bed adhesion options users may pick on this printer, the default type and the
 * material / speed factor of each type. */
export function PrintSupportTypesSettings({
  config,
  draft,
  onChange,
  disabled,
}: {
  config: PrintSupportOptionsConfig;
  draft: SupportOptionsDraft;
  onChange: (draft: SupportOptionsDraft) => void;
  disabled?: boolean;
}) {
  const setFactor = (key: string, kind: "volume" | "speed", value: string) =>
    onChange({
      ...draft,
      factors: { ...draft.factors, [key]: { ...(draft.factors[key] ?? { volume: "", speed: "" }), [kind]: value } },
    });
  const toggleType = (key: string, on: boolean) => {
    const types = config.types.map((t) => t.key).filter((k) => (k === key ? on : draft.types.includes(k)));
    onChange({ ...draft, types, defaultType: types.includes(draft.defaultType) ? draft.defaultType : types[0] ?? "" });
  };
  const toggleAdhesion = (key: string, on: boolean) =>
    onChange({
      ...draft,
      adhesion: config.adhesion.map((a) => a.key).filter((k) => k === "none" || (k === key ? on : draft.adhesion.includes(k))),
    });

  if (config.types.length === 0 && config.adhesion.length === 0) return null;
  return (
    <div className="space-y-3" data-testid="print-estimate-support-types">
      {config.types.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Support types offered</p>
          <p className="text-xs text-muted-foreground">
            Users pick one of the ticked types when booking. Support grams = overhang volume from the model × support
            density × the material factor (1 = straight grid columns), plus interface layers; the speed factor scales the
            support print speed. Leave a factor empty for the preset value.
          </p>
          <RadioGroup
            value={draft.defaultType}
            onValueChange={(v) => onChange({ ...draft, defaultType: v })}
            disabled={disabled}
            aria-label="Default support type"
          >
            <Table stackOnMobile>
              <TableHeader>
                <TableRow>
                  <TableHead>Offer</TableHead>
                  <TableHead className="text-left">Support type</TableHead>
                  <TableHead>Default</TableHead>
                  <TableHead>Material factor</TableHead>
                  <TableHead>Speed factor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {config.types.map((t) => {
                  const on = draft.types.includes(t.key);
                  return (
                    <TableRow key={t.key} data-testid={`support-type-row-${t.key}`}>
                      <TableCell>
                        <Checkbox
                          checked={on}
                          disabled={disabled}
                          onCheckedChange={(v) => toggleType(t.key, v === true)}
                          aria-label={`Offer ${t.label} supports`}
                        />
                      </TableCell>
                      <TableCell className="text-left">
                        <span className="flex items-center gap-2 font-medium">
                          <SupportTypeIcon type={t.key} className="text-muted-foreground" />
                          {t.label}
                        </span>
                        <span className="block text-xs text-muted-foreground">{t.description}</span>
                      </TableCell>
                      <TableCell>
                        <RadioGroupItem value={t.key} disabled={disabled || !on} aria-label={`${t.label} is the default`} />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="0.05"
                          min={SUPPORT_FACTOR_LIMITS.volume[0]}
                          max={SUPPORT_FACTOR_LIMITS.volume[1]}
                          className="mx-auto h-8 w-24"
                          value={draft.factors[t.key]?.volume ?? ""}
                          placeholder={String(t.default_volume_factor)}
                          disabled={disabled}
                          onChange={(e) => setFactor(t.key, "volume", e.target.value)}
                          aria-label={`${t.label} material factor`}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="0.05"
                          min={SUPPORT_FACTOR_LIMITS.speed[0]}
                          max={SUPPORT_FACTOR_LIMITS.speed[1]}
                          className="mx-auto h-8 w-24"
                          value={draft.factors[t.key]?.speed ?? ""}
                          placeholder={String(t.default_speed_factor)}
                          disabled={disabled}
                          onChange={(e) => setFactor(t.key, "speed", e.target.value)}
                          aria-label={`${t.label} speed factor`}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </RadioGroup>
        </div>
      )}
      {config.adhesion.length > 1 && (
        <div className="space-y-2" data-testid="print-estimate-adhesion">
          <p className="text-sm font-medium">Bed adhesion offered</p>
          <p className="text-xs text-muted-foreground">
            Brim and raft are printed in the model material and charged with it; their size follows the brim width and
            raft parameters above.
          </p>
          <div className="flex flex-wrap gap-4">
            {config.adhesion
              .filter((a) => a.key !== "none")
              .map((a) => (
                <label key={a.key} className="flex items-center gap-2 text-sm" title={a.description}>
                  <Checkbox
                    checked={draft.adhesion.includes(a.key)}
                    disabled={disabled}
                    onCheckedChange={(v) => toggleAdhesion(a.key, v === true)}
                    aria-label={`Offer ${a.label}`}
                  />
                  {a.label}
                </label>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
