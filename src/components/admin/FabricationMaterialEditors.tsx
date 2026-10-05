import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Plus, Trash2 } from "lucide-react";

export type UserTypeChoice = { value: string; label: string };

export interface PrintMaterialRow {
  id?: number | null;
  code: string;
  name: string;
  density_g_per_cm3?: string | number;
  price_per_gram: string | number | null;
  source_rate?: string | number | null;
  source_unit?: string | null;
  user_type?: string | null;
  is_active?: boolean;
  display_order?: number;
}

export interface LaserSheetRow {
  id?: number | null;
  code: string;
  name: string;
  material_family: string;
  thickness_mm: string | number;
  sheet_width_mm: string | number;
  sheet_height_mm: string | number;
  sheet_rate: string | number;
  user_type?: string | null;
  is_active?: boolean;
  display_order?: number;
}

export const LASER_FAMILY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "MS", label: "Mild steel (MS)" },
  { value: "SS", label: "Stainless steel (SS)" },
  { value: "ACRYLIC", label: "Acrylic" },
  { value: "MDF", label: "MDF" },
  { value: "OTHER", label: "Other" },
];

export const SOURCE_UNIT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "PER_KG", label: "per kg" },
  { value: "PER_LITRE", label: "per litre" },
  { value: "PER_GRAM", label: "per gram" },
];

/** 8 ft × 4 ft, the usual full sheet. */
export const DEFAULT_SHEET_WIDTH_MM = "2438.4";
export const DEFAULT_SHEET_HEIGHT_MM = "1219.2";

const ALL_USER_TYPES = "__all__";

function isBlank(v: unknown): boolean {
  return v === null || v === undefined || String(v).trim() === "";
}

function positive(v: unknown): boolean {
  const n = Number(v);
  return Number.isFinite(n) && n > 0;
}

function nonNegative(v: unknown): boolean {
  const n = Number(v);
  return !isBlank(v) && Number.isFinite(n) && n >= 0;
}

/** Same conversion as the backend (price_per_gram_from_source). */
export function derivedPricePerGram(
  rate: string | number | null | undefined,
  unit: string | null | undefined,
  density: string | number | null | undefined,
): number | null {
  if (isBlank(rate) || !unit) return null;
  const r = Number(rate);
  if (!Number.isFinite(r) || r < 0) return null;
  if (unit === "PER_GRAM") return r;
  if (unit === "PER_KG") return r / 1000;
  if (unit === "PER_LITRE") {
    const d = Number(density);
    return Number.isFinite(d) && d > 0 ? r / (1000 * d) : null;
  }
  return null;
}

export function printMaterialRowsError(rows: PrintMaterialRow[]): string | null {
  const codes = new Set<string>();
  for (const [i, row] of rows.entries()) {
    const label = row.name?.trim() || row.code?.trim() || `Material ${i + 1}`;
    if (isBlank(row.code) || isBlank(row.name)) return `${label}: enter a code and a name.`;
    const code = row.code.trim();
    if (codes.has(code)) return `Material code "${code}" is used twice.`;
    codes.add(code);
    if (!isBlank(row.density_g_per_cm3) && !positive(row.density_g_per_cm3)) return `${label}: density must be above 0.`;
    const hasSource = !isBlank(row.source_rate) && !!row.source_unit;
    if (hasSource) {
      if (!nonNegative(row.source_rate)) return `${label}: supplier rate must be 0 or more.`;
      if (derivedPricePerGram(row.source_rate, row.source_unit, row.density_g_per_cm3 ?? "1.24") === null) {
        return `${label}: a density above 0 is needed to convert a per-litre rate.`;
      }
    } else if (!nonNegative(row.price_per_gram)) {
      return `${label}: enter a price per gram, or a supplier rate with its unit.`;
    }
  }
  return null;
}

export function laserSheetRowsError(rows: LaserSheetRow[]): string | null {
  const codes = new Set<string>();
  for (const [i, row] of rows.entries()) {
    const label = row.name?.trim() || row.code?.trim() || `Sheet ${i + 1}`;
    if (isBlank(row.code) || isBlank(row.name)) return `${label}: enter a code and a name.`;
    const code = row.code.trim().toUpperCase();
    if (codes.has(code)) return `Sheet code "${row.code.trim()}" is used twice.`;
    codes.add(code);
    if (!positive(row.thickness_mm)) return `${label}: thickness must be above 0 mm.`;
    if (!positive(row.sheet_width_mm) || !positive(row.sheet_height_mm)) return `${label}: sheet width and height must be above 0 mm.`;
    if (!nonNegative(row.sheet_rate)) return `${label}: enter the price of one sheet.`;
  }
  return null;
}

