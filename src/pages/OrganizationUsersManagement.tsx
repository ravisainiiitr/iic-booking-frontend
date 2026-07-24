import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardHeader from "@/components/DashboardHeader";
import { apiClient } from "@/lib/api";
import { getUserTypeDisplayName } from "@/lib/userTypes";
import { hasRbacPermission } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { ArrowLeft, Loader2, Users } from "lucide-react";

type OrgUser = {
  id: number;
  name?: string;
  email?: string;
  user_type?: string | null;
  is_active?: boolean;
  admin_approved?: boolean;
  department?: number | null;
};

const ORG_MEMBER_TYPES = [
  { value: "external", label: "Educational Institute" },
  { value: "rnd", label: "Govt R&D Organizations" },
  { value: "Industry", label: "Industry" },
  { value: "external_startup_msme", label: "External Startup/MSME" },
  { value: "other", label: "Other" },
];

export default function OrganizationUsersManagement() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [departmentId, setDepartmentId] = useState<number | null>(null);
  const [departmentName, setDepartmentName] = useState("");
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [userType, setUserType] = useState("external");
  const [password, setPassword] = useState("");

  const load = async () => {
    setLoading(true);
    const me = await apiClient.getCurrentUser();
    if (me.error || !me.data) {
      navigate("/auth");
      return;
    }
    const ut = String(me.data.user_type ?? "").toLowerCase();
    if (ut !== "org_admin" && ut !== "admin") {
      toast({
        title: "Access Denied",
        description: "Only Organization Administrators can manage organization users.",
        variant: "destructive",
      });
      navigate("/dashboard");
      return;
    }
    if (ut === "org_admin" && !hasRbacPermission(me.data, "org.users.manage")) {
      toast({
        title: "Access Denied",
        description: "Missing organization user management permission.",
        variant: "destructive",
      });
      navigate("/dashboard");
      return;
    }
    setAllowed(true);
    setDepartmentId(me.data.department ?? null);
    setDepartmentName(me.data.department_name || "Your organization");
    const list = await apiClient.adminList<OrgUser[]>("users");
    if (list.error) {
      toast({ title: "Failed to load users", description: list.error, variant: "destructive" });
      setUsers([]);
    } else {
      const rows = Array.isArray(list.data) ? list.data : (list.data as any)?.results ?? [];
      setUsers(rows as OrgUser[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const memberUsers = useMemo(
    () => users.filter((u) => String(u.user_type ?? "").toLowerCase() !== "org_admin"),
    [users]
  );

  const createUser = async () => {
    if (!departmentId) {
      toast({ title: "Missing organization", description: "Your account has no organization.", variant: "destructive" });
      return;
    }
    if (!name.trim() || !email.trim() || !password.trim()) {
      toast({ title: "Required fields", description: "Name, email, and password are required.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const res = await apiClient.adminCreate("users", {
      name: name.trim(),
      email: email.trim(),
      password,
      user_type: userType,
      department: departmentId,
      admin_approved: true,
      email_verified: true,
      is_active: true,
    });
    setSaving(false);
    if (res.error) {
      toast({ title: "Could not create user", description: res.error, variant: "destructive" });
      return;
    }
    toast({ title: "User created" });
    setName("");
    setEmail("");
    setPassword("");
    await load();
  };

  const toggleActive = async (user: OrgUser, next: boolean) => {
    const res = await apiClient.adminUpdate("users", user.id, {
      is_active: next,
      force_inactive: !next,
    });
    if (res.error) {
      toast({ title: "Update failed", description: res.error, variant: "destructive" });
      return;
    }
    setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, is_active: next } : u)));
  };

  if (!allowed || loading) {
    return (
      <div className="page-shell flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="page-shell flex flex-col">
      <DashboardHeader />
      <main className="flex-1 container mx-auto px-4 py-8 space-y-6">
        <div className="rounded-2xl bg-gradient-to-r from-slate-800 via-slate-700 to-primary p-6 text-white shadow-xl">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/dashboard")}
            className="mb-3 -ml-2 text-white/90 hover:text-white hover:bg-white/20"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Dashboard
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6" />
            Organization users
          </h1>
          <p className="mt-2 text-sm text-white/85">
            Manage members of {departmentName}. Organization Administrators cannot create other org admins here.
          </p>
        </div>

        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle>Add member</CardTitle>
            <CardDescription>New users are created inside your organization and marked approved.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="org-user-name">Name</Label>
              <Input id="org-user-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-user-email">Email</Label>
              <Input id="org-user-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>User type</Label>
              <Select value={userType} onValueChange={setUserType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORG_MEMBER_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-user-password">Temporary password</Label>
              <Input
                id="org-user-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <Button onClick={createUser} disabled={saving} className="bg-primary hover:bg-primary/90">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Create user
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle>Members ({memberUsers.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {memberUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No organization members yet.</p>
            ) : (
              memberUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{user.name || user.email}</div>
                    <div className="text-sm text-muted-foreground truncate">
                      {user.email} · {getUserTypeDisplayName(user.user_type)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Label htmlFor={`active-${user.id}`} className="text-sm">
                      Active
                    </Label>
                    <Switch
                      id={`active-${user.id}`}
                      checked={user.is_active !== false}
                      onCheckedChange={(v) => toggleActive(user, v)}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
