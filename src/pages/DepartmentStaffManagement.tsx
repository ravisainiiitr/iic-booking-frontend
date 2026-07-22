import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import DashboardHeader from "@/components/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api";
import { ArrowLeft, Loader2, Pencil, Plus, UserPlus } from "lucide-react";

type StaffRoleKey = "oic" | "lab" | "accounts";

const ROLE_CONFIG: Record<
  StaffRoleKey,
  { userType: string; title: string; assignPermission: string; description: string }
> = {
  oic: {
    userType: "manager",
    title: "Officer In Charge",
    assignPermission: "oic.assign",
    description: "Create, map Channel-i users, edit, and activate/deactivate within your department only.",
  },
  lab: {
    userType: "operator",
    title: "Lab In Charge",
    assignPermission: "lab.assign",
    description: "Create, map Channel-i users, edit, and activate/deactivate within your department only.",
  },
  accounts: {
    userType: "finance",
    title: "Accounts In Charge",
    assignPermission: "finance.assign",
    description:
      "The Department Account In-charge monitors and manages all financial activities for the assigned department — including wallet recharge requests, grant utilization, wallet transactions, credit facility usage, and other department-specific financial records.",
  },
};

type StaffUser = {
  id: number;
  name?: string;
  email?: string;
  user_type?: string;
  is_active?: boolean;
  force_inactive?: boolean;
  admin_approved?: boolean;
  department?: number | null;
  department_name?: string | null;
};

type MappableUser = {
  id: number;
  name?: string;
  email?: string;
  user_type?: string;
  user_type_display?: string;
};

