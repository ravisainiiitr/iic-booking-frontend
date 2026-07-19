import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import DashboardHeader from "@/components/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient, type AdminPanelModuleNode, type AdminPanelRoleConfig } from "@/lib/api";
import { ArrowLeft, Loader2, Pencil, Plus, ShieldCheck } from "lucide-react";

type DepartmentRow = { id: number; name: string; code?: string | null };
type UserTypeOption = { value: string; label: string };

function collectKeys(node: AdminPanelModuleNode): string[] {
  const keys = [node.key];
  for (const child of node.children ?? []) {
    keys.push(...collectKeys(child));
  }
  return keys;
}

type NodeCheckedState = "checked" | "unchecked" | "indeterminate";

function computeNodeState(selected: Set<string>, node: AdminPanelModuleNode): NodeCheckedState {
  const keys = collectKeys(node);
  const selectedCount = keys.filter((k) => selected.has(k)).length;
  if (selectedCount === 0) return "unchecked";
  if (selectedCount === keys.length) return "checked";
  return "indeterminate";
}

function ModuleTreeNode({
  node,
  depth,
  selected,
  onToggleSubtree,
}: {
  node: AdminPanelModuleNode;
  depth: number;
  selected: Set<string>;
  onToggleSubtree: (node: AdminPanelModuleNode, checked: boolean) => void;
}) {
  const state = computeNodeState(selected, node);
  const hasChildren = (node.children?.length ?? 0) > 0;
  return (
    <div className={depth > 0 ? "mt-2 border-l pl-4" : ""}>
      <label className="flex items-start gap-3 rounded-lg border p-3 hover:bg-muted/40">
        <Checkbox
          checked={state === "indeterminate" ? "indeterminate" : state === "checked"}
          onCheckedChange={(value) => onToggleSubtree(node, value === true)}
          className="mt-0.5"
        />
        <div className="space-y-0.5">
          <p className="text-sm font-medium flex items-center gap-2">
            {node.label}
            {node.main_admin_only ? (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                Main Admin
              </span>
            ) : null}
          </p>
          <p className="text-xs text-muted-foreground">{node.key}</p>
          {node.description ? <p className="text-xs text-muted-foreground">{node.description}</p> : null}
        </div>
      </label>
      {hasChildren ? (
        <div className="space-y-2 pt-2">
          {node.children!.map((child) => (
            <ModuleTreeNode
              key={child.key}
              node={child}
              depth={depth + 1}
              selected={selected}
              onToggleSubtree={onToggleSubtree}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function AdminPanelAccessConfig() {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const isMainAdmin = String(user?.user_type ?? "").toLowerCase() === "admin";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configs, setConfigs] = useState<AdminPanelRoleConfig[]>([]);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [userTypes, setUserTypes] = useState<UserTypeOption[]>([]);
  const [moduleTree, setModuleTree] = useState<AdminPanelModuleNode[]>([]);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>("");
  const [selectedUserType, setSelectedUserType] = useState<string>("");
  const [adminPanelEnabled, setAdminPanelEnabled] = useState(false);
  const [selectedModuleKeys, setSelectedModuleKeys] = useState<Set<string>>(new Set());
  const editorRef = useRef<HTMLDivElement | null>(null);

  const scrollToEditor = useCallback(() => {
    // Defer until React has painted the editor card.
    window.setTimeout(() => {
      editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [registryRes, departmentsRes, configsRes] = await Promise.all([
        apiClient.getAdminPanelAccessRegistry(),
        apiClient.getDepartments("internal"),
        apiClient.listAdminPanelRoleConfigs(),
      ]);
      if (registryRes.error || !registryRes.data) {
        toast.error(registryRes.error || "Failed to load module registry.");
        return;
      }
      setModuleTree(registryRes.data.tree ?? []);
      setUserTypes(registryRes.data.configurable_user_types ?? []);
      const depts = departmentsRes.data?.departments ?? [];
      setDepartments(depts);
      setConfigs(Array.isArray(configsRes.data) ? configsRes.data : []);
      if (!selectedDepartmentId && depts.length > 0) {
        setSelectedDepartmentId(String(depts[0].id));
      }
      if (!selectedUserType) {
        const firstUserType = registryRes.data.configurable_user_types?.[0]?.value;
        if (firstUserType) setSelectedUserType(firstUserType);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedDepartmentId, selectedUserType]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !user) {
      navigate("/auth");
      return;
    }
    if (!isMainAdmin) {
      toast.error("Only Main Admin can configure Admin Panel access.");
      navigate("/admin-settings");
      return;
    }
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, [navigate, isAuthenticated, user?.id, isMainAdmin, authLoading]);

  const configsByDepartment = useMemo(() => {
    const map = new Map<string, { departmentName: string; departmentCode?: string | null; rows: AdminPanelRoleConfig[] }>();
    for (const row of configs) {
      const key = String(row.department);
      const existing = map.get(key);
      if (existing) {
        existing.rows.push(row);
      } else {
        map.set(key, {
          departmentName: row.department_name || `Department #${row.department}`,
          departmentCode: row.department_code,
          rows: [row],
        });
      }
    }
    return Array.from(map.entries())
      .map(([id, group]) => ({ departmentId: id, ...group }))
      .sort((a, b) => a.departmentName.localeCompare(b.departmentName));
  }, [configs]);

  const selectedDepartment = useMemo(
    () => departments.find((d) => String(d.id) === selectedDepartmentId) ?? null,
    [departments, selectedDepartmentId]
  );
  const selectedUserTypeLabel = useMemo(
    () => userTypes.find((t) => t.value === selectedUserType)?.label ?? selectedUserType,
    [userTypes, selectedUserType]
  );

  const openCreate = () => {
    setEditingId(null);
    setAdminPanelEnabled(false);
    setSelectedModuleKeys(new Set());
    if (!selectedDepartmentId && departments[0]) {
      setSelectedDepartmentId(String(departments[0].id));
    }
    if (!selectedUserType && userTypes[0]) {
      setSelectedUserType(userTypes[0].value);
    }
    setEditorOpen(true);
    scrollToEditor();
  };

  const openEdit = (row: AdminPanelRoleConfig) => {
    setEditingId(row.id);
    setSelectedDepartmentId(String(row.department));
    setSelectedUserType(row.user_type);
    setAdminPanelEnabled(!!row.admin_panel_enabled);
    setSelectedModuleKeys(new Set(row.module_keys ?? []));
    setEditorOpen(true);
    scrollToEditor();
  };

  const handleToggleSubtree = (node: AdminPanelModuleNode, checked: boolean) => {
    setSelectedModuleKeys((prev) => {
      const next = new Set(prev);
      for (const key of collectKeys(node)) {
        if (checked) next.add(key);
        else next.delete(key);
      }
      // If a child was unchecked, drop ancestor keys so a leftover parent cannot
      // re-expand to every sibling on save/read.
      if (!checked) {
        const parts = node.key.split(".");
        for (let i = parts.length - 1; i >= 1; i -= 1) {
          next.delete(parts.slice(0, i).join("."));
        }
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!selectedDepartmentId || !selectedUserType) {
      toast.error("Select a department and user type first.");
      return;
    }
    setSaving(true);
    try {
      // Always upsert by (user_type, department) — never create a duplicate row.
      const res = await apiClient.upsertAdminPanelRoleConfig({
        user_type: selectedUserType,
        department: Number(selectedDepartmentId),
        admin_panel_enabled: adminPanelEnabled,
        module_keys: Array.from(selectedModuleKeys),
      });
      if (res.error || !res.data) {
        toast.error(res.error || "Failed to save configuration.");
        return;
      }
      setEditingId(res.data.id);
      toast.success(
        adminPanelEnabled
          ? "Admin Panel access configuration saved."
          : "Admin Panel access disabled for this user type and department."
      );
      setEditorOpen(false);
      await loadAll();
    } finally {
      setSaving(false);
    }
  };

  if (!isMainAdmin && !authLoading) return null;

  if (loading) {
    return (
      <div className="page-shell flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="page-shell">
      <DashboardHeader />
      <main className="container mx-auto max-w-5xl px-4 py-8 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Button variant="ghost" size="sm" onClick={() => navigate("/admin-settings")} className="mb-2">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Admin Settings
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">Admin Panel Access</h1>
            <p className="mt-1 text-muted-foreground">
              Enable Admin Panel access per user type and department, and choose which modules they may use.
              Access is disabled by default.
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            New configuration
          </Button>
        </div>

        {configsByDepartment.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No configurations yet</CardTitle>
              <CardDescription>
                Create a configuration to grant Admin Panel access to a user type in a department.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          configsByDepartment.map((group) => (
            <Card key={group.departmentId}>
              <CardHeader>
                <CardTitle className="text-xl">
                  {group.departmentName}
                  {group.departmentCode ? (
                    <span className="ml-2 text-base font-normal text-muted-foreground">
                      ({group.departmentCode})
                    </span>
                  ) : null}
                </CardTitle>
                <CardDescription>
                  {group.rows.length} user type configuration{group.rows.length === 1 ? "" : "s"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {group.rows
                  .slice()
                  .sort((a, b) => (a.user_type_label || a.user_type).localeCompare(b.user_type_label || b.user_type))
                  .map((row) => (
                    <div
                      key={row.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3"
                    >
                      <div className="space-y-1 min-w-0">
                        <p className="font-medium">
                          {row.user_type_label || row.user_type}
                          <span className="ml-2 text-xs text-muted-foreground font-normal">
                            ({row.user_type})
                          </span>
                        </p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          {row.admin_panel_enabled ? (
                            <Badge variant="default">Admin Panel enabled</Badge>
                          ) : (
                            <Badge variant="secondary">Admin Panel disabled</Badge>
                          )}
                          <span>
                            {(row.module_keys?.length ?? 0)} module key
                            {(row.module_keys?.length ?? 0) === 1 ? "" : "s"} selected
                          </span>
                        </div>
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={() => openEdit(row)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                    </div>
                  ))}
              </CardContent>
            </Card>
          ))
        )}

        {editorOpen ? (
          <div ref={editorRef} id="admin-panel-access-editor" className="scroll-mt-24">
          <Card className="border-primary/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <ShieldCheck className="h-5 w-5" />
                {editingId ? "Edit configuration" : "New configuration"}
              </CardTitle>
              <CardDescription>
                {selectedUserTypeLabel || "User type"} @ {selectedDepartment?.name || "department"}
                {editingId ? ` (id ${editingId})` : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select
                    value={selectedDepartmentId}
                    onValueChange={setSelectedDepartmentId}
                    disabled={editingId != null}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((d) => (
                        <SelectItem key={d.id} value={String(d.id)}>
                          {d.name} {d.code ? `(${d.code})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {editingId != null ? (
                    <p className="text-xs text-muted-foreground">
                      Department is fixed when editing; create a new configuration for another department.
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label>User Type</Label>
                  <Select
                    value={selectedUserType}
                    onValueChange={setSelectedUserType}
                    disabled={editingId != null}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select user type" />
                    </SelectTrigger>
                    <SelectContent>
                      {userTypes.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-lg border px-4 py-3">
                <div className="flex-1">
                  <p className="text-sm font-medium">Admin Panel accessible</p>
                  <p className="text-xs text-muted-foreground">
                    When off, users of this type in this department cannot open Admin Settings or call Admin Panel
                    APIs.
                  </p>
                </div>
                <Switch checked={adminPanelEnabled} onCheckedChange={setAdminPanelEnabled} />
              </div>

              {adminPanelEnabled ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium">Modules</p>
                    <p className="text-xs text-muted-foreground">
                      Selecting a parent selects all children. Grants also unlock the matching backend permissions
                      (e.g. Bookings → bookings.manage).
                    </p>
                  </div>
                  <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                    {moduleTree
                      .filter((n) => !n.main_admin_only)
                      .map((node) => (
                        <ModuleTreeNode
                          key={node.key}
                          node={node}
                          depth={0}
                          selected={selectedModuleKeys}
                          onToggleSubtree={handleToggleSubtree}
                        />
                      ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Turn on Admin Panel access to choose modules. Saving while disabled keeps the record and clears
                  effective access without creating a duplicate.
                </p>
              )}

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditorOpen(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button type="button" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Save
                </Button>
              </div>
            </CardContent>
          </Card>
          </div>
        ) : null}
      </main>
    </div>
  );
}
