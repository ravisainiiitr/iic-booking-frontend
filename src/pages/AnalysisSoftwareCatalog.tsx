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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Archive, Eye, Loader2, Plus, RefreshCw, Upload } from "lucide-react";
import { toast } from "sonner";

type CatalogRow = {
  id: string;
  name: string;
  slug: string;
  vendor?: string;
  version_constraint?: string;
  license_type?: string;
  max_concurrent?: number;
  license_server_url?: string;
  license_seats?: number;
  description?: string;
  typical_usage?: string;
  accepted_file_types?: string[];
  category?: string;
  is_active?: boolean;
  is_archived?: boolean;
  ai_tags?: string[];
  ai_metadata?: Record<string, unknown>;
  equipment_mapping_count?: number;
  installed_match_count?: number;
};

const emptyForm = (): Partial<CatalogRow> & { accepted_file_types_text?: string; ai_tags_text?: string } => ({
  name: "",
  vendor: "",
  version_constraint: "",
  license_type: "unlimited",
  max_concurrent: 0,
  license_seats: 0,
  license_server_url: "",
  description: "",
  typical_usage: "",
  category: "",
  accepted_file_types_text: "",
  ai_tags_text: "",
  is_active: true,
});

export default function AnalysisSoftwareCatalog() {
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
  const [rows, setRows] = useState<CatalogRow[]>([]);
  const [licenseTypes, setLicenseTypes] = useState<Array<{ value: string; label: string }>>([]);
  const [search, setSearch] = useState("");
  const [licenseFilter, setLicenseFilter] = useState("all");
  const [activeFilter, setActiveFilter] = useState("active");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [usageOpen, setUsageOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogRow | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [usage, setUsage] = useState<Record<string, unknown> | null>(null);
  const [importText, setImportText] = useState("[\n  { \"name\": \"OriginPro\", \"vendor\": \"OriginLab\", \"license_type\": \"concurrent\" }\n]");
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search.trim()) params.q = search.trim();
      if (licenseFilter !== "all") params.license_type = licenseFilter;
      if (activeFilter === "active") {
        params.active = "1";
        params.archived = "0";
      } else if (activeFilter === "disabled") {
        params.active = "0";
      } else if (activeFilter === "archived") {
        params.archived = "1";
      }
      const res = await apiClient.listAnalysisSoftwareCatalog(params);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setRows((res.data?.results as CatalogRow[]) || []);
      setLicenseTypes(res.data?.license_types || []);
    } finally {
      setLoading(false);
    }
  }, [search, licenseFilter, activeFilter]);

  useEffect(() => {
    if (canView) void load();
  }, [canView, load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (row: CatalogRow) => {
    setEditing(row);
    setForm({
      ...row,
      accepted_file_types_text: (row.accepted_file_types || []).join(", "),
      ai_tags_text: (row.ai_tags || []).join(", "),
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.name?.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: form.name,
        vendor: form.vendor || "",
        version_constraint: form.version_constraint || "",
        license_type: form.license_type || "",
        max_concurrent: Number(form.max_concurrent || 0),
        license_seats: Number(form.license_seats || 0),
        license_server_url: form.license_server_url || "",
        description: form.description || "",
        typical_usage: form.typical_usage || "",
        category: form.category || "",
        accepted_file_types: String(form.accepted_file_types_text || "")
          .split(/[,;]/)
          .map((s) => s.trim())
          .filter(Boolean),
        ai_tags: String(form.ai_tags_text || "")
          .split(/[,;]/)
          .map((s) => s.trim())
          .filter(Boolean),
        is_active: form.is_active !== false,
      };
      const res = editing
        ? await apiClient.updateAnalysisSoftwareCatalog(editing.id, body)
        : await apiClient.createAnalysisSoftwareCatalog(body);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(editing ? "Catalog entry updated" : "Catalog entry created");
      setDialogOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const showUsage = async (row: CatalogRow) => {
    const res = await apiClient.getAnalysisSoftwareCatalogUsage(row.id);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setUsage(res.data || null);
    setUsageOpen(true);
  };

  const runImport = async () => {
    try {
      const items = JSON.parse(importText);
      if (!Array.isArray(items)) {
        toast.error("Import JSON must be an array");
        return;
      }
      setSaving(true);
      const res = await apiClient.importAnalysisSoftwareCatalog(items);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`Imported: created ${res.data?.created}, updated ${res.data?.updated}`);
      setImportOpen(false);
      await load();
    } catch {
      toast.error("Invalid JSON");
    } finally {
      setSaving(false);
    }
  };

  const syncFromInventory = async () => {
    setSyncing(true);
    try {
      const res = await apiClient.syncAnalysisSoftwareCatalogFromInventory({ refresh_agents: false });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      const after = res.data?.after || {};
      const cleanup = (res.data?.cleanup || {}) as Record<string, unknown>;
      const archived =
        Number(cleanup.infrastructure_archived || 0) + Number(cleanup.unmanaged_auto_archived || 0);
      toast.success(
        `Catalog sync complete · ${Number(after.active_catalog_count || 0)} analysis entries` +
          (archived > 0 ? ` · archived ${archived} non-analysis` : "")
      );
      await load();
    } finally {
      setSyncing(false);
    }
  };

  const filteredCount = useMemo(() => rows.length, [rows]);

  if (!canView) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardHeader />
        <div className="container mx-auto p-6">
          <Card>
            <CardHeader>
              <CardTitle>Access denied</CardTitle>
              <CardDescription>You need Remote Analysis view permission.</CardDescription>
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
              <h1 className="text-2xl font-semibold">Analysis Software Catalog</h1>
              <p className="text-sm text-muted-foreground">
                Add, edit, disable, archive, import — single catalog used by installer, scheduler, and workspace.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/remote-analysis/equipment-software")}>
              Equipment mapping
            </Button>
            <Button variant="outline" size="sm" onClick={() => void load()}>
              <RefreshCw className="mr-1 h-4 w-4" /> Refresh
            </Button>
            {canManage && (
              <>
                <Button variant="secondary" size="sm" disabled={syncing} onClick={() => void syncFromInventory()}>
                  {syncing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />}
                  Sync from RAA
                </Button>
                <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                  <Upload className="mr-1 h-4 w-4" /> Import
                </Button>
                <Button size="sm" onClick={openCreate}>
                  <Plus className="mr-1 h-4 w-4" /> Add software
                </Button>
              </>
            )}
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Search & filter</CardTitle>
            <CardDescription>{filteredCount} catalog entries</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Input
              placeholder="Search name, vendor, category…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
            <Select value={licenseFilter} onValueChange={setLicenseFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="License type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All license types</SelectItem>
                {licenseTypes.map((lt) => (
                  <SelectItem key={lt.value} value={lt.value}>
                    {lt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={activeFilter} onValueChange={setActiveFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="disabled">Disabled</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="secondary" onClick={() => void load()}>
              Apply
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading catalog…
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>License</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="font-medium">{row.name}</div>
                        <div className="text-xs text-muted-foreground">{row.slug}</div>
                      </TableCell>
                      <TableCell>{row.vendor || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{row.license_type || "—"}</Badge>
                      </TableCell>
                      <TableCell>{row.version_constraint || "—"}</TableCell>
                      <TableCell className="text-sm">
                        {row.equipment_mapping_count ?? 0} eq · {row.installed_match_count ?? 0} installed
                      </TableCell>
                      <TableCell>
                        {row.is_archived ? (
                          <Badge variant="secondary">Archived</Badge>
                        ) : row.is_active ? (
                          <Badge>Active</Badge>
                        ) : (
                          <Badge variant="destructive">Disabled</Badge>
                        )}
                      </TableCell>
                      <TableCell className="space-x-1 text-right">
                        <Button size="sm" variant="ghost" onClick={() => void showUsage(row)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {canManage && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => openEdit(row)}>
                              Edit
                            </Button>
                            {row.is_active ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={async () => {
                                  await apiClient.disableAnalysisSoftwareCatalog(row.id);
                                  toast.success("Disabled");
                                  void load();
                                }}
                              >
                                Disable
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={async () => {
                                  await apiClient.enableAnalysisSoftwareCatalog(row.id);
                                  toast.success("Enabled");
                                  void load();
                                }}
                              >
                                Enable
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={async () => {
                                await apiClient.archiveAnalysisSoftwareCatalog(row.id);
                                toast.success("Archived");
                                void load();
                              }}
                            >
                              <Archive className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!rows.length && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        No catalog entries match filters.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit software" : "Add software"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div>
              <Label>Name</Label>
              <Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Vendor</Label>
                <Input value={form.vendor || ""} onChange={(e) => setForm({ ...form, vendor: e.target.value })} />
              </div>
              <div>
                <Label>Category</Label>
                <Input value={form.category || ""} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>License type</Label>
                <Select
                  value={form.license_type || "unlimited"}
                  onValueChange={(v) => setForm({ ...form, license_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(licenseTypes.length
                      ? licenseTypes
                      : [
                          { value: "unlimited", label: "Unlimited" },
                          { value: "node_locked", label: "Node Locked" },
                          { value: "concurrent", label: "Concurrent" },
                          { value: "floating", label: "Floating" },
                          { value: "network", label: "Network License Server" },
                          { value: "dongle", label: "Dongle" },
                          { value: "expired", label: "Expired" },
                          { value: "other", label: "Other" },
                        ]
                    ).map((lt) => (
                      <SelectItem key={lt.value} value={lt.value}>
                        {lt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Version constraint</Label>
                <Input
                  value={form.version_constraint || ""}
                  onChange={(e) => setForm({ ...form, version_constraint: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Max concurrent</Label>
                <Input
                  type="number"
                  value={form.max_concurrent ?? 0}
                  onChange={(e) => setForm({ ...form, max_concurrent: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>License seats</Label>
                <Input
                  type="number"
                  value={form.license_seats ?? 0}
                  onChange={(e) => setForm({ ...form, license_seats: Number(e.target.value) })}
                />
              </div>
            </div>
            <div>
              <Label>License server URL</Label>
              <Input
                value={form.license_server_url || ""}
                onChange={(e) => setForm({ ...form, license_server_url: e.target.value })}
                placeholder="host:port or URL (network / floating)"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={form.description || ""}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div>
              <Label>Typical usage</Label>
              <Textarea
                value={form.typical_usage || ""}
                onChange={(e) => setForm({ ...form, typical_usage: e.target.value })}
              />
            </div>
            <div>
              <Label>Accepted file types (comma-separated)</Label>
              <Input
                value={form.accepted_file_types_text || ""}
                onChange={(e) => setForm({ ...form, accepted_file_types_text: e.target.value })}
                placeholder=".raw, .xy, .csv"
              />
            </div>
            <div>
              <Label>AI tags (metadata only)</Label>
              <Input
                value={form.ai_tags_text || ""}
                onChange={(e) => setForm({ ...form, ai_tags_text: e.target.value })}
                placeholder="xrd, peak-fitting"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={form.is_active !== false}
                onCheckedChange={(v) => setForm({ ...form, is_active: Boolean(v) })}
              />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={usageOpen} onOpenChange={setUsageOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Usage</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              Equipment mappings: {String((usage as any)?.mapping_count ?? 0)}
            </div>
            <div>
              Installed matches: {String((usage as any)?.installed_count ?? 0)}
            </div>
            <pre className="max-h-64 overflow-auto rounded bg-muted p-2 text-xs">
              {JSON.stringify(usage, null, 2)}
            </pre>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import catalog JSON</DialogTitle>
          </DialogHeader>
          <Textarea className="min-h-[200px] font-mono text-xs" value={importText} onChange={(e) => setImportText(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void runImport()} disabled={saving}>
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
