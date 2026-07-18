import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardHeader from "@/components/DashboardHeader";
import { apiClient, type PrintMaterial } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { getUserTypeDisplayName, USER_TYPE_DISPLAY_NAMES } from "@/lib/userTypes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, Plus, Trash2, Printer, Table2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type ChargeProfileRow = {
  user_type: string;
  user_type_display: string;
  primary_unit_charge: string;
  is_active: boolean;
};

type EquipmentMaterialsBundle = {
  equipment_id: number;
  equipment_code: string;
  equipment_name: string;
  materials: PrintMaterial[];
  charge_profiles?: ChargeProfileRow[];
};

type MaterialDraft = {
  code: string;
  name: string;
  density_g_per_cm3: string;
  price_per_gram: string;
  user_type: string;
  display_order: string;
};

type MaterialView = {
  id: number;
  code: string;
  name: string;
  price_per_gram: string;
  user_type: string;
  is_active: boolean;
  display_order: number;
};

const EMPTY_DRAFT: MaterialDraft = {
  code: "",
  name: "",
  density_g_per_cm3: "1.240",
  price_per_gram: "",
  user_type: "",
  display_order: "0",
};

const USER_TYPE_OPTIONS = Object.entries(USER_TYPE_DISPLAY_NAMES)
  .filter(([code]) =>
    ["student", "faculty", "individual_student", "external", "rnd", "industry", "other", "startup_incubated_iitr", "external_startup_msme"].includes(code)
  )
  .map(([code, label]) => ({ code, label }));

function materialToDraft(m: PrintMaterial): MaterialDraft {
  return {
    code: m.code ?? "",
    name: m.name ?? "",
    density_g_per_cm3: String(m.density_g_per_cm3 ?? "1.240"),
    price_per_gram: String(m.price_per_gram ?? ""),
    user_type: m.user_type ?? "",
    display_order: String(m.display_order ?? 0),
  };
}

function formatMoney(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n.toFixed(2);
}

/** Effective ₹/g for a category, matching booking material resolution. */
function resolveMaterialPriceForCategory(
  materials: MaterialView[],
  materialCode: string,
  userType: string
): string | null {
  const code = materialCode.trim().toLowerCase();
  const ut = userType.trim().toLowerCase();
  const candidates = materials.filter(
    (m) => m.is_active && m.code.trim().toLowerCase() === code
  );
  if (candidates.length === 0) return null;
  const typed = candidates.find((m) => (m.user_type || "").trim().toLowerCase() === ut);
  if (typed) return typed.price_per_gram;
  const shared = candidates.find((m) => !(m.user_type || "").trim());
  if (shared) return shared.price_per_gram;
  return null;
}

