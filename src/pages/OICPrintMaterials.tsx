import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardHeader from "@/components/DashboardHeader";
import { StandaloneOnly } from "@/components/PageShell";
import {
  apiClient,
  type FabricationEquipmentRow,
  type LaserSheetMaterial,
  type MasterLaserSheetMaterial,
  type MasterPrintMaterial,
  type PrintMaterial,
} from "@/lib/api";
import { SupportedMaterialsCard } from "@/components/admin/SupportedMaterialsCard";
import { getUserTypeDisplayName, USER_TYPE_DISPLAY_NAMES } from "@/lib/userTypes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Loader2, Plus, Printer, Ruler, Scissors, Settings2, Table2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  LaserSheetMaterialsEditor,
  PrintMaterialsEditor,
  DEFAULT_REPLACE_WINDOW_HOURS,
  MAX_REPLACE_WINDOW_HOURS,
  MIN_REPLACE_WINDOW_HOURS,
  derivedPricePerGram,
  emailListError,
  laserRowPayload,
  laserSheetRowsError,
  newLaserSheetRow,
  newPrintMaterialRow,
  ownChargeError,
  parseEmailList,
  printMaterialRowsError,
  printRowPayload,
  replaceWindowHoursError,
  type LaserSheetRow,
  type PrintMaterialRow,
  type UserTypeChoice,
} from "@/components/admin/FabricationMaterialEditors";

type ChargeProfileRow = {
  user_type: string;
  user_type_display: string;
  primary_unit_charge: string;
  is_active: boolean;
};

type FabricationTab = "print" | "laser";

const TAB_PROFILE: Record<FabricationTab, string> = { print: "PRINT_3D", laser: "LASER_CUT_2D" };

const USER_TYPE_CHOICES: UserTypeChoice[] = Object.entries(USER_TYPE_DISPLAY_NAMES)
  .filter(([code]) =>
    ["student", "faculty", "individual_student", "external", "rnd", "industry", "other", "startup_incubated_iitr", "external_startup_msme"].includes(code)
  )
  .map(([value, label]) => ({ value, label }));

function printRowFromMaterial(m: PrintMaterial): PrintMaterialRow {
  return {
    id: m.id,
    code: m.code ?? "",
    name: m.name ?? "",
    density_g_per_cm3: String(m.density_g_per_cm3 ?? "1.24"),
    price_per_gram: String(m.price_per_gram ?? ""),
    source_rate: m.source_rate == null ? "" : String(m.source_rate),
    source_unit: m.source_rate == null ? "PER_KG" : m.source_unit || "PER_KG",
    user_type: m.user_type ?? null,
    is_active: m.is_active !== false,
    display_order: Number(m.display_order ?? 0),
  };
}

function laserRowFromMaterial(m: LaserSheetMaterial): LaserSheetRow {
  return {
    id: m.id,
    code: m.code ?? "",
    name: m.name ?? "",
    material_family: m.material_family ?? "OTHER",
    thickness_mm: String(m.thickness_mm ?? ""),
    sheet_width_mm: String(m.sheet_width_mm ?? ""),
    sheet_height_mm: String(m.sheet_height_mm ?? ""),
    sheet_rate: String(m.sheet_rate ?? ""),
    user_type: m.user_type ?? null,
    is_active: m.is_active !== false,
    display_order: Number(m.display_order ?? 0),
  };
}

function formatMoney(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n.toFixed(2);
}

function effectivePricePerGram(row: PrintMaterialRow): number | null {
  const derived = derivedPricePerGram(row.source_rate, row.source_unit, row.density_g_per_cm3 ?? "1.24");
  if (derived !== null) return derived;
  const n = Number(row.price_per_gram);
  return row.price_per_gram === "" || row.price_per_gram == null || !Number.isFinite(n) ? null : n;
}

