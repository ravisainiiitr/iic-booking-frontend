import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import DashboardHeader from "@/components/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api";
import { ArrowLeft, CreditCard, Loader2, RefreshCw, Save } from "lucide-react";

type FacilitySettings = {
  department_id: number;
  department_name: string;
  enabled: boolean;
  joining_date_cutoff: string | null;
  max_credit_limit: string;
  updated_at?: string | null;
  updated_by_email?: string | null;
};

type FacilityRow = {
  id: number | null;
  faculty_user_id: number;
  faculty_name: string;
  faculty_email: string;
  joining_date: string | null;
  status: string;
  status_display: string;
  credit_limit: string;
  wallet_balance: string;
  outstanding_credit: string;
  remaining_credit: string;
  availed_at: string | null;
  closed_at: string | null;
};

type AuditRow = {
  id: number;
  event_type: string;
  event_type_display: string;
  message: string;
  faculty_email: string | null;
  faculty_name: string | null;
  actor_email: string | null;
  created_at: string | null;
};

function statusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "available":
      return "outline";
    case "active":
      return "default";
    case "exhausted":
      return "secondary";
    case "closed":
      return "destructive";
    default:
      return "outline";
  }
}

export default function DepartmentFacultyCreditFacilityPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const userType = String(user?.user_type ?? "").toLowerCase();
  const isAdmin = userType === "admin";
  const isDeptAdmin = userType === "dept_admin";

  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([]);
  const [departmentId, setDepartmentId] = useState<string>("");
  const [settings, setSettings] = useState<FacilitySettings | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [cutoff, setCutoff] = useState("");
  const [limit, setLimit] = useState("10000");
  const [facultyRows, setFacultyRows] = useState<FacilityRow[]>([]);
  const [auditRows, setAuditRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !user) {
      navigate("/auth");
      return;
    }
    if (!isAdmin && !isDeptAdmin) {
      toast.error("Only Department Administrators or Institute Admins can manage Faculty Credit Facility.");
      navigate("/dashboard");
    }
  }, [authLoading, isAuthenticated, user?.id, isAdmin, isDeptAdmin, navigate]);

  useEffect(() => {
    if (!isAdmin) {
      if (user?.department) {
        setDepartmentId(String(user.department));
      }
      return;
    }
    void (async () => {
      const res = await apiClient.adminList<{ id: number; name: string }>("departments", {
        page_size: "500",
      });
      if (res.error || !res.data) return;
      const list = Array.isArray(res.data)
        ? res.data
        : Array.isArray((res.data as { results?: unknown }).results)
          ? ((res.data as { results: { id: number; name: string }[] }).results)
          : [];
      setDepartments(list.map((d) => ({ id: d.id, name: d.name })));
      if (list.length && !departmentId) setDepartmentId(String(list[0].id));
    })();
  }, [isAdmin, user?.department]);

  const loadAll = useCallback(async () => {
    if (!departmentId && isAdmin) return;
    if (!isAdmin && !user?.department) return;
    setLoading(true);
    try {
      const params = isAdmin ? { department_id: Number(departmentId) } : undefined;
      const [sRes, fRes, aRes] = await Promise.all([
        apiClient.getDepartmentFacultyCreditFacilitySettings(params),
        apiClient.getDepartmentFacultyCreditFacilityFaculty(params),
        apiClient.getDepartmentFacultyCreditFacilityAudit(params),
      ]);
      if (sRes.error || !sRes.data) {
        toast.error(sRes.error || "Failed to load settings");
        return;
      }
      setSettings(sRes.data);
      setEnabled(!!sRes.data.enabled);
      setCutoff(sRes.data.joining_date_cutoff || "");
      setLimit(sRes.data.max_credit_limit || "0");
      setFacultyRows(fRes.data?.results || []);
      setAuditRows(aRes.data?.results || []);
    } finally {
      setLoading(false);
    }
  }, [departmentId, isAdmin, user?.department]);

  useEffect(() => {
    if (!isAdmin && !isDeptAdmin) return;
    if (isAdmin && !departmentId) return;
    if (!isAdmin && !user?.department) return;
    void loadAll();
  }, [loadAll, isAdmin, isDeptAdmin, departmentId, user?.department]);

  const hubPath = useMemo(
    () => (isAdmin ? "/admin/department-administration" : "/manage/department-administration"),
    [isAdmin]
  );

  const onSave = async () => {
    setSaving(true);
    try {
      const payload = {
        enabled,
        joining_date_cutoff: cutoff || null,
        max_credit_limit: limit,
        ...(isAdmin ? { department_id: Number(departmentId) } : {}),
      };
      const res = await apiClient.updateDepartmentFacultyCreditFacilitySettings(payload);
      if (res.error || !res.data) {
        toast.error(res.error || "Failed to save settings");
        return;
      }
      toast.success("Credit facility settings saved");
      setSettings(res.data);
      await loadAll();
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin && !isDeptAdmin && !authLoading) return null;

  return (
    <div className="page-shell">
      <DashboardHeader />
      <main className="container mx-auto max-w-6xl px-4 py-8 space-y-6">
        <div>
          <Button variant="ghost" size="sm" className="mb-2" onClick={() => navigate(hubPath)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Department Administration
          </Button>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <CreditCard className="h-8 w-8" />
            Faculty Credit Facility
          </h1>
          <p className="mt-1 text-muted-foreground">
            Allow newly joined faculty a one-time controlled negative balance on this department&apos;s
            sub-wallet. No money is deposited upfront; recharges recover outstanding credit first.
          </p>
        </div>

        {isAdmin ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Department</CardTitle>
              <CardDescription>Select which department&apos;s facility to configure.</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger className="max-w-md">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Configuration</CardTitle>
              <CardDescription>
                {settings?.department_name
                  ? `Department: ${settings.department_name}`
                  : "Enable and set eligibility for your department."}
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => void loadAll()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="ml-2">Refresh</span>
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
              <div>
                <Label htmlFor="cf-enabled" className="text-base">
                  Credit Facility
                </Label>
                <p className="text-sm text-muted-foreground">
                  When disabled, joining date and credit limit have no effect.
                </p>
              </div>
              <Switch id="cf-enabled" checked={enabled} onCheckedChange={setEnabled} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cf-cutoff">Eligible Date of Joining (on or after)</Label>
                <Input
                  id="cf-cutoff"
                  type="date"
                  value={cutoff}
                  onChange={(e) => setCutoff(e.target.value)}
                  disabled={!enabled}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cf-limit">Maximum Credit Limit (₹)</Label>
                <Input
                  id="cf-limit"
                  type="number"
                  min={0}
                  step={1}
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                  disabled={!enabled}
                />
              </div>
            </div>

            {settings?.updated_at ? (
              <p className="text-xs text-muted-foreground">
                Last updated {new Date(settings.updated_at).toLocaleString()}
                {settings.updated_by_email ? ` by ${settings.updated_by_email}` : ""}
              </p>
            ) : null}

            <Button onClick={() => void onSave()} disabled={saving || loading}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save settings
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Faculty status</CardTitle>
            <CardDescription>
              Available (eligible, not yet used), Active, Exhausted, or Closed (one-time, permanent).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Faculty</TableHead>
                    <TableHead>Joining</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Limit</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead className="text-right">Remaining</TableHead>
                    <TableHead>Availed</TableHead>
                    <TableHead>Closed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {facultyRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                        No faculty rows for this department yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    facultyRows.map((row) => (
                      <TableRow key={`${row.status}-${row.faculty_user_id}-${row.id ?? "a"}`}>
                        <TableCell>
                          <div className="font-medium">{row.faculty_name}</div>
                          <div className="text-xs text-muted-foreground">{row.faculty_email}</div>
                        </TableCell>
                        <TableCell>{row.joining_date || "—"}</TableCell>
                        <TableCell>
                          <Badge variant={statusBadgeVariant(row.status)}>{row.status_display}</Badge>
                        </TableCell>
                        <TableCell className="text-right">₹{row.credit_limit}</TableCell>
                        <TableCell className="text-right">₹{row.wallet_balance}</TableCell>
                        <TableCell className="text-right">₹{row.outstanding_credit}</TableCell>
                        <TableCell className="text-right">₹{row.remaining_credit}</TableCell>
                        <TableCell>
                          {row.availed_at ? new Date(row.availed_at).toLocaleDateString() : "—"}
                        </TableCell>
                        <TableCell>
                          {row.closed_at ? new Date(row.closed_at).toLocaleDateString() : "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Audit trail</CardTitle>
            <CardDescription>Configuration changes, activations, recoveries, and closures.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Faculty</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Message</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No audit events yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    auditRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-nowrap">
                          {row.created_at ? new Date(row.created_at).toLocaleString() : "—"}
                        </TableCell>
                        <TableCell>{row.event_type_display}</TableCell>
                        <TableCell>{row.faculty_name || row.faculty_email || "—"}</TableCell>
                        <TableCell>{row.actor_email || "—"}</TableCell>
                        <TableCell className="max-w-md text-sm text-muted-foreground">{row.message}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
