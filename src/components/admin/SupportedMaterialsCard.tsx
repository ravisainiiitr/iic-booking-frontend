import { useEffect, useMemo, useState } from "react";
import type { MasterLaserSheetMaterial, MasterPrintMaterial } from "@/lib/api";
import { getUserTypeDisplayName } from "@/lib/userTypes";
import { NO_FABRICATION_MATERIALS_MESSAGE } from "@/lib/fabricationProfiles";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ListChecks, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type MasterMaterial = MasterPrintMaterial | MasterLaserSheetMaterial;

const SEARCH_THRESHOLD = 12;

function isLaser(m: MasterMaterial): m is MasterLaserSheetMaterial {
  return "sheet_rate" in m;
}

function priceLabel(m: MasterMaterial): string {
  if (isLaser(m)) return `${Number(m.thickness_mm)} mm · ₹${Number(m.sheet_rate).toFixed(2)}/sheet`;
  return `₹${Number(m.price_per_gram)}/g`;
}

/** Two chosen materials may not share a code: bookings store the code. */
export function duplicateCodeError(chosen: MasterMaterial[]): string | null {
  const seen = new Map<string, MasterMaterial>();
  for (const m of chosen) {
    const key = m.code.trim().toLowerCase();
    const prev = seen.get(key);
    if (prev) return `“${prev.name}” and “${m.name}” share the code “${m.code}”. Choose only one of them.`;
    seen.set(key, m);
  }
  return null;
}

/** Warning for the OIC when users would see no material, or some supported ones are hidden. */
export function supportedMaterialsWarning(chosen: MasterMaterial[]): string | null {
  const enabled = chosen.filter((m) => m.is_active).length;
  if (chosen.length === 0) {
    return `No materials are supported. Users will see “${NO_FABRICATION_MATERIALS_MESSAGE}” and cannot book this equipment.`;
  }
  if (enabled === 0) {
    return `All supported materials are disabled in the master list. Users will see “${NO_FABRICATION_MATERIALS_MESSAGE}” until one is enabled.`;
  }
  const hidden = chosen.length - enabled;
  if (hidden > 0) {
    return `${hidden} supported material${hidden === 1 ? " is" : "s are"} disabled and hidden from users until re-enabled.`;
  }
  return null;
}

type Props = {
  kind: "print" | "laser";
  equipmentId: number;
  equipmentLabel: string;
  master: MasterMaterial[];
  savedIds: number[];
  disabled?: boolean;
  onSave: (ids: number[]) => Promise<boolean>;
};

export function SupportedMaterialsCard({ kind, equipmentId, equipmentLabel, master, savedIds, disabled, onSave }: Props) {
  const savedKey = [...savedIds].sort((a, b) => a - b).join(",");
  const [draft, setDraft] = useState<Set<number>>(() => new Set(savedIds));
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(new Set(savedKey ? savedKey.split(",").map(Number) : []));
  }, [equipmentId, savedKey]);

  const chosen = useMemo(() => master.filter((m) => draft.has(m.id)), [master, draft]);
  const dirty = [...draft].sort((a, b) => a - b).join(",") !== savedKey;
  const clash = duplicateCodeError(chosen);
  const warning = supportedMaterialsWarning(chosen);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const own = (m: MasterMaterial) => (m.home_equipment_id === equipmentId ? 0 : 1);
    const ordered = [...master].sort((a, b) => own(a) - own(b));
    if (!q) return ordered;
    return ordered.filter((m) =>
      [m.name, m.code, m.home_equipment_code, m.home_equipment_name].some((v) => (v || "").toLowerCase().includes(q))
    );
  }, [master, query, equipmentId]);

  const toggle = (id: number, on: boolean) =>
    setDraft((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const save = async () => {
    setSaving(true);
    const ok = await onSave([...draft]);
    setSaving(false);
    if (!ok) setDraft(new Set(savedKey ? savedKey.split(",").map(Number) : []));
  };

  const category = kind === "print" ? "3D print materials" : "laser sheet materials";
  const enabledCount = chosen.filter((m) => m.is_active).length;

  return (
    <Card data-testid="supported-materials">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <ListChecks className="h-5 w-5" /> Supported materials
        </CardTitle>
        <CardDescription>
          Tick the {category} from the master list that {equipmentLabel} offers. Users can pick a material only when
          it is supported here and enabled. Disabling a material hides it everywhere but keeps it supported, so it
          comes back when it is re-enabled. Prices come from the master list.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {warning && (
          <div
            role="alert"
            data-testid="supported-materials-warning"
            className="flex items-start gap-2 rounded-lg border border-warning-border bg-warning-subtle p-3 text-sm text-warning-subtle-foreground"
          >
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{warning}</span>
          </div>
        )}
        {master.length > SEARCH_THRESHOLD && (
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, code or equipment"
            aria-label="Search the master list"
            className="max-w-sm"
          />
        )}
        {master.length === 0 ? (
          <p className="text-sm text-muted-foreground">The master list has no {category} yet. Add one below.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {visible.map((m) => {
              const checked = draft.has(m.id);
              const fromOther = m.home_equipment_id !== equipmentId;
              const inputId = `supported-${kind}-${m.id}`;
              return (
                <li
                  key={m.id}
                  className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 p-3", !m.is_active && "bg-muted/30")}
                >
                  <Checkbox
                    id={inputId}
                    checked={checked}
                    disabled={disabled || saving}
                    onCheckedChange={(v) => toggle(m.id, v === true)}
                  />
                  <label htmlFor={inputId} className="min-w-0 flex-1 cursor-pointer">
                    <span className={cn("font-medium", !m.is_active && "text-muted-foreground")}>{m.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{m.code}</span>
                    {fromOther && (
                      <span className="block text-xs text-muted-foreground">
                        Added for {m.home_equipment_name || m.home_equipment_code}
                        {m.can_edit ? "" : " (its OIC sets the price)"}
                      </span>
                    )}
                  </label>
                  <span className="text-sm tabular-nums text-muted-foreground">{priceLabel(m)}</span>
                  {m.user_type && (
                    <Badge variant="outline" className="text-[10px]">
                      {getUserTypeDisplayName(m.user_type)} only
                    </Badge>
                  )}
                  {m.is_active ? (
                    <Badge className="text-[10px] border-success-border bg-success-subtle text-success-subtle-foreground hover:bg-success-subtle">
                      Enabled
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px]">
                      Disabled
                    </Badge>
                  )}
                </li>
              );
            })}
            {visible.length === 0 && <li className="p-3 text-sm text-muted-foreground">No materials match.</li>}
          </ul>
        )}
        {clash && <p className="text-sm text-destructive">{clash}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={() => void save()}
            disabled={disabled || saving || !dirty || !!clash}
            data-testid="save-supported-materials"
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save supported materials
          </Button>
          <span className="text-xs text-muted-foreground">
            {chosen.length} supported · {enabledCount} visible to users
            {dirty ? " · unsaved changes" : ""}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