/** API shape: a supplier rate + unit wins; otherwise the typed price per gram is sent. */
export function printRowPayload(row: PrintMaterialRow) {
  const hasSource = !isBlank(row.source_rate) && !!row.source_unit;
  return {
    id: row.id ?? null,
    code: row.code.trim(),
    name: row.name.trim(),
    density_g_per_cm3: isBlank(row.density_g_per_cm3) ? "1.24" : String(row.density_g_per_cm3),
    price_per_gram: hasSource ? null : String(row.price_per_gram),
    source_rate: hasSource ? String(row.source_rate) : null,
    source_unit: hasSource ? String(row.source_unit) : "",
    user_type: row.user_type || null,
    is_active: row.is_active !== false,
    display_order: Number(row.display_order ?? 0) || 0,
  };
}

export function laserRowPayload(row: LaserSheetRow) {
  return {
    id: row.id ?? null,
    code: row.code.trim(),
    name: row.name.trim(),
    material_family: row.material_family || "OTHER",
    thickness_mm: String(row.thickness_mm),
    sheet_width_mm: String(row.sheet_width_mm),
    sheet_height_mm: String(row.sheet_height_mm),
    sheet_rate: String(row.sheet_rate),
    user_type: row.user_type || null,
    is_active: row.is_active !== false,
    display_order: Number(row.display_order ?? 0) || 0,
  };
}

export function newPrintMaterialRow(order: number): PrintMaterialRow {
  return {
    code: "",
    name: "",
    density_g_per_cm3: "1.24",
    price_per_gram: "",
    source_rate: "",
    source_unit: "PER_KG",
    user_type: null,
    is_active: true,
    display_order: order,
  };
}

