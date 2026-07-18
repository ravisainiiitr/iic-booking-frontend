import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardHeader from "@/components/DashboardHeader";
import { apiClient } from "@/lib/api";
import { getUserTypeDisplayName } from "@/lib/userTypes";
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
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";

type CurrentUser = {
  id: number;
  user_type?: string | null;
  department?: number | null;
  department_name?: string | null;
};

type DepartmentRow = {
  id: number;
  name: string;
  code?: string | null;
  department_type?: string | null;
  access_enabled?: boolean;
};

type UserRow = {
  id: number;
  name?: string;
  email?: string;
  user_type?: string | null;
  department?: number | null;
};

type PermissionRow = {
  id: number;
  code: string;
  name: string;
  description?: string;
};

export default function DepartmentRbacManagement() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [savingCaps, setSavingCaps] = useState(false);
  const [savingStaff, setSavingStaff] = useState(false);
  const [savingDepartment, setSavingDepartment] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [permissions, setPermissions] = useState<PermissionRow[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>("");
  const [selectedDeptAdminId, setSelectedDeptAdminId] = useState<string>("");
  const [selectedStaffUserId, setSelectedStaffUserId] = useState<string>("");
  const [deptAdminPermissionCodes, setDeptAdminPermissionCodes] = useState<string[]>([]);
  const [staffPermissionCodes, setStaffPermissionCodes] = useState<string[]>([]);

  const isMainAdmin = String(currentUser?.user_type ?? "").toLowerCase() === "admin";
  const isDeptAdmin = String(currentUser?.user_type ?? "").toLowerCase() === "dept_admin";

  const selectedDepartment = useMemo(
    () => departments.find((department) => String(department.id) === selectedDepartmentId) ?? null,
    [departments, selectedDepartmentId]
  );

  const departmentUsers = useMemo(
    () => users.filter((user) => String(user.department ?? "") === selectedDepartmentId),
    [users, selectedDepartmentId]
  );

  const deptAdminUsers = useMemo(
    () => departmentUsers.filter((user) => String(user.user_type ?? "").toLowerCase() === "dept_admin"),
    [departmentUsers]
  );

  const staffUsers = useMemo(
    () =>
      departmentUsers.filter((user) =>
        ["manager", "operator", "finance"].includes(String(user.user_type ?? "").toLowerCase())
      ),
    [departmentUsers]
  );

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const currentUserRes = await apiClient.getCurrentUser();
        if (currentUserRes.error || !currentUserRes.data) {
          navigate("/auth");
          return;
        }
        const current = currentUserRes.data as CurrentUser;
        const userType = String(current.user_type ?? "").toLowerCase();
        if (!["admin", "dept_admin"].includes(userType)) {
          toast({ title: "Access denied", description: "RBAC management is available only to Main Admin and Department Admin.", variant: "destructive" });
          navigate("/dashboard");
          return;
        }
        setCurrentUser(current);

        const [departmentsRes, usersRes, permissionsRes] = await Promise.all([
          apiClient.adminList<DepartmentRow>("departments"),
          apiClient.adminList<UserRow>("users"),
          apiClient.listPermissionDefinitions(),
        ]);

        const loadedDepartments = Array.isArray(departmentsRes.data) ? departmentsRes.data : [];
        const loadedUsers = Array.isArray(usersRes.data) ? usersRes.data : [];
        const loadedPermissions = Array.isArray(permissionsRes.data) ? permissionsRes.data : [];

        setDepartments(loadedDepartments.filter((department) => department.department_type === "internal"));
        setUsers(loadedUsers);
        setPermissions(loadedPermissions);

        const initialDepartmentId =
          userType === "dept_admin"
            ? String(current.department ?? "")
            : String(
                loadedDepartments.find((department) => department.department_type === "internal")?.id ?? ""
              );
        setSelectedDepartmentId(initialDepartmentId);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [navigate, toast]);

  useEffect(() => {
    if (!selectedDepartmentId) {
      setSelectedDeptAdminId("");
      setSelectedStaffUserId("");
      return;
    }
    if (isDeptAdmin && currentUser?.id) {
      setSelectedDeptAdminId(String(currentUser.id));
      return;
    }
    const firstDeptAdmin = deptAdminUsers[0];
    setSelectedDeptAdminId(firstDeptAdmin ? String(firstDeptAdmin.id) : "");
  }, [selectedDepartmentId, isDeptAdmin, currentUser?.id, deptAdminUsers]);

  useEffect(() => {
    const loadDeptAdminCaps = async () => {
      if (!selectedDeptAdminId) {
        setDeptAdminPermissionCodes([]);
        return;
      }
      const res = await apiClient.listDeptAdminGrants({ dept_admin_id: selectedDeptAdminId, department_id: selectedDepartmentId || undefined });
      if (res.error || !Array.isArray(res.data)) {
        setDeptAdminPermissionCodes([]);
        return;
      }
      setDeptAdminPermissionCodes(res.data.map((row) => row.permission_code));
    };
    loadDeptAdminCaps();
  }, [selectedDeptAdminId, selectedDepartmentId]);

  useEffect(() => {
    const loadStaffGrants = async () => {
      if (!selectedStaffUserId) {
        setStaffPermissionCodes([]);
        return;
      }
      const res = await apiClient.listStaffPermissionGrants({ staff_user_id: selectedStaffUserId, department_id: selectedDepartmentId || undefined });
      if (res.error || !Array.isArray(res.data)) {
        setStaffPermissionCodes([]);
        return;
      }
      setStaffPermissionCodes(res.data.map((row) => row.permission_code));
    };
    loadStaffGrants();
  }, [selectedStaffUserId, selectedDepartmentId]);

  const toggleCode = (codes: string[], code: string, enabled: boolean) => {
    if (enabled) return Array.from(new Set([...codes, code]));
    return codes.filter((item) => item !== code);
  };

  const saveDepartmentAccess = async (enabled: boolean) => {
    if (!selectedDepartment || !isMainAdmin) return;
    setSavingDepartment(true);
    try {
      const res = await apiClient.adminPatch("departments", selectedDepartment.id, { access_enabled: enabled });
      if (res.error) {
        toast({ title: "Update failed", description: res.error, variant: "destructive" });
        return;
      }
      setDepartments((prev) =>
        prev.map((department) =>
          department.id === selectedDepartment.id ? { ...department, access_enabled: enabled } : department
        )
      );
      toast({ title: "Department updated", description: `Access ${enabled ? "enabled" : "disabled"} for ${selectedDepartment.name}.` });
    } finally {
      setSavingDepartment(false);
    }
  };

  const saveDeptAdminCaps = async () => {
    if (!selectedDeptAdminId || !isMainAdmin) return;
    setSavingCaps(true);
    try {
      const res = await apiClient.syncDeptAdminGrants({
        dept_admin_id: selectedDeptAdminId,
        permission_codes: deptAdminPermissionCodes,
      });
      if (res.error) {
        toast({ title: "Save failed", description: res.error, variant: "destructive" });
        return;
      }
      toast({ title: "Permission caps saved", description: "Department Administrator caps were updated." });
    } finally {
      setSavingCaps(false);
    }
  };

  const saveStaffGrants = async () => {
    if (!selectedStaffUserId) return;
    setSavingStaff(true);
    try {
      const res = await apiClient.syncStaffPermissionGrants({
        staff_user_id: selectedStaffUserId,
        permission_codes: staffPermissionCodes,
      });
      if (res.error) {
        toast({ title: "Save failed", description: res.error, variant: "destructive" });
        return;
      }
      toast({ title: "Staff permissions saved", description: "Subordinate grants were updated." });
    } finally {
      setSavingStaff(false);
    }
  };

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
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate("/admin/section/users")}>
            Users
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate("/admin/section/equipment")}>
            Equipment
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate("/admin/equipment-addition-requests")}>
            Equipment Requests
          </Button>
        </div>

        <div>
          <h1 className="text-3xl font-bold tracking-tight">Department RBAC</h1>
          <p className="mt-1 text-muted-foreground">
            {isMainAdmin
              ? "Appoint Department Administrators, cap their permissions, and control department access."
              : "Grant subordinate permissions within the caps assigned to your department."}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <ShieldCheck className="h-5 w-5" />
              Department scope
            </CardTitle>
            <CardDescription>Select the internal department you want to manage.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <div className="space-y-2">
              <Label>Department</Label>
              <Select value={selectedDepartmentId} onValueChange={setSelectedDepartmentId} disabled={isDeptAdmin}>
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((department) => (
                    <SelectItem key={department.id} value={String(department.id)}>
                      {department.name} {department.code ? `(${department.code})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isMainAdmin && selectedDepartment ? (
              <div className="flex items-center gap-3 rounded-lg border px-4 py-3">
                <div>
                  <p className="text-sm font-medium">Department access</p>
                  <p className="text-xs text-muted-foreground">Disable admin-panel access for all department staff.</p>
                </div>
                <Switch
                  checked={!!selectedDepartment.access_enabled}
                  disabled={savingDepartment}
                  onCheckedChange={saveDepartmentAccess}
                />
              </div>
            ) : null}
          </CardContent>
        </Card>

        {isMainAdmin ? (
          <Card>
            <CardHeader>
              <CardTitle>Department Administrator Caps</CardTitle>
              <CardDescription>
                Choose a `dept_admin` user for the selected department, then define the maximum permissions they can grant further down.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label>Department Administrator</Label>
                <Select value={selectedDeptAdminId} onValueChange={setSelectedDeptAdminId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Department Administrator" />
                  </SelectTrigger>
                  <SelectContent>
                    {deptAdminUsers.map((user) => (
                      <SelectItem key={user.id} value={String(user.id)}>
                        {user.name || user.email} ({user.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {permissions.map((permission) => {
                  const checked = deptAdminPermissionCodes.includes(permission.code);
                  return (
                    <label key={permission.code} className="flex items-start gap-3 rounded-lg border p-3">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) =>
                          setDeptAdminPermissionCodes((prev) => toggleCode(prev, permission.code, value === true))
                        }
                      />
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{permission.name}</p>
                        <p className="text-xs text-muted-foreground">{permission.code}</p>
                        {permission.description ? <p className="text-xs text-muted-foreground">{permission.description}</p> : null}
                      </div>
                    </label>
                  );
                })}
              </div>
              <div className="flex justify-end">
                <Button onClick={saveDeptAdminCaps} disabled={!selectedDeptAdminId || savingCaps}>
                  {savingCaps ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save caps
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Subordinate Grants</CardTitle>
            <CardDescription>
              Pick an OIC, Lab In-Charge, or Accounts user and grant only the permissions allowed by the department cap.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Staff user</Label>
              <Select value={selectedStaffUserId} onValueChange={setSelectedStaffUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select staff user" />
                </SelectTrigger>
                <SelectContent>
                  {staffUsers.map((user) => (
                    <SelectItem key={user.id} value={String(user.id)}>
                      {(user.name || user.email) ?? "User"} ({getUserTypeDisplayName(user.user_type || "")})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {permissions.map((permission) => {
                const allowedByCap = deptAdminPermissionCodes.includes(permission.code);
                const checked = staffPermissionCodes.includes(permission.code);
                return (
                  <label key={permission.code} className="flex items-start gap-3 rounded-lg border p-3">
                    <Checkbox
                      checked={checked}
                      disabled={!allowedByCap}
                      onCheckedChange={(value) =>
                        setStaffPermissionCodes((prev) => toggleCode(prev, permission.code, value === true))
                      }
                    />
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{permission.name}</p>
                      <p className="text-xs text-muted-foreground">{permission.code}</p>
                    </div>
                  </label>
                );
              })}
            </div>
            <div className="flex justify-end">
              <Button onClick={saveStaffGrants} disabled={!selectedStaffUserId || savingStaff}>
                {savingStaff ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save staff grants
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
