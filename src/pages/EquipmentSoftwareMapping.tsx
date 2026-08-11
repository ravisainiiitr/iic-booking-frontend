import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardHeader from "@/components/DashboardHeader";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api";
import { hasRbacPermission } from "@/lib/rbac";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Check, Loader2, Plus, RefreshCw, Save, Search, Settings2, X } from "lucide-react";
import { toast } from "sonner";

type CatalogCol = {
  id: string;
  name: string;
  slug: string;
  vendor?: string;
  category?: string;
  license_type?: string;
  installed_count?: number;
  online_count?: number;
  available_count?: number;
  busy_count?: number;
  offline_count?: number;
  last_inventory_update?: string | null;
};

type EquipmentRow = {
  id: number;
  name: string;
  code?: string;
  department_id?: number | null;
  department_name?: string | null;
  catalog_ids: string[];
  default_catalog_id?: string | null;
};

function formatUpdated(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export default function EquipmentSoftwareMapping() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManage =
    user?.user_type === "admin" ||
    user?.user_type === "dept_admin" ||
    hasRbacPermission(user, "remote_analysis.manage");
  const canView =
    canManage ||
    user?.user_type === "manager" ||
    user?.user_type === "operator" ||
    hasRbacPermission(user, "remote_analysis.view");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [catalogs, setCatalogs] = useState<CatalogCol[]>([]);
  const [equipment, setEquipment] = useState<EquipmentRow[]>([]);
  const [departmentId, setDepartmentId] = useState<string>("all");
  const [equipmentId, setEquipmentId] = useState<string>("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const dept = departmentId !== "all" ? departmentId : undefined;
      const res = await apiClient.getEquipmentSoftwareMatrix(dept);
      if (res.error) {
        toast.error(res.error);
        setCatalogs([]);
        setEquipment([]);
        return;
      }
      const cats = (res.data?.catalogs as CatalogCol[]) || [];
      const eqs = (res.data?.equipment as EquipmentRow[]) || [];
      setCatalogs(cats);
      setEquipment(eqs);
      if (!cats.length) {
        toast.message("No active catalog software yet — enroll an RAA or add catalog entries.");
      }
    } finally {
      setLoading(false);
    }
  }, [departmentId]);

  useEffect(() => {
    if (canView) void load();
  }, [canView, load]);

  const departments = useMemo(() => {
    const map = new Map<string, string>();
    for (const eq of equipment) {
      if (eq.department_id != null) {
        map.set(String(eq.department_id), eq.department_name || `Dept ${eq.department_id}`);
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [equipment]);

  const equipmentOptions = useMemo(() => {
    if (departmentId === "all") return equipment;
    return equipment.filter((eq) => String(eq.department_id || "") === departmentId);
  }, [equipment, departmentId]);

  useEffect(() => {
    if (!equipmentOptions.length) {
      setEquipmentId("");
      setSelected(new Set());
      return;
    }
    const stillValid = equipmentOptions.some((eq) => String(eq.id) === equipmentId);
    if (!stillValid) {
      const first = equipmentOptions[0];
      setEquipmentId(String(first.id));
      setSelected(new Set(first.catalog_ids || []));
    }
  }, [equipmentOptions, equipmentId]);

  useEffect(() => {
    const eq = equipment.find((e) => String(e.id) === equipmentId);
    if (eq) setSelected(new Set(eq.catalog_ids || []));
  }, [equipmentId, equipment]);

  const filteredCatalogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return catalogs.filter((c) => {
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.vendor || "").toLowerCase().includes(q) ||
        (c.slug || "").toLowerCase().includes(q) ||
        (c.category || "").toLowerCase().includes(q)
      );
    });
  }, [catalogs, search]);

  const selectedEquipment = equipment.find((e) => String(e.id) === equipmentId) || null;

  const addSoftware = (id: string) => {
    setSelected((prev) => new Set(prev).add(id));
  };
  const removeSoftware = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const saveMapping = async () => {
    if (!canManage || !selectedEquipment) return;
    setSaving(true);
    try {
      const catalogIds = Array.from(selected);
      const res = await apiClient.putEquipmentSoftwareMatrix({
        equipment_id: selectedEquipment.id,
        catalog_ids: catalogIds,
        default_catalog_id: catalogIds[0] || null,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`Saved Remote Analysis software for ${selectedEquipment.name}`);
      await load();
    } finally {
      setSaving(false);
    }
  };

  if (!canView) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardHeader />
        <div className="container mx-auto p-6">
          <Card>
            <CardHeader>
              <CardTitle>Access denied</CardTitle>
              <CardDescription>Administrator permission required.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <div className="container mx-auto max-w-5xl space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/remote-analysis")}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Back
            </Button>
            <div>
              <h1 className="text-2xl font-semibold">Remote Analysis Software</h1>
              <p className="text-sm text-muted-foreground">
                Department → Equipment → Required analysis software. Allocation uses RAA inventory, not a
                fixed PC binding.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/remote-analysis/software-catalog")}>
              Software catalog
            </Button>
            <Button variant="outline" size="sm" onClick={() => void load()}>
              <RefreshCw className="mr-1 h-4 w-4" /> Refresh
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Select equipment</CardTitle>
            <CardDescription>Only equipment with Remote Analysis enabled is listed.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Department</p>
              <Select
                value={departmentId}
                onValueChange={(v) => {
                  setDepartmentId(v);
                  setEquipmentId("");
                }}
              >
                <SelectTrigger className="w-[240px]">
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All departments</SelectItem>
                  {departments.map(([id, name]) => (
                    <SelectItem key={id} value={id}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Equipment</p>
              <Select value={equipmentId || undefined} onValueChange={setEquipmentId}>
                <SelectTrigger className="w-[280px]">
                  <SelectValue placeholder="Select equipment" />
                </SelectTrigger>
                <SelectContent>
                  {equipmentOptions.map((eq) => (
                    <SelectItem key={eq.id} value={String(eq.id)}>
                      {eq.name} {eq.code ? `(${eq.code})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="secondary" size="sm" onClick={() => navigate("/admin/equipment")}>
              <Settings2 className="mr-1 h-4 w-4" /> Manage Equipment
            </Button>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : catalogs.length === 0 ? (
          <Card>
            <CardContent className="space-y-2 py-8 text-sm text-muted-foreground">
              <p>No active catalog software.</p>
              <p>
                Enroll a Remote Analysis Agent (inventory auto-fills the catalog), or{" "}
                <button className="underline" onClick={() => navigate("/remote-analysis/software-catalog")}>
                  add catalog entries
                </button>
                .
              </p>
            </CardContent>
          </Card>
        ) : !selectedEquipment ? (
          <Card>
            <CardContent className="py-8 text-sm text-muted-foreground">
              No RA-enabled equipment found. Use <strong>Manage Equipment</strong> to enable Remote Analysis.
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Required Analysis Software</CardTitle>
                <CardDescription>
                  Mapping for <strong>{selectedEquipment.name}</strong>
                  {selectedEquipment.code ? ` (${selectedEquipment.code})` : ""}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative max-w-md">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-8"
                    placeholder="Search software…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <div className="grid gap-3">
                  {filteredCatalogs.map((c) => {
                    const already = selected.has(c.id);
                    return (
                      <div
                        key={c.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-sm"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold">{c.name}</p>
                            {c.vendor ? <Badge variant="secondary">{c.vendor}</Badge> : null}
                            {already ? <Badge className="bg-emerald-600 hover:bg-emerald-600">Selected</Badge> : null}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Installed on: {Number(c.installed_count ?? 0)} RAA PC
                            {Number(c.installed_count ?? 0) === 1 ? "" : "s"}
                          </p>
                          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                            <span>Online: {Number(c.online_count ?? 0)}</span>
                            <span>Available: {Number(c.available_count ?? 0)}</span>
                            <span>Busy: {Number(c.busy_count ?? 0)}</span>
                            <span>Offline: {Number(c.offline_count ?? 0)}</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            Last inventory: {formatUpdated(c.last_inventory_update)}
                          </p>
                        </div>
                        {canManage ? (
                          already ? (
                            <Button size="sm" variant="outline" onClick={() => removeSoftware(c.id)}>
                              <X className="mr-1 h-4 w-4" /> Remove
                            </Button>
                          ) : (
                            <Button size="sm" onClick={() => addSoftware(c.id)}>
                              <Plus className="mr-1 h-4 w-4" /> Add
                            </Button>
                          )
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Selected Software</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {selected.size === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No software selected. Remote Analysis will show “not configured” for this equipment until
                    you save at least one mapping.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {Array.from(selected).map((id) => {
                      const c = catalogs.find((x) => x.id === id);
                      return (
                        <li key={id} className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-emerald-600" />
                          <span className="font-medium">{c?.name || id}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {canManage ? (
                  <Button disabled={saving} onClick={() => void saveMapping()}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Mapping
                  </Button>
                ) : null}
              </CardContent>
            </Card>

            <p className="text-xs text-muted-foreground">
              Legacy free-text Analysis Profile remains available on the equipment form as an optional
              fallback only. Prefer this Software Catalog mapping.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