export default function OICPrintMaterials() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userType = String(user?.user_type ?? "").toLowerCase();
  const canManage = userType === "admin" || userType === "manager";

  const [loading, setLoading] = useState(true);
  const [equipments, setEquipments] = useState<EquipmentMaterialsBundle[]>([]);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState("");
  const [drafts, setDrafts] = useState<Record<number, MaterialDraft>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [addDraft, setAddDraft] = useState<MaterialDraft>({ ...EMPTY_DRAFT });
  const [adding, setAdding] = useState(false);

  const selected = useMemo(
    () => equipments.find((e) => String(e.equipment_id) === selectedEquipmentId) ?? null,
    [equipments, selectedEquipmentId]
  );

  /** Live material view: merges saved rows with unsaved draft edits for the charges table. */
  const liveMaterials: MaterialView[] = useMemo(() => {
    if (!selected) return [];
    return selected.materials
      .map((m) => {
        const draft = drafts[m.id];
        return {
          id: m.id,
          code: (draft?.code ?? m.code ?? "").trim(),
          name: (draft?.name ?? m.name ?? "").trim(),
          price_per_gram: (draft?.price_per_gram ?? String(m.price_per_gram ?? "")).trim(),
          user_type: (draft?.user_type ?? m.user_type ?? "").trim(),
          is_active: m.is_active,
          display_order: Number(draft?.display_order ?? m.display_order ?? 0) || 0,
        };
      })
      .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name));
  }, [selected, drafts]);

  const materialColumns = useMemo(() => {
    const byCode = new Map<string, { code: string; name: string }>();
    for (const m of liveMaterials) {
      if (!m.code) continue;
      const key = m.code.toLowerCase();
      if (!byCode.has(key)) {
        byCode.set(key, { code: m.code, name: m.name || m.code });
      }
    }
    return Array.from(byCode.values());
  }, [liveMaterials]);

  const chargeProfiles = useMemo(() => {
    const rows = selected?.charge_profiles ?? [];
    return [...rows].sort((a, b) =>
      String(a.user_type_display || a.user_type).localeCompare(String(b.user_type_display || b.user_type))
    );
  }, [selected]);

  const load = async (preferEquipmentId?: string) => {
    setLoading(true);
    const res = await apiClient.getOicPrintMaterials();
    setLoading(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    const list = (res.data?.equipments || []) as EquipmentMaterialsBundle[];
    setEquipments(list);
    const nextDrafts: Record<number, MaterialDraft> = {};
    list.forEach((eq) => {
      eq.materials.forEach((m) => {
        nextDrafts[m.id] = materialToDraft(m);
      });
    });
    setDrafts(nextDrafts);
    const nextId =
      preferEquipmentId && list.some((e) => String(e.equipment_id) === preferEquipmentId)
        ? preferEquipmentId
        : list.length > 0
          ? String(list[0].equipment_id)
          : "";
    setSelectedEquipmentId(nextId);
  };

  useEffect(() => {
    if (!canManage) {
      toast.error("Only Admin or Officer In Charge can manage 3D print materials.");
      navigate("/dashboard");
      return;
    }
    void load();
  }, [canManage, navigate]);

  const updateLocalMaterial = (material: PrintMaterial) => {
    setEquipments((prev) =>
      prev.map((eq) => ({
        ...eq,
        materials: eq.materials.map((m) => (m.id === material.id ? material : m)),
      }))
    );
    setDrafts((prev) => ({ ...prev, [material.id]: materialToDraft(material) }));
  };

  const removeLocalMaterial = (materialId: number) => {
    setEquipments((prev) =>
      prev.map((eq) => ({
        ...eq,
        materials: eq.materials.filter((m) => m.id !== materialId),
      }))
    );
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[materialId];
      return next;
    });
  };

  const onToggleActive = async (row: PrintMaterial, isActive: boolean) => {
    const key = `toggle-${row.id}`;
    setBusyId(key);
    const res = await apiClient.updateOicPrintMaterial(row.id, { is_active: isActive });
    setBusyId(null);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    if (res.data?.material) updateLocalMaterial(res.data.material);
    toast.success(isActive ? "Material enabled." : "Material disabled.");
  };

  const onSaveMaterial = async (row: PrintMaterial) => {
    const draft = drafts[row.id] ?? materialToDraft(row);
    if (!draft.code.trim() || !draft.name.trim()) {
      toast.error("Code and name are required.");
      return;
    }
    if (!draft.price_per_gram.trim()) {
      toast.error("Price per gram is required.");
      return;
    }
    const key = `save-${row.id}`;
    setBusyId(key);
    const res = await apiClient.updateOicPrintMaterial(row.id, {
      code: draft.code.trim(),
      name: draft.name.trim(),
      density_g_per_cm3: draft.density_g_per_cm3 || "1.240",
      price_per_gram: draft.price_per_gram,
      user_type: draft.user_type.trim() || null,
      display_order: Number(draft.display_order) || 0,
    });
    setBusyId(null);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    if (res.data?.material) updateLocalMaterial(res.data.material);
    toast.success("Material updated.");
  };

  const onDeleteMaterial = async (row: PrintMaterial) => {
    if (!window.confirm(`Delete material "${row.name}" (${row.code})? This cannot be undone.`)) return;
    const key = `del-${row.id}`;
    setBusyId(key);
    const res = await apiClient.deleteOicPrintMaterial(row.id);
    setBusyId(null);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    removeLocalMaterial(row.id);
    toast.success("Material deleted.");
  };

  const onAddMaterial = async () => {
    if (!selected) return;
    if (!addDraft.code.trim() || !addDraft.name.trim()) {
      toast.error("Code and name are required.");
      return;
    }
    if (!addDraft.price_per_gram.trim()) {
      toast.error("Price per gram is required.");
      return;
    }
    setAdding(true);
    const res = await apiClient.createOicPrintMaterial({
      equipment_id: selected.equipment_id,
      code: addDraft.code.trim(),
      name: addDraft.name.trim(),
      density_g_per_cm3: addDraft.density_g_per_cm3 || "1.240",
      price_per_gram: addDraft.price_per_gram,
      user_type: addDraft.user_type.trim() || null,
      is_active: true,
      display_order: Number(addDraft.display_order) || 0,
    });
    setAdding(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    const material = res.data?.material;
    if (material) {
      setEquipments((prev) =>
        prev.map((eq) =>
          eq.equipment_id === selected.equipment_id
            ? {
                ...eq,
                materials: [...eq.materials, material].sort(
                  (a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name)
                ),
              }
            : eq
        )
      );
      setDrafts((prev) => ({ ...prev, [material.id]: materialToDraft(material) }));
    }
    setAddDraft({
      ...EMPTY_DRAFT,
      display_order: String(selected.materials.length || 0),
    });
    toast.success("Material added.");
  };

  const setDraftField = (id: number, field: keyof MaterialDraft, value: string) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? EMPTY_DRAFT), [field]: value },
    }));
  };

  return (
    <div className="page-shell">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-8 max-w-5xl space-y-6">
        <div className="rounded-2xl bg-gradient-to-r from-teal-800 via-teal-700 to-cyan-700 p-6 text-white shadow-xl">
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
          <h1 className="text-2xl font-semibold tracking-tight">3D Print Materials</h1>
          <p className="mt-2 text-sm text-white/85 max-w-2xl">
            Add, edit, enable, disable, or delete filament materials for PRINT_3D equipment you manage.
            Charge preview updates as you change material prices.
          </p>
        </div>

        <Card className="rounded-2xl border-border/70 shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle className="text-lg">Equipment</CardTitle>
            <CardDescription>Select a 3D printer to manage its materials catalog.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : equipments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No PRINT_3D equipment found in your managed set.
              </p>
            ) : (
              <div className="space-y-2">
                <Label>Equipment</Label>
                <Select value={selectedEquipmentId} onValueChange={setSelectedEquipmentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select equipment" />
                  </SelectTrigger>
                  <SelectContent>
                    {equipments.map((eq) => (
                      <SelectItem key={eq.equipment_id} value={String(eq.equipment_id)}>
                        {eq.equipment_code} — {eq.equipment_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>

        {selected && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Table2 className="h-5 w-5" /> Charges by category &amp; material
                </CardTitle>
                <CardDescription>
                  Booking charge ≈ (print weight in g × ₹/g) + (print hours × machine ₹/h).
                  Material cells use the same user-type resolution as booking. Values update live as you edit below.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/40 border-b">
                        <th className="p-3 text-left font-semibold whitespace-nowrap">User category</th>
                        <th className="p-3 text-right font-semibold whitespace-nowrap">Machine ₹/h</th>
                        {materialColumns.length === 0 ? (
                          <th className="p-3 text-left font-semibold text-muted-foreground">No materials</th>
                        ) : (
                          materialColumns.map((col) => (
                            <th key={col.code} className="p-3 text-right font-semibold whitespace-nowrap">
                              <div className="leading-tight">
                                <div>{col.name}</div>
                                <div className="text-[11px] font-normal text-muted-foreground">{col.code} · ₹/g</div>
                              </div>
                            </th>
                          ))
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {chargeProfiles.length === 0 ? (
                        <tr>
                          <td
                            colSpan={Math.max(2, 2 + materialColumns.length)}
                            className="p-4 text-muted-foreground"
                          >
                            No charge profiles configured for this equipment. Machine rates come from Admin charge
                            profiles.
                          </td>
                        </tr>
                      ) : (
                        chargeProfiles.map((cp) => {
                          const ut = String(cp.user_type || "").toLowerCase();
                          return (
                            <tr
                              key={cp.user_type}
                              className={cn(
                                "border-b last:border-0",
                                !cp.is_active && "opacity-50 bg-muted/20"
                              )}
                            >
                              <td className="p-3 align-middle">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-medium">
                                    {cp.user_type_display || getUserTypeDisplayName(cp.user_type)}
                                  </span>
                                  {!cp.is_active ? (
                                    <Badge variant="secondary" className="text-[10px]">
                                      Inactive profile
                                    </Badge>
                                  ) : null}
                                </div>
                              </td>
                              <td className="p-3 text-right tabular-nums font-medium">
                                ₹{formatMoney(cp.primary_unit_charge)}
                              </td>
                              {materialColumns.map((col) => {
                                const price = resolveMaterialPriceForCategory(liveMaterials, col.code, ut);
                                return (
                                  <td key={`${cp.user_type}-${col.code}`} className="p-3 text-right tabular-nums">
                                    {price != null && price !== "" ? (
                                      `₹${formatMoney(price)}`
                                    ) : (
                                      <span className="text-muted-foreground">—</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/40 border-b">
                        <th className="p-3 text-left font-semibold">Material</th>
                        <th className="p-3 text-left font-semibold">Code</th>
                        <th className="p-3 text-right font-semibold">₹/g</th>
                        <th className="p-3 text-left font-semibold">Applies to</th>
                        <th className="p-3 text-left font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {liveMaterials.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-4 text-muted-foreground">
                            No materials yet. Add materials below to populate this table.
                          </td>
                        </tr>
                      ) : (
                        liveMaterials.map((m) => (
                          <tr
                            key={m.id}
                            className={cn("border-b last:border-0", !m.is_active && "opacity-50")}
                          >
                            <td className="p-3 font-medium">{m.name || "—"}</td>
                            <td className="p-3 font-mono text-xs">{m.code || "—"}</td>
                            <td className="p-3 text-right tabular-nums">₹{formatMoney(m.price_per_gram)}</td>
                            <td className="p-3 text-muted-foreground">
                              {m.user_type
                                ? getUserTypeDisplayName(m.user_type) || m.user_type
                                : "All user types"}
                            </td>
                            <td className="p-3">
                              {m.is_active ? (
                                <Badge className="bg-teal-700 text-white hover:bg-teal-700">Active</Badge>
                              ) : (
                                <Badge variant="secondary">Inactive</Badge>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground">
                  GST (where applicable) is added at booking time for external categories and is not shown here.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Printer className="h-5 w-5" /> Materials
                </CardTitle>
                <CardDescription>
                  Catalog for {selected.equipment_code} — {selected.equipment_name}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {selected.materials.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No materials configured yet.</p>
                ) : (
                  selected.materials.map((m) => {
                    const draft = drafts[m.id] ?? materialToDraft(m);
                    const saving = busyId === `save-${m.id}`;
                    const toggling = busyId === `toggle-${m.id}`;
                    const deleting = busyId === `del-${m.id}`;
                    return (
                      <div key={m.id} className="rounded-xl border border-border/70 p-4 space-y-3 bg-muted/10">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs">Code</Label>
                            <Input
                              value={draft.code}
                              onChange={(e) => setDraftField(m.id, "code", e.target.value)}
                              placeholder="pla_white"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Name</Label>
                            <Input
                              value={draft.name}
                              onChange={(e) => setDraftField(m.id, "name", e.target.value)}
                              placeholder="PLA White"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Density (g/cm³)</Label>
                            <Input
                              type="number"
                              step="0.001"
                              value={draft.density_g_per_cm3}
                              onChange={(e) => setDraftField(m.id, "density_g_per_cm3", e.target.value)}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Price per gram (₹)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={draft.price_per_gram}
                              onChange={(e) => setDraftField(m.id, "price_per_gram", e.target.value)}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">User type (blank = all)</Label>
                            <Select
                              value={draft.user_type || "__all__"}
                              onValueChange={(v) => setDraftField(m.id, "user_type", v === "__all__" ? "" : v)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="All user types" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__all__">All user types</SelectItem>
                                {USER_TYPE_OPTIONS.map((o) => (
                                  <SelectItem key={o.code} value={o.code}>
                                    {o.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Display order</Label>
                            <Input
                              type="number"
                              min={0}
                              value={draft.display_order}
                              onChange={(e) => setDraftField(m.id, "display_order", e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {m.is_active ? "Active" : "Inactive"}
                            </span>
                            <Switch
                              checked={m.is_active}
                              disabled={toggling || deleting}
                              onCheckedChange={(v) => void onToggleActive(m, v)}
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={saving || deleting}
                              onClick={() => void onSaveMaterial(m)}
                            >
                              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              disabled={deleting || saving}
                              onClick={() => void onDeleteMaterial(m)}
                            >
                              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Plus className="h-5 w-5" /> Add material
                </CardTitle>
                <CardDescription>Create a new filament entry for this printer.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Code</Label>
                    <Input
                      value={addDraft.code}
                      onChange={(e) => setAddDraft((p) => ({ ...p, code: e.target.value }))}
                      placeholder="pla_white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Name</Label>
                    <Input
                      value={addDraft.name}
                      onChange={(e) => setAddDraft((p) => ({ ...p, name: e.target.value }))}
                      placeholder="PLA White"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Density (g/cm³)</Label>
                    <Input
                      type="number"
                      step="0.001"
                      value={addDraft.density_g_per_cm3}
                      onChange={(e) => setAddDraft((p) => ({ ...p, density_g_per_cm3: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Price per gram (₹)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={addDraft.price_per_gram}
                      onChange={(e) => setAddDraft((p) => ({ ...p, price_per_gram: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">User type (blank = all)</Label>
                    <Select
                      value={addDraft.user_type || "__all__"}
                      onValueChange={(v) => setAddDraft((p) => ({ ...p, user_type: v === "__all__" ? "" : v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All user types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All user types</SelectItem>
                        {USER_TYPE_OPTIONS.map((o) => (
                          <SelectItem key={o.code} value={o.code}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Display order</Label>
                    <Input
                      type="number"
                      min={0}
                      value={addDraft.display_order}
                      onChange={(e) => setAddDraft((p) => ({ ...p, display_order: e.target.value }))}
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  className="bg-teal-700 hover:bg-teal-800 text-white"
                  disabled={adding}
                  onClick={() => void onAddMaterial()}
                >
                  {adding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                  Add material
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