/** Effective ₹/g for a category, matching booking material resolution (typed row first, then the shared row). */
function resolveMaterialPriceForCategory(rows: PrintMaterialRow[], code: string, userType: string): number | null {
  const wanted = code.trim().toLowerCase();
  const ut = userType.trim().toLowerCase();
  const candidates = rows.filter((r) => r.is_active !== false && r.code.trim().toLowerCase() === wanted);
  const typed = candidates.find((r) => (r.user_type || "").trim().toLowerCase() === ut);
  if (typed) return effectivePricePerGram(typed);
  const shared = candidates.find((r) => !(r.user_type || "").trim());
  return shared ? effectivePricePerGram(shared) : null;
}

function rowKey(payload: { id: number | null }): string {
  return payload.id == null ? "" : String(payload.id);
}

const PRINT_SIZE_AXES = ["x", "y", "z"] as const;
type PrintSizeAxis = (typeof PRINT_SIZE_AXES)[number];
type PrintSizeDraft = Record<PrintSizeAxis, string>;
const PRINT_SIZE_LABEL: Record<PrintSizeAxis, string> = { x: "X (width)", y: "Y (depth)", z: "Z (height)" };
const MAX_PRINT_SIZE_LIMIT_MM = 10000;

function sizeText(value: string | null | undefined): string {
  if (value == null || value === "") return "";
  const n = Number(value);
  return Number.isFinite(n) ? String(n) : String(value);
}

function printSizeDraftOf(row: FabricationEquipmentRow | null): PrintSizeDraft {
  return {
    x: sizeText(row?.max_print_size_x_mm),
    y: sizeText(row?.max_print_size_y_mm),
    z: sizeText(row?.max_print_size_z_mm),
  };
}

/** Blank means no limit on that axis. */
function maxPrintSizeError(draft: PrintSizeDraft): string | null {
  for (const axis of PRINT_SIZE_AXES) {
    const text = draft[axis].trim();
    if (!text) continue;
    const n = Number(text);
    if (!Number.isFinite(n) || n <= 0) return `Maximum print size ${axis.toUpperCase()} must be a number above 0 mm, or empty for no limit.`;
    if (n > MAX_PRINT_SIZE_LIMIT_MM) return `Maximum print size ${axis.toUpperCase()} must be at most ${MAX_PRINT_SIZE_LIMIT_MM} mm.`;
  }
  return null;
}