export default function DepartmentStaffManagement() {
  const { role } = useParams<{ role: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const userType = String(user?.user_type ?? "").toLowerCase();
  const isAdmin = userType === "admin";
  const isDeptAdmin = userType === "dept_admin";
  const roleKey = (role || "") as StaffRoleKey;
  const config = ROLE_CONFIG[roleKey];

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<StaffUser[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<StaffUser | null>(null);
  const [createForm, setCreateForm] = useState({
    email: "",
    name: "",
    password: "",
    password_confirm: "",
  });
  const [editForm, setEditForm] = useState({ name: "", email: "", active: true });
  const [mappable, setMappable] = useState<MappableUser[]>([]);
  const [mapUserId, setMapUserId] = useState<string>("");
  const [mappableLoading, setMappableLoading] = useState(false);

  const departmentId = user?.department_id != null ? Number(user.department_id) : null;

  const loadList = useCallback(async () => {
    if (!config) return;
    setLoading(true);
    try {
      const res = await apiClient.adminList("users", {
        user_type: config.userType,
        page_size: "200",
      });
      if (res.error) {
        toast.error(res.error);
        setRows([]);
        return;
      }
      const data = res.data as { results?: StaffUser[] } | StaffUser[] | null;
      const list = Array.isArray(data) ? data : data?.results ?? [];
      setRows(list);
    } finally {
      setLoading(false);
    }
  }, [config]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !user) {
      navigate("/auth");
      return;
    }
    if (!isAdmin && !isDeptAdmin) {
      toast.error("Access denied.");
      navigate("/dashboard");
      return;
    }
    if (!config) {
      toast.error("Unknown staff module.");
      navigate("/manage/department-administration");
      return;
    }
    void loadList();
  }, [authLoading, isAuthenticated, user?.id, isAdmin, isDeptAdmin, config, navigate, loadList]);

  const loadMappable = useCallback(async () => {
    setMappableLoading(true);
    try {
      const res = await apiClient.listMappableOmniportUsers();
      if (res.error) {
        toast.error(res.error);
        setMappable([]);
        return;
      }
      const raw = res.data as MappableUser[] | { results?: MappableUser[] } | null;
      setMappable(Array.isArray(raw) ? raw : raw?.results ?? []);
    } finally {
      setMappableLoading(false);
    }
  }, []);

  const openMap = () => {
    setMapUserId("");
    setMapOpen(true);
    void loadMappable();
  };

  const handleCreate = async () => {
    if (!config) return;
    if (!departmentId && !isAdmin) {
      toast.error("Your account has no department assigned.");
      return;
    }
    if (!departmentId && isAdmin) {
      toast.error("Main Admin: create staff from User Management with an explicit department.");
      return;
    }
    if (!createForm.email.trim() || !createForm.name.trim() || !createForm.password) {
      toast.error("Email, name, and password are required.");
      return;
    }
    if (createForm.password !== createForm.password_confirm) {
      toast.error("Passwords do not match.");
      return;
    }
    setSaving(true);
    try {
      const res = await apiClient.adminCreate("users", {
        email: createForm.email.trim().toLowerCase(),
        name: createForm.name.trim(),
        password: createForm.password,
        user_type: config.userType,
        department: departmentId,
        admin_approved: true,
        email_verified: true,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`${config.title} created.`);
      setCreateOpen(false);
      setCreateForm({ email: "", name: "", password: "", password_confirm: "" });
      await loadList();
    } finally {
      setSaving(false);
    }
  };

  const handleMap = async () => {
    if (!config || !mapUserId) {
      toast.error("Select a Channel-i user to map.");
      return;
    }
    setSaving(true);
    try {
      const res = await apiClient.mapUserStaffRole(Number(mapUserId), config.userType);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`Mapped as ${config.title}.`);
      setMapOpen(false);
      await loadList();
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (row: StaffUser) => {
    setEditing(row);
    setEditForm({
      name: row.name || "",
      email: row.email || "",
      active: row.is_active !== false && row.force_inactive !== true,
    });
    setEditOpen(true);
  };

  const handleEditSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await apiClient.adminUpdate("users", editing.id, {
        name: editForm.name.trim(),
        email: editForm.email.trim().toLowerCase(),
        force_inactive: !editForm.active,
        admin_approved: true,
        ...(editForm.active ? { send_activation_email: true } : {}),
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("User updated.");
      setEditOpen(false);
      setEditing(null);
      await loadList();
    } finally {
      setSaving(false);
    }
  };

  const handleActivateToggle = async (row: StaffUser, activate: boolean) => {
    setSaving(true);
    try {
      const res = await apiClient.adminUpdate("users", row.id, {
        force_inactive: !activate,
        admin_approved: true,
        email_verified: true,
        ...(activate ? { send_activation_email: true } : {}),
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(activate ? "User activated." : "User deactivated.");
      await loadList();
    } finally {
      setSaving(false);
    }
  };

  const title = useMemo(() => (config ? `Manage ${config.title}` : "Staff"), [config]);

  if (!config) return null;
  if (!isAdmin && !isDeptAdmin && !authLoading) return null;

  return (
    <div className="page-shell">
      <DashboardHeader />
      <main className="container mx-auto max-w-5xl px-4 py-8 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Button
              variant="ghost"
              size="sm"
              className="mb-2"
              onClick={() => navigate("/manage/department-administration")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Department Administration
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
            <p className="mt-1 text-muted-foreground max-w-2xl">{config.description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={openMap}>
              <UserPlus className="h-4 w-4 mr-2" />
              Map Channel-i user
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create {config.title}
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{config.title} users</CardTitle>
            <CardDescription>{rows.length} in scope</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No users yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => {
                      const active = row.is_active !== false && row.force_inactive !== true;
                      return (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium">{row.name || "—"}</TableCell>
                          <TableCell>{row.email}</TableCell>
                          <TableCell>
                            <Badge variant={active ? "default" : "secondary"}>
                              {active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right space-x-2">
                            <Button size="sm" variant="outline" onClick={() => openEdit(row)}>
                              <Pencil className="h-3.5 w-3.5 mr-1" />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant={active ? "secondary" : "default"}
                              disabled={saving}
                              onClick={() => handleActivateToggle(row, !active)}
                            >
                              {active ? "Deactivate" : "Activate"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create {config.title}</DialogTitle>
              <DialogDescription>
                New account is created in your department as {config.userType}.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="space-y-1">
                <Label>Name</Label>
                <Input
                  value={createForm.name}
                  onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Password</Label>
                <Input
                  type="password"
                  value={createForm.password}
                  onChange={(e) => setCreateForm((p) => ({ ...p, password: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Confirm password</Label>
                <Input
                  type="password"
                  value={createForm.password_confirm}
                  onChange={(e) =>
                    setCreateForm((p) => ({ ...p, password_confirm: e.target.value }))
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={mapOpen} onOpenChange={setMapOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Map Channel-i user</DialogTitle>
              <DialogDescription>
                Assign an existing faculty/student in your department as {config.title}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-2">
              <Label>User</Label>
              {mappableLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Select value={mapUserId} onValueChange={setMapUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select user" />
                  </SelectTrigger>
                  <SelectContent>
                    {mappable.map((u) => (
                      <SelectItem key={u.id} value={String(u.id)}>
                        {u.name || u.email} ({u.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMapOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleMap} disabled={saving || !mapUserId}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Map role
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit {config.title}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="space-y-1">
                <Label>Name</Label>
                <Input
                  value={editForm.name}
                  onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select
                  value={editForm.active ? "active" : "inactive"}
                  onValueChange={(v) => setEditForm((p) => ({ ...p, active: v === "active" }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleEditSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
