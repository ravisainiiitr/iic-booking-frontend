import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardHeader from "@/components/DashboardHeader";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api";
import { hasRbacPermission } from "@/lib/rbac";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Loader2, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";

type CatalogCol = {
  id: string;
  name: string;
  slug: string;
  vendor?: string;
  category?: string;
  license_type?: string;
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
  const [savingId, setSavingId] = useState<number | null>(null);
  const [catalogs, setCatalogs] = useState<CatalogCol[]>([]);
  const [equipment, setEquipment] = useState<EquipmentRow[]>([]);
  const [draft, setDraft] = useState<Record<number, Set<string>>>({});
  const [defaults, setDefaults] = useState<Record<number, string | null>>({});
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const dept = departmentFilter !== "all" ? departmentFilter : undefined;
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
        toast.message("No active catalog software yet — add entries in Software catalog first.");
      } else if (!eqs.length) {
        toast.message("No equipment with Remote Analysis enabled. Enable it on equipment settings.");
      }
      const nextDraft: Record<number, Set<string>> = {};
      const nextDefaults: Record<number, string | null> = {};
      for (const eq of eqs) {
        nextDraft[eq.id] = new Set(eq.catalog_ids || []);
        nextDefaults[eq.id] = eq.default_catalog_id || null;
      }
      setDraft(nextDraft);
      setDefaults(nextDefaults);
    } finally {
      setLoading(false);
    }
  }, [departmentFilter]);

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

  const visibleEquipment = useMemo(() => {
    const q = search.trim().toLowerCase();
    return equipment.filter((eq) => {
      if (!q) return true;
      return (
        eq.name.toLowerCase().includes(q) ||
        (eq.code || "").toLowerCase().includes(q) ||
        (eq.department_name || "").toLowerCase().includes(q)
      );
    });
  }, [equipment, search]);

  const toggle = (equipmentId: number, catalogId: string, checked: boolean) => {
    setDraft((prev) => {
      const next = { ...prev };
      const set = new Set(next[equipmentId] || []);
      if (checked) set.add(catalogId);
      else set.delete(catalogId);
      next[equipmentId] = set;
      return next;
    });
    if (!checked) {
      setDefaults((prev) => (prev[equipmentId] === catalogId ? { ...prev, [equipmentId]: null } : prev));
    }
  };

  const saveRow = async (eq: EquipmentRow) => {
    if (!canManage) return;
    setSavingId(eq.id);
    try {
      const catalogIds = Array.from(draft[eq.id] || []);
      const res = await apiClient.putEquipmentSoftwareMatrix({
        equipment_id: eq.id,
        catalog_ids: catalogIds,
        default_catalog_id: defaults[eq.id] || null,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`Saved mappings for ${eq.name}`);
      await load();
    } finally {
      setSavingId(null);
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
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <div className="container mx-auto space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/remote-analysis")}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Back
            </Button>
            <div>
              <h1 className="text-2xl font-semibold">Equipment → Software Mapping</h1>
              <p className="text-sm text-muted-foreground">
                Department → Equipment → Supported software (checkbox matrix). No workstation assignment.
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
            <CardTitle className="text-base">Filters</CardTitle>
            <CardDescription>
              {visibleEquipment.length} equipment · {catalogs.length} active catalog software
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Input
              placeholder="Search equipment…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-[220px]">
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
          </CardContent>
        </Card>

        <Card>
          <CardContent className="overflow-x-auto pt-6">
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading matrix…
              </div>
            ) : catalogs.length === 0 ? (
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  No active catalog software.{" "}
                  <button className="underline" onClick={() => navigate("/remote-analysis/software-catalog")}>
                    Add catalog entries
                  </button>{" "}
                  first, then return here to map them to equipment.
                </p>
                <p>
                  Only equipment with <strong>Remote Analysis enabled</strong> appear in this matrix.
                </p>
              </div>
            ) : visibleEquipment.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No equipment with Remote Analysis enabled
                {departmentFilter !== "all" ? " in this department" : ""}. Enable Remote Analysis on the
                equipment record, then Refresh.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 z-10 min-w-[200px] bg-background">Equipment</TableHead>
                    {catalogs.map((c) => (
                      <TableHead key={c.id} className="min-w-[120px] text-center">
                        <div className="font-medium">{c.name}</div>
                        <div className="text-[10px] font-normal text-muted-foreground">{c.license_type || c.category}</div>
                      </TableHead>
                    ))}
                    {canManage && <TableHead className="min-w-[100px]" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleEquipment.map((eq) => (
                    <TableRow key={eq.id}>
                      <TableCell className="sticky left-0 z-10 bg-background">
                        <div className="font-medium">{eq.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {eq.code} · {eq.department_name || "No dept"}
                        </div>
                        {(draft[eq.id]?.size || 0) > 0 && (
                          <div className="mt-1">
                            <Badge variant="outline" className="text-[10px]">
                              Default:{" "}
                              {catalogs.find((c) => c.id === defaults[eq.id])?.name || "first checked"}
                            </Badge>
                          </div>
                        )}
                      </TableCell>
                      {catalogs.map((c) => {
                        const checked = draft[eq.id]?.has(c.id) || false;
                        const isDefault = defaults[eq.id] === c.id;
                        return (
                          <TableCell key={c.id} className="text-center align-middle">
                            <div className="flex flex-col items-center gap-1">
                              <Checkbox
                                checked={checked}
                                disabled={!canManage}
                                onCheckedChange={(v) => toggle(eq.id, c.id, Boolean(v))}
                              />
                              {checked && canManage && (
                                <button
                                  type="button"
                                  className={`text-[10px] ${isDefault ? "font-semibold text-primary" : "text-muted-foreground"}`}
                                  onClick={() => setDefaults((prev) => ({ ...prev, [eq.id]: c.id }))}
                                >
                                  {isDefault ? "default" : "set default"}
                                </button>
                              )}
                            </div>
                          </TableCell>
                        );
                      })}
                      {canManage && (
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={savingId === eq.id}
                            onClick={() => void saveRow(eq)}
                          >
                            {savingId === eq.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Save className="mr-1 h-3 w-3" /> Save
                              </>
                            )}
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {!visibleEquipment.length && (
                    <TableRow>
                      <TableCell colSpan={catalogs.length + 2} className="text-center text-muted-foreground">
                        No RA-enabled equipment found for this filter.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