export default function OICPrintMaterials() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [equipments, setEquipments] = useState<FabricationEquipmentRow[]>([]);
  const [masterPrint, setMasterPrint] = useState<MasterPrintMaterial[]>([]);
  const [masterLaser, setMasterLaser] = useState<MasterLaserSheetMaterial[]>([]);
  const [chargeProfiles, setChargeProfiles] = useState<Record<number, ChargeProfileRow[]>>({});
  const [tab, setTab] = useState<FabricationTab>("print");
  const [selectedIds, setSelectedIds] = useState<Record<FabricationTab, string>>({ print: "", laser: "" });
  const [loadVersion, setLoadVersion] = useState(0);

  const [printRows, setPrintRows] = useState<PrintMaterialRow[]>([]);
  const [laserRows, setLaserRows] = useState<LaserSheetRow[]>([]);
  const [emailsText, setEmailsText] = useState("");
  const [ownCharge, setOwnCharge] = useState("");
  const [replaceHours, setReplaceHours] = useState(String(DEFAULT_REPLACE_WINDOW_HOURS));
  const [printSize, setPrintSize] = useState<PrintSizeDraft>({ x: "", y: "", z: "" });
  const [allowRotation, setAllowRotation] = useState(true);
  const [busy, setBusy] = useState<null | "materials" | "settings" | "delete">(null);

  const byTab = useMemo(
    () => ({
      print: equipments.filter((e) => e.profile_type === TAB_PROFILE.print),
      laser: equipments.filter((e) => e.profile_type === TAB_PROFILE.laser),
    }),
    [equipments]
  );
  const selected = useMemo(
    () => byTab[tab].find((e) => String(e.equipment_id) === selectedIds[tab]) ?? null,
    [byTab, tab, selectedIds]
  );

  const load = useCallback(async () => {
    setLoading(true);
    const [res, printRes] = await Promise.all([
      apiClient.getFabricationMaterialEquipment(),
      apiClient.getOicPrintMaterials(),
    ]);
    setLoading(false);
    if (res.error) {
      toast.error(res.error);
      navigate("/dashboard");
      return;
    }
    const list = res.data?.equipments ?? [];
    setEquipments(list);
    setMasterPrint(res.data?.master_print_materials ?? []);
    setMasterLaser(res.data?.master_laser_sheet_materials ?? []);
    const profiles: Record<number, ChargeProfileRow[]> = {};
    for (const eq of printRes.data?.equipments ?? []) profiles[eq.equipment_id] = eq.charge_profiles ?? [];
    setChargeProfiles(profiles);
    setSelectedIds((prev) => {
      const pick = (t: FabricationTab) => {
        const rows = list.filter((e) => e.profile_type === TAB_PROFILE[t]);
        return rows.some((e) => String(e.equipment_id) === prev[t]) ? prev[t] : rows[0] ? String(rows[0].equipment_id) : "";
      };
      return { print: pick("print"), laser: pick("laser") };
    });
    setTab((prev) => {
      const hasPrint = list.some((e) => e.profile_type === TAB_PROFILE.print);
      const hasLaser = list.some((e) => e.profile_type === TAB_PROFILE.laser);
      if (prev === "print" && !hasPrint && hasLaser) return "laser";
      if (prev === "laser" && !hasLaser && hasPrint) return "print";
      return prev;
    });
    setLoadVersion((v) => v + 1);
  }, [navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  const originalPrint = useMemo(() => (selected?.print_materials ?? []).map(printRowFromMaterial), [selected]);
  const originalLaser = useMemo(() => (selected?.laser_sheet_materials ?? []).map(laserRowFromMaterial), [selected]);

  // Reset drafts only when the equipment changes or fresh data is loaded, so local deletes keep other edits.
  useEffect(() => {
    setPrintRows(originalPrint);
    setLaserRows(originalLaser);
    const emails = selected?.fabrication_notification_emails ?? [];
    setEmailsText(emails.join("\n"));
    setOwnCharge(selected?.own_material_fixed_charge ?? "");
    setReplaceHours(String(selected?.fabrication_replace_window_hours ?? DEFAULT_REPLACE_WINDOW_HOURS));
    setPrintSize(printSizeDraftOf(selected));
    setAllowRotation(selected?.allow_print_rotation_to_fit !== false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.equipment_id, loadVersion]);

  const printPayloads = useMemo(() => printRows.map(printRowPayload), [printRows]);
  const laserPayloads = useMemo(() => laserRows.map(laserRowPayload), [laserRows]);
  const originalPrintByKey = useMemo(
    () => new Map(originalPrint.map((r) => { const p = printRowPayload(r); return [rowKey(p), JSON.stringify(p)]; })),
    [originalPrint]
  );
  const originalLaserByKey = useMemo(
    () => new Map(originalLaser.map((r) => { const p = laserRowPayload(r); return [rowKey(p), JSON.stringify(p)]; })),
    [originalLaser]
  );
  const materialsDirty =
    tab === "print"
      ? printPayloads.some((p) => p.id == null || originalPrintByKey.get(rowKey(p)) !== JSON.stringify(p))
      : laserPayloads.some((p) => p.id == null || originalLaserByKey.get(rowKey(p)) !== JSON.stringify(p));

  const savedEmails = (selected?.fabrication_notification_emails ?? []).join("\n");
  const savedReplaceHours = String(selected?.fabrication_replace_window_hours ?? DEFAULT_REPLACE_WINDOW_HOURS);
  const isPrinter = selected?.profile_type === TAB_PROFILE.print;
  const savedPrintSize = printSizeDraftOf(selected);
  const printSizeDirty =
    isPrinter &&
    (PRINT_SIZE_AXES.some((a) => printSize[a].trim() !== savedPrintSize[a]) ||
      allowRotation !== (selected?.allow_print_rotation_to_fit !== false));
  const settingsDirty =
    !!selected &&
    (parseEmailList(emailsText).join("\n") !== savedEmails ||
      ownCharge.trim() !== (selected.own_material_fixed_charge ?? "") ||
      replaceHours.trim() !== savedReplaceHours ||
      printSizeDirty);

  const onSaveSettings = async () => {
    if (!selected) return;
    const emails = parseEmailList(emailsText);
    const error =
      emailListError(emails) ||
      ownChargeError(ownCharge) ||
      replaceWindowHoursError(replaceHours) ||
      (isPrinter ? maxPrintSizeError(printSize) : null);
    if (error) {
      toast.error(error);
      return;
    }
    setBusy("settings");
    const res = await apiClient.updateFabricationMaterialEquipment({
      equipment_id: selected.equipment_id,
      fabrication_notification_emails: emails,
      own_material_fixed_charge: ownCharge.trim() === "" ? null : ownCharge.trim(),
      fabrication_replace_window_hours: Number(replaceHours.trim()),
      ...(isPrinter
        ? {
            max_print_size_x_mm: printSize.x.trim() || null,
            max_print_size_y_mm: printSize.y.trim() || null,
            max_print_size_z_mm: printSize.z.trim() || null,
            allow_print_rotation_to_fit: allowRotation,
          }
        : {}),
    });
    setBusy(null);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    const updated = res.data?.equipment;
    if (updated) {
      setEquipments((prev) =>
        prev.map((e) => (e.equipment_id === updated.equipment_id ? { ...e, ...updated, print_materials: e.print_materials, laser_sheet_materials: e.laser_sheet_materials } : e))
      );
      setEmailsText(updated.fabrication_notification_emails.join("\n"));
      setOwnCharge(updated.own_material_fixed_charge ?? "");
      setReplaceHours(String(updated.fabrication_replace_window_hours ?? DEFAULT_REPLACE_WINDOW_HOURS));
      setPrintSize(printSizeDraftOf(updated));
      setAllowRotation(updated.allow_print_rotation_to_fit !== false);
    }
    toast.success("Settings saved.");
  };

  const onSaveSupported = async (ids: number[]): Promise<boolean> => {
    if (!selected) return false;
    const res = await apiClient.updateFabricationMaterialEquipment({
      equipment_id: selected.equipment_id,
      supported_material_ids: ids,
    });
    const updated = res.data?.equipment;
    if (res.error || !updated) {
      toast.error(res.error || "Could not save the supported materials.");
      return false;
    }
    setEquipments((prev) =>
      prev.map((e) =>
        e.equipment_id === updated.equipment_id ? { ...e, supported_material_ids: updated.supported_material_ids ?? [] } : e
      )
    );
    toast.success("Supported materials saved.");
    return true;
  };

  const onSaveMaterials = async () => {
    if (!selected) return;
    const error = tab === "print" ? printMaterialRowsError(printRows) : laserSheetRowsError(laserRows);
    if (error) {
      toast.error(error);
      return;
    }
    setBusy("materials");
    let failed: string | null = null;
    let saved = 0;
    if (tab === "print") {
      for (const p of printPayloads) {
        const { id, ...body } = p;
        if (id != null && originalPrintByKey.get(rowKey(p)) === JSON.stringify(p)) continue;
        const res =
          id == null
            ? await apiClient.createOicPrintMaterial({ ...body, equipment_id: selected.equipment_id })
            : await apiClient.updateOicPrintMaterial(id, body);
        if (res.error) {
          failed = `${p.name || p.code}: ${res.error}`;
          break;
        }
        saved += 1;
      }
    } else {
      for (const p of laserPayloads) {
        const { id, ...body } = p;
        if (id != null && originalLaserByKey.get(rowKey(p)) === JSON.stringify(p)) continue;
        const res =
          id == null
            ? await apiClient.createOicLaserSheetMaterial({ ...body, equipment_id: selected.equipment_id })
            : await apiClient.updateOicLaserSheetMaterial(id, body);
        if (res.error) {
          failed = `${p.name || p.code}: ${res.error}`;
          break;
        }
        saved += 1;
      }
    }
    setBusy(null);
    if (failed) {
      toast.error(saved > 0 ? `${failed} (${saved} earlier change(s) were saved.)` : failed);
    } else {
      toast.success(saved === 1 ? "1 material saved." : `${saved} materials saved.`);
    }
    await load();
  };

  const removeRow = async <T extends { id?: number | null; name: string; code: string }>(
    row: T,
    index: number,
    setRows: React.Dispatch<React.SetStateAction<T[]>>,
    remove: (id: number) => Promise<{ error?: string }>
  ) => {
    if (row.id == null) {
      setRows((prev) => prev.filter((_, i) => i !== index));
      return;
    }
    const label = row.name || row.code || "this material";
    if (!window.confirm(`Delete "${label}"? This cannot be undone. Materials already used by bookings can only be disabled.`)) return;
    setBusy("delete");
    const res = await remove(row.id);
    setBusy(null);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    const profile = TAB_PROFILE[tab];
    if (tab === "print") setMasterPrint((prev) => prev.filter((m) => m.id !== row.id));
    else setMasterLaser((prev) => prev.filter((m) => m.id !== row.id));
    setEquipments((prev) =>
      prev.map((e) => {
        if (e.profile_type !== profile) return e;
        const next = { ...e, supported_material_ids: e.supported_material_ids?.filter((id) => id !== row.id) };
        if (e.equipment_id !== selected?.equipment_id) return next;
        return {
          ...next,
          print_materials: e.print_materials?.filter((m) => m.id !== row.id),
          laser_sheet_materials: e.laser_sheet_materials?.filter((m) => m.id !== row.id),
        };
      })
    );
    toast.success("Material deleted.");
  };

  /** Supported print materials, using this page's unsaved edits for the ones added for this equipment. */
  const supportedPrintRows = useMemo(() => {
    const supported = new Set(selected?.supported_material_ids ?? []);
    const own = printRows.filter((r) => r.id != null && supported.has(r.id));
    const ownIds = new Set(own.map((r) => r.id));
    const others = masterPrint.filter((m) => supported.has(m.id) && !ownIds.has(m.id)).map(printRowFromMaterial);
    return [...own, ...others];
  }, [selected?.supported_material_ids, printRows, masterPrint]);
  const priceColumns = useMemo(() => {
    const byCode = new Map<string, { code: string; name: string }>();
    for (const r of supportedPrintRows) {
      const code = r.code.trim();
      if (r.is_active === false || !code) continue;
      if (!byCode.has(code.toLowerCase())) byCode.set(code.toLowerCase(), { code, name: r.name.trim() || code });
    }
    return Array.from(byCode.values());
  }, [supportedPrintRows]);
  const selectedProfiles = useMemo(
    () =>
      [...(selected ? chargeProfiles[selected.equipment_id] ?? [] : [])].sort((a, b) =>
        String(a.user_type_display || a.user_type).localeCompare(String(b.user_type_display || b.user_type))
      ),
    [chargeProfiles, selected]
  );

  const disabled = busy !== null;
  const tabInfo: Record<FabricationTab, { label: string; icon: typeof Printer; empty: string }> = {
    print: { label: "3D print materials", icon: Printer, empty: "No 3D printers in your managed equipment." },
    laser: { label: "Laser sheets", icon: Scissors, empty: "No laser cutters in your managed equipment." },
  };

  const renderTab = (t: FabricationTab) => {
    const list = byTab[t];
    if (list.length === 0) return <p className="text-sm text-muted-foreground">{tabInfo[t].empty}</p>;
    return (
      <div className="space-y-6">
        <div className="space-y-2 max-w-md">
          <Label htmlFor={`fabrication-equipment-${t}`}>Equipment</Label>
          <Select
            value={selectedIds[t]}
            onValueChange={(v) => setSelectedIds((prev) => ({ ...prev, [t]: v }))}
            disabled={disabled}
          >
            <SelectTrigger id={`fabrication-equipment-${t}`} aria-label="Equipment">
              <SelectValue placeholder="Select equipment" />
            </SelectTrigger>
            <SelectContent>
              {list.map((eq) => (
                <SelectItem key={eq.equipment_id} value={String(eq.equipment_id)}>
                  {eq.equipment_name || eq.equipment_code}
                  {eq.internal_department_name ? ` · ${eq.internal_department_name}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selected && t === tab && (
          <>
            <Card data-testid="fabrication-lab-settings">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Settings2 className="h-5 w-5" /> Lab settings
                </CardTitle>
                <CardDescription>
                  Who receives uploaded files, the bring-your-own-material charge, how long users have to replace
                  rejected files{t === "print" ? ", and the largest model the printer can make" : ""}.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="fabrication-emails">Notification emails</Label>
                    <Textarea
                      id="fabrication-emails"
                      rows={3}
                      value={emailsText}
                      disabled={disabled}
                      onChange={(e) => setEmailsText(e.target.value)}
                      placeholder={"lab@example.com\noperator@example.com"}
                    />
                    <p className="text-xs text-muted-foreground">
                      One per line, up to 10. They get the {t === "laser" ? "DXF" : "STL"} files and booking details
                      when a booking is confirmed or its files are replaced.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fabrication-own-charge">Own material fixed charge (₹)</Label>
                    <Input
                      id="fabrication-own-charge"
                      type="number"
                      min="0"
                      step="1"
                      value={ownCharge}
                      disabled={disabled}
                      onChange={(e) => setOwnCharge(e.target.value)}
                      placeholder="Leave empty to hide the option"
                    />
                    <p className="text-xs text-muted-foreground">
                      Charged once instead of the material cost when the user brings their own material.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fabrication-replace-hours">Time to replace files after rejection (hours)</Label>
                    <Input
                      id="fabrication-replace-hours"
                      type="number"
                      min={MIN_REPLACE_WINDOW_HOURS}
                      max={MAX_REPLACE_WINDOW_HOURS}
                      step="1"
                      value={replaceHours}
                      disabled={disabled}
                      onChange={(e) => setReplaceHours(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      When the lab rejects a booking as not feasible, the user has this long to upload new files
                      ({MIN_REPLACE_WINDOW_HOURS}–{MAX_REPLACE_WINDOW_HOURS} hours). After that the booking is cancelled
                      and fully refunded.
                    </p>
                  </div>
                </div>
                {t === "print" && (
                  <fieldset className="space-y-3 rounded-lg border p-4" data-testid="max-print-size">
                    <legend className="flex items-center gap-2 px-1 text-sm font-medium">
                      <Ruler className="h-4 w-4" aria-hidden /> Maximum print size / bed size (mm)
                    </legend>
                    <p className="text-xs text-muted-foreground">
                      The largest model this printer can make (its usable bed / build volume). Users see it when they
                      upload, and STL files larger than this cannot be uploaded or booked. Leave an axis empty for no
                      limit on it. STL sizes are read in millimetres; 0.5 mm over is still accepted.
                    </p>
                    {PRINT_SIZE_AXES.every((a) => !savedPrintSize[a]) && (
                      <p
                        role="alert"
                        data-testid="max-print-size-missing"
                        className="rounded-md border border-warning-border bg-warning-subtle p-2 text-xs text-warning-subtle-foreground"
                      >
                        No maximum print size is set, so models of any size can be booked on this printer. Enter the
                        printer&apos;s bed size to refuse models that do not fit.
                      </p>
                    )}
                    <div className="grid gap-3 sm:grid-cols-3">
                      {PRINT_SIZE_AXES.map((axis) => (
                        <div key={axis} className="space-y-1">
                          <Label htmlFor={`max-print-size-${axis}`}>{PRINT_SIZE_LABEL[axis]}</Label>
                          <Input
                            id={`max-print-size-${axis}`}
                            type="number"
                            inputMode="decimal"
                            min="0.1"
                            max={MAX_PRINT_SIZE_LIMIT_MM}
                            step="0.1"
                            value={printSize[axis]}
                            disabled={disabled}
                            placeholder="No limit"
                            onChange={(e) => setPrintSize((prev) => ({ ...prev, [axis]: e.target.value }))}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex items-start gap-3">
                      <Switch
                        id="allow-print-rotation"
                        checked={allowRotation}
                        disabled={disabled}
                        onCheckedChange={setAllowRotation}
                      />
                      <div className="space-y-1">
                        <Label htmlFor="allow-print-rotation">Allow rotation to fit</Label>
                        <p className="text-xs text-muted-foreground">
                          On (recommended): a model is accepted if it fits after turning it on its side, e.g. a
                          60 × 250 × 40 mm part on a 250 × 210 × 200 mm printer, because the lab can re-orient it on the
                          plate. Turn off if parts must be printed exactly as oriented in the file.
                        </p>
                      </div>
                    </div>
                  </fieldset>
                )}
                <Button type="button" onClick={() => void onSaveSettings()} disabled={disabled || !settingsDirty}>
                  {busy === "settings" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save settings
                </Button>
              </CardContent>
            </Card>

            <SupportedMaterialsCard
              kind={t}
              equipmentId={selected.equipment_id}
              equipmentLabel={selected.equipment_name || selected.equipment_code}
              master={t === "print" ? masterPrint : masterLaser}
              savedIds={selected.supported_material_ids ?? []}
              disabled={disabled}
              onSave={onSaveSupported}
            />

            {t === "print" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Table2 className="h-5 w-5" /> Charges by category &amp; material
                  </CardTitle>
                  <CardDescription>
                    Booking charge ≈ (print weight in g × ₹/g) + (print hours × machine ₹/h), per part × quantity.
                    Shows the enabled supported materials and updates live as you edit below.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/40 border-b">
                          <th className="p-3 text-left font-semibold whitespace-nowrap">User category</th>
                          <th className="p-3 text-right font-semibold whitespace-nowrap">Machine ₹/h</th>
                          {priceColumns.map((col) => (
                            <th key={col.code} className="p-3 text-right font-semibold whitespace-nowrap">
                              <div className="leading-tight">
                                <div>{col.name}</div>
                                <div className="text-[11px] font-normal text-muted-foreground">{col.code} · ₹/g</div>
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {selectedProfiles.length === 0 ? (
                          <tr>
                            <td colSpan={2 + priceColumns.length} className="p-4 text-muted-foreground">
                              No charge profiles configured for this equipment.
                            </td>
                          </tr>
                        ) : (
                          selectedProfiles.map((cp) => (
                            <tr key={cp.user_type} className={cn("border-b last:border-0", !cp.is_active && "opacity-50 bg-muted/20")}>
                              <td className="p-3">
                                <span className="font-medium">{cp.user_type_display || getUserTypeDisplayName(cp.user_type)}</span>
                                {!cp.is_active && (
                                  <Badge variant="secondary" className="ml-2 text-[10px]">Inactive profile</Badge>
                                )}
                              </td>
                              <td className="p-3 text-right tabular-nums font-medium">₹{formatMoney(cp.primary_unit_charge)}</td>
                              {priceColumns.map((col) => {
                                const price = resolveMaterialPriceForCategory(supportedPrintRows, col.code, String(cp.user_type || ""));
                                return (
                                  <td key={`${cp.user_type}-${col.code}`} className="p-3 text-right tabular-nums">
                                    {price != null ? `₹${formatMoney(price)}` : <span className="text-muted-foreground">—</span>}
                                  </td>
                                );
                              })}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                <div className="space-y-1.5">
                  <CardTitle className="text-lg">Materials added for this equipment</CardTitle>
                  <CardDescription>
                    These are your entries in the master list. Their prices apply on every equipment that supports
                    them, and a new material is supported here automatically.{" "}
                    {t === "print"
                      ? "Enter the supplier rate (per kg / litre / gram) or a direct price per gram."
                      : "Charge per part = (part area × quantity ÷ sheet area) × sheet rate."}{" "}
                    Disable a material to hide it from new bookings everywhere without affecting existing ones.
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={disabled}
                  onClick={() =>
                    t === "print"
                      ? setPrintRows((prev) => [...prev, newPrintMaterialRow(prev.length)])
                      : setLaserRows((prev) => [...prev, newLaserSheetRow(prev.length)])
                  }
                >
                  <Plus className="mr-1 h-4 w-4" /> {t === "print" ? "Add material" : "Add sheet"}
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {t === "print" ? (
                  <PrintMaterialsEditor
                    rows={printRows}
                    onChange={setPrintRows}
                    userTypeChoices={USER_TYPE_CHOICES}
                    disabled={disabled}
                    onRemove={(row, idx) =>
                      void removeRow(row, idx, setPrintRows, (id) => apiClient.deleteOicPrintMaterial(id))
                    }
                  />
                ) : (
                  <LaserSheetMaterialsEditor
                    rows={laserRows}
                    onChange={setLaserRows}
                    userTypeChoices={USER_TYPE_CHOICES}
                    disabled={disabled}
                    onRemove={(row, idx) =>
                      void removeRow(row, idx, setLaserRows, (id) => apiClient.deleteOicLaserSheetMaterial(id))
                    }
                  />
                )}
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    onClick={() => void onSaveMaterials()}
                    disabled={disabled || !materialsDirty}
                    data-testid="save-materials"
                  >
                    {busy === "materials" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save materials
                  </Button>
                  {materialsDirty && <span className="text-xs text-muted-foreground">You have unsaved changes.</span>}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="page-shell">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-5 max-w-5xl space-y-6">
        <StandaloneOnly>
          <div className="rounded-2xl bg-gradient-to-r from-brand via-brand to-brand-accent p-6 text-white shadow-xl">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard")}
              className="mb-3 -ml-2 text-white/90 hover:text-white hover:bg-white/20"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Dashboard
            </Button>
            <h1 className="text-2xl font-semibold tracking-tight">Fabrication Materials</h1>
            <p className="mt-2 text-sm text-white/85 max-w-2xl">
              Manage the master list of 3D print materials and laser cutting sheets, choose which ones each of your
              equipment supports, and who is emailed the uploaded files.
            </p>
          </div>
        </StandaloneOnly>

        {loading && equipments.length === 0 ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : equipments.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              You don&apos;t manage any 3D printing or laser cutting equipment.
            </CardContent>
          </Card>
        ) : (
          <Tabs value={tab} onValueChange={(v) => setTab(v as FabricationTab)}>
            <TabsList>
              {(["print", "laser"] as FabricationTab[]).map((t) => {
                const Icon = tabInfo[t].icon;
                return (
                  <TabsTrigger key={t} value={t} disabled={disabled || byTab[t].length === 0} className="gap-2">
                    <Icon className="h-4 w-4" /> {tabInfo[t].label}
                    <Badge variant="secondary" className="text-[10px]">{byTab[t].length}</Badge>
                  </TabsTrigger>
                );
              })}
            </TabsList>
            <TabsContent value="print" className="pt-4">{renderTab("print")}</TabsContent>
            <TabsContent value="laser" className="pt-4">{renderTab("laser")}</TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}