export function newLaserSheetRow(order: number): LaserSheetRow {
  return {
    code: "",
    name: "",
    material_family: "OTHER",
    thickness_mm: "",
    sheet_width_mm: DEFAULT_SHEET_WIDTH_MM,
    sheet_height_mm: DEFAULT_SHEET_HEIGHT_MM,
    sheet_rate: "",
    user_type: null,
    is_active: true,
    display_order: order,
  };
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1", className)}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function UserTypeSelect({
  value,
  choices,
  onChange,
  disabled,
}: {
  value: string | null | undefined;
  choices: UserTypeChoice[];
  onChange: (v: string | null) => void;
  disabled?: boolean;
}) {
  return (
    <Select value={value ? String(value) : ALL_USER_TYPES} onValueChange={(v) => onChange(v === ALL_USER_TYPES ? null : v)} disabled={disabled}>
      <SelectTrigger aria-label="User type">
        <SelectValue placeholder="All user types" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_USER_TYPES}>All user types</SelectItem>
        {choices
          .filter((ut) => String(ut.value ?? "").trim() !== "")
          .map((ut) => (
            <SelectItem key={ut.value} value={String(ut.value)}>
              {ut.label}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );
}

interface EditorProps<T> {
  rows: T[];
  onChange: (rows: T[]) => void;
  userTypeChoices?: UserTypeChoice[];
  disabled?: boolean;
  /** Called instead of removing the row locally (e.g. to confirm or call an API). */
  onRemove?: (row: T, index: number) => void;
}

export function PrintMaterialsEditor({ rows, onChange, userTypeChoices = [], disabled, onRemove }: EditorProps<PrintMaterialRow>) {
  const update = (idx: number, patch: Partial<PrintMaterialRow>) =>
    onChange(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const remove = (idx: number) => (onRemove ? onRemove(rows[idx], idx) : onChange(rows.filter((_, i) => i !== idx)));
  return (
    <div className="space-y-3" data-testid="print-materials-editor">
      {rows.length === 0 && <p className="text-sm text-muted-foreground">No materials yet.</p>}
      {rows.map((mat, idx) => {
        const derived = derivedPricePerGram(mat.source_rate, mat.source_unit, mat.density_g_per_cm3 ?? "1.24");
        const usesSource = !isBlank(mat.source_rate) && !!mat.source_unit;
        return (
          <div
            key={mat.id ?? `new-${idx}`}
            className={cn("grid gap-3 rounded-md border p-3 sm:grid-cols-2 lg:grid-cols-6", mat.is_active === false && "opacity-70")}
          >
            <Field label="Code">
              <Input value={mat.code} disabled={disabled} onChange={(e) => update(idx, { code: e.target.value })} />
            </Field>
            <Field label="Name" className="lg:col-span-2">
              <Input value={mat.name} disabled={disabled} onChange={(e) => update(idx, { name: e.target.value })} />
            </Field>
            <Field label="Density (g/cm³)">
              <Input
                type="number"
                step="0.001"
                min="0"
                value={String(mat.density_g_per_cm3 ?? "")}
                disabled={disabled}
                onChange={(e) => update(idx, { density_g_per_cm3: e.target.value })}
              />
            </Field>
            <Field label="Supplier rate (₹)">
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g. 1440"
                value={String(mat.source_rate ?? "")}
                disabled={disabled}
                onChange={(e) => update(idx, { source_rate: e.target.value })}
              />
            </Field>
            <Field label="Rate unit">
              <Select
                value={mat.source_unit || "PER_KG"}
                onValueChange={(v) => update(idx, { source_unit: v })}
                disabled={disabled}
              >
                <SelectTrigger aria-label="Supplier rate unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_UNIT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="₹ per gram">
              {usesSource ? (
                <p className="flex h-10 items-center text-sm font-medium" data-testid="derived-price">
                  {derived != null ? `₹${derived.toFixed(4)}` : "—"}
                </p>
              ) : (
                <Input
                  type="number"
                  step="0.0001"
                  min="0"
                  value={String(mat.price_per_gram ?? "")}
                  disabled={disabled}
                  onChange={(e) => update(idx, { price_per_gram: e.target.value })}
                />
              )}
            </Field>
            <Field label="Order">
              <Input
                type="number"
                step="1"
                value={String(mat.display_order ?? 0)}
                disabled={disabled}
                onChange={(e) => update(idx, { display_order: Number.parseInt(e.target.value || "0", 10) || 0 })}
              />
            </Field>
            <Field label="User type" className="lg:col-span-2">
              <UserTypeSelect value={mat.user_type} choices={userTypeChoices} disabled={disabled} onChange={(v) => update(idx, { user_type: v })} />
            </Field>
            <div className="flex items-end justify-between gap-2 lg:col-span-1">
              <label className="flex h-10 items-center gap-2 text-sm">
                <Checkbox
                  checked={mat.is_active !== false}
                  disabled={disabled}
                  onCheckedChange={(c) => update(idx, { is_active: c === true })}
                  aria-label={`Enable ${mat.name || "material"}`}
                />
                Enabled
              </label>
              <Button type="button" variant="ghost" size="icon" disabled={disabled} onClick={() => remove(idx)} aria-label={`Remove ${mat.name || "material"}`}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        );
      })}
      <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => onChange([...rows, newPrintMaterialRow(rows.length)])}>
        <Plus className="mr-1 h-4 w-4" />
        Add material
      </Button>
      <p className="text-xs text-muted-foreground">
        Enter the supplier rate and its unit to have the price per gram worked out (per litre uses the density). Leave the
        supplier rate empty to type the price per gram directly.
      </p>
    </div>
  );
}

export function LaserSheetMaterialsEditor({ rows, onChange, userTypeChoices = [], disabled, onRemove }: EditorProps<LaserSheetRow>) {
  const update = (idx: number, patch: Partial<LaserSheetRow>) =>
    onChange(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const remove = (idx: number) => (onRemove ? onRemove(rows[idx], idx) : onChange(rows.filter((_, i) => i !== idx)));
  return (
    <div className="space-y-3" data-testid="laser-sheets-editor">
      {rows.length === 0 && <p className="text-sm text-muted-foreground">No sheet materials yet.</p>}
      {rows.map((row, idx) => (
        <div
          key={row.id ?? `new-${idx}`}
          className={cn("grid gap-3 rounded-md border p-3 sm:grid-cols-2 lg:grid-cols-6", row.is_active === false && "opacity-70")}
        >
          <Field label="Code">
            <Input value={row.code} disabled={disabled} onChange={(e) => update(idx, { code: e.target.value })} />
          </Field>
          <Field label="Name" className="lg:col-span-2">
            <Input value={row.name} placeholder="e.g. Acrylic sheet 3 mm" disabled={disabled} onChange={(e) => update(idx, { name: e.target.value })} />
          </Field>
          <Field label="Material">
            <Select value={row.material_family || "OTHER"} onValueChange={(v) => update(idx, { material_family: v })} disabled={disabled}>
              <SelectTrigger aria-label="Material family">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LASER_FAMILY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Thickness (mm)">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={String(row.thickness_mm ?? "")}
              disabled={disabled}
              onChange={(e) => update(idx, { thickness_mm: e.target.value })}
            />
          </Field>
          <Field label="₹ per sheet">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={String(row.sheet_rate ?? "")}
              disabled={disabled}
              onChange={(e) => update(idx, { sheet_rate: e.target.value })}
            />
          </Field>
          <Field label="Sheet width (mm)">
            <Input
              type="number"
              step="0.1"
              min="1"
              value={String(row.sheet_width_mm ?? "")}
              disabled={disabled}
              onChange={(e) => update(idx, { sheet_width_mm: e.target.value })}
            />
          </Field>
          <Field label="Sheet height (mm)">
            <Input
              type="number"
              step="0.1"
              min="1"
              value={String(row.sheet_height_mm ?? "")}
              disabled={disabled}
              onChange={(e) => update(idx, { sheet_height_mm: e.target.value })}
            />
          </Field>
          <Field label="Order">
            <Input
              type="number"
              step="1"
              value={String(row.display_order ?? 0)}
              disabled={disabled}
              onChange={(e) => update(idx, { display_order: Number.parseInt(e.target.value || "0", 10) || 0 })}
            />
          </Field>
          <Field label="User type" className="lg:col-span-2">
            <UserTypeSelect value={row.user_type} choices={userTypeChoices} disabled={disabled} onChange={(v) => update(idx, { user_type: v })} />
          </Field>
          <div className="flex items-end justify-between gap-2">
            <label className="flex h-10 items-center gap-2 text-sm">
              <Checkbox
                checked={row.is_active !== false}
                disabled={disabled}
                onCheckedChange={(c) => update(idx, { is_active: c === true })}
                aria-label={`Enable ${row.name || "sheet"}`}
              />
              Enabled
            </label>
            <Button type="button" variant="ghost" size="icon" disabled={disabled} onClick={() => remove(idx)} aria-label={`Remove ${row.name || "sheet"}`}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => onChange([...rows, newLaserSheetRow(rows.length)])}>
        <Plus className="mr-1 h-4 w-4" />
        Add sheet material
      </Button>
      <p className="text-xs text-muted-foreground">
        Parts are charged by the share of the sheet their bounding rectangle uses: part area × number of parts ÷ sheet
        area × price per sheet. A full 8 ft × 4 ft sheet is 2438.4 × 1219.2 mm. Sheets that bookings already use are
        disabled rather than deleted.
      </p>
    </div>
  );
}

/** Split a comma / semicolon / newline separated list into trimmed, de-duplicated addresses. */
export function parseEmailList(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of text.split(/[\n,;]+/)) {
    const email = part.trim();
    if (!email || seen.has(email.toLowerCase())) continue;
    seen.add(email.toLowerCase());
    out.push(email);
  }
  return out;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function emailListError(emails: string[], max = 10): string | null {
  const bad = emails.find((e) => !EMAIL_RE.test(e));
  if (bad) return `"${bad}" is not a valid email address.`;
  if (emails.length > max) return `Add at most ${max} notification emails.`;
  return null;
}

export function ownChargeError(value: string): string | null {
  if (value.trim() === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return "The own-material charge must be a number of 0 or more, or empty.";
  return null;
}

export const DEFAULT_REPLACE_WINDOW_HOURS = 24;
export const MIN_REPLACE_WINDOW_HOURS = 1;
export const MAX_REPLACE_WINDOW_HOURS = 168;

export function replaceWindowHoursError(value: string): string | null {
  const n = Number(value.trim());
  if (value.trim() === "" || !Number.isInteger(n) || n < MIN_REPLACE_WINDOW_HOURS || n > MAX_REPLACE_WINDOW_HOURS) {
    return `The time to replace files must be a whole number of hours from ${MIN_REPLACE_WINDOW_HOURS} to ${MAX_REPLACE_WINDOW_HOURS}.`;
  }
  return null;
}
