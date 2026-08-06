import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import DashboardHeader from "@/components/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Check,
  HardDrive,
  Loader2,
  RefreshCw,
  Shield,
  Trash2,
  X,
} from "lucide-react";

type Tab = "pending" | "devices" | "retired" | "audit" | "policies";

type PendingRow = {
  id: string;
  device_type?: string;
  display_name?: string;
  hostname?: string;
  department_id?: number | null;
  department_name?: string | null;
  application_version?: string;
  fingerprint?: string;
  first_seen?: string;
  created_at?: string;
  requested_workstation_role?: string;
  requested_equipment_id?: number | null;
  device_code?: string | null;
};

type DeviceRow = {
  id: string;
  device_type?: string;
  lifecycle?: string;
  display_name?: string;
  hostname?: string;
  department_name?: string | null;
  application_version?: string;
  last_heartbeat_at?: string | null;
  provisioned_at?: string | null;
  retired_at?: string | null;
};

type AuditRow = {
  id: string;
  action?: string;
  message?: string;
  device_id?: string | null;
  session_id?: string | null;
  actor?: string | null;
  created_at?: string;
};

type ConsoleSummary = {
  pending_installations: number;
  provisioning: number;
  active: number;
  suspended: number;
  revoked: number;
  retired: number;
};

type PolicyRow = {
  id?: number;
  department_id: number;
  department_name?: string | null;
  provisioning_mode: string;
  allowed_networks?: string[];
  require_mfa?: boolean;
  require_device_fingerprint?: boolean;
  maximum_pending_lifetime_hours?: number;
  auto_approve_existing_reinstalls?: boolean;
  audit_enabled?: boolean;
  exists?: boolean;
};

const MODE_LABELS: Record<string, string> = {
  manual_approval: "Manual Approval",
  trusted_auto_approve: "Trusted Auto-Approve",
  restricted_auto_approve: "Restricted Auto-Approve",
  device_code: "Device Code Approval",
};

function typeLabel(t?: string) {
  return (t || "—").replace(/_/g, " ");
}

export default function DeviceProvisioningPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userType = String(user?.user_type || "").toLowerCase();
  const canManage = userType === "admin" || Boolean(user?.is_superuser);

  const [tab, setTab] = useState<Tab>("pending");
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<ConsoleSummary | null>(null);
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [retired, setRetired] = useState<DeviceRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [policies, setPolicies] = useState<PolicyRow[]>([]);
  const [renameDraft, setRenameDraft] = useState<Record<string, string>>({});
  const [deptDraft, setDeptDraft] = useState<Record<string, string>>({});
  const [deviceCodeInput, setDeviceCodeInput] = useState("");
  const [policyDeptId, setPolicyDeptId] = useState("");
  const [policyDraft, setPolicyDraft] = useState<Partial<PolicyRow>>({});
  const [policySaving, setPolicySaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [c, p, d, r, a, pol] = await Promise.all([
      apiClient.getProvisioningConsole(),
      apiClient.getProvisioningPending(),
      apiClient.getProvisionedDevices(),
      apiClient.getRetiredDevices(),
      apiClient.getProvisioningAudit(),
      apiClient.getDepartmentProvisioningPolicies(),
    ]);
    if (c.error || p.error || d.error || r.error || a.error) {
      toast.error(c.error || p.error || d.error || r.error || a.error || "Failed to load");
    } else {
      setSummary(c.data as ConsoleSummary);
      setPending(((p.data as any)?.results || []) as PendingRow[]);
      setDevices(((d.data as any)?.results || []) as DeviceRow[]);
      setRetired(((r.data as any)?.results || []) as DeviceRow[]);
      setAudit(((a.data as any)?.results || []) as AuditRow[]);
      setPolicies(((pol.data as any)?.results || []) as PolicyRow[]);
    }
    if (pol.error) {
      // Policies endpoint may be empty on first deploy — non-fatal for other tabs.
      setPolicies([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!canManage) {
      navigate("/dashboard");
      return;
    }
    void load();
  }, [canManage, load, navigate]);

  const approve = async (row: PendingRow) => {
    const display_name = renameDraft[row.id] || row.display_name || row.hostname || undefined;
    const deptRaw = deptDraft[row.id];
    const department_id =
      deptRaw != null && deptRaw.trim() !== ""
        ? Number(deptRaw)
        : row.department_id ?? undefined;
    if (String(row.device_type || "").toLowerCase() === "dsa" && (department_id == null || Number.isNaN(department_id))) {
      toast.error("Assign a Department ID before approving a DSA installation");
      return;
    }
    if (department_id != null && !Number.isNaN(department_id) && department_id !== row.department_id) {
      const upd = await apiClient.updateProvisioningPending(row.id, { department_id });
      if (upd.error) {
        toast.error(upd.error);
        return;
      }
    }
    const res = await apiClient.approveProvisioningPending(row.id, {
      display_name,
      department_id: department_id != null && !Number.isNaN(department_id) ? department_id : undefined,
      workstation_role: row.requested_workstation_role || undefined,
      equipment_id: row.requested_equipment_id ?? undefined,
    });
    if (res.error) toast.error(res.error);
    else {
      toast.success("Approved — installer will claim automatically");
      void load();
    }
  };

  const reject = async (row: PendingRow) => {
    const res = await apiClient.rejectProvisioningPending(row.id, "Rejected from Pending Installations");
    if (res.error) toast.error(res.error);
    else {
      toast.success("Rejected");
      void load();
    }
  };

  const rename = async (row: PendingRow) => {
    const name = renameDraft[row.id];
    if (!name?.trim()) {
      toast.error("Enter a display name");
      return;
    }
    const res = await apiClient.updateProvisioningPending(row.id, { display_name: name.trim() });
    if (res.error) toast.error(res.error);
    else {
      toast.success("Renamed");
      void load();
    }
  };

  const lifecycle = async (deviceId: string, action: "suspend" | "revoke" | "retire") => {
    const fn =
      action === "suspend"
        ? apiClient.suspendProvisionedDevice
        : action === "revoke"
          ? apiClient.revokeProvisionedDevice
          : apiClient.retireProvisionedDevice;
    const res = await fn.call(apiClient, deviceId);
    if (res.error) toast.error(res.error);
    else {
      toast.success(`Device ${action}d`);
      void load();
    }
  };

  const approveByCode = async () => {
    const code = deviceCodeInput.trim();
    if (!code) {
      toast.error("Enter the device code shown on the installer");
      return;
    }
    const res = await apiClient.approveProvisioningByDeviceCode({ device_code: code });
    if (res.error) toast.error(res.error);
    else {
      toast.success("Approved via device code");
      setDeviceCodeInput("");
      void load();
    }
  };

  const loadPolicyForDept = async () => {
    const id = Number(policyDeptId);
    if (!id || Number.isNaN(id)) {
      toast.error("Enter a department ID");
      return;
    }
    const res = await apiClient.getDepartmentProvisioningPolicy(id);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setPolicyDraft(res.data as PolicyRow);
  };

  const savePolicy = async () => {
    const id = Number(policyDraft.department_id || policyDeptId);
    if (!id || Number.isNaN(id)) {
      toast.error("Department ID required");
      return;
    }
    setPolicySaving(true);
    const networks = Array.isArray(policyDraft.allowed_networks)
      ? policyDraft.allowed_networks
      : String((policyDraft as any).allowed_networks_text || "")
          .split(/[\n,;]+/)
          .map((s) => s.trim())
          .filter(Boolean);
    const res = await apiClient.updateDepartmentProvisioningPolicy(id, {
      provisioning_mode: policyDraft.provisioning_mode,
      allowed_networks: networks,
      require_mfa: Boolean(policyDraft.require_mfa),
      require_device_fingerprint: policyDraft.require_device_fingerprint !== false,
      maximum_pending_lifetime_hours: Number(policyDraft.maximum_pending_lifetime_hours || 24),
      auto_approve_existing_reinstalls: policyDraft.auto_approve_existing_reinstalls !== false,
      audit_enabled: policyDraft.audit_enabled !== false,
    });
    setPolicySaving(false);
    if (res.error) toast.error(res.error);
    else {
      toast.success("Provisioning policy saved");
      setPolicyDraft(res.data as PolicyRow);
      void load();
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <main className="container mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/dashboard">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Device Provisioning</h1>
              <p className="text-sm text-muted-foreground">
                Unified lifecycle for DSA, Equipment PC, Remote Analysis, and future device types
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/deployment-center">Deployment Center</Link>
            </Button>
            <Button variant="outline" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Refresh
            </Button>
          </div>
        </div>

        {summary ? (
          <div className="mb-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              ["Pending", summary.pending_installations],
              ["Provisioning", summary.provisioning],
              ["Active", summary.active],
              ["Suspended", summary.suspended],
              ["Revoked", summary.revoked],
              ["Retired", summary.retired],
            ].map(([label, value]) => (
              <Card key={String(label)}>
                <CardHeader className="pb-2 pt-4">
                  <CardDescription>{label}</CardDescription>
                  <CardTitle className="text-2xl">{value as number}</CardTitle>
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : null}

        <div className="mb-4 flex flex-wrap gap-2">
          {(
            [
              ["pending", "Pending Installations"],
              ["policies", "Device Provisioning Policies"],
              ["devices", "Provisioned Devices"],
              ["retired", "Retired Devices"],
              ["audit", "Audit"],
            ] as const
          ).map(([id, label]) => (
            <Button
              key={id}
              variant={tab === id ? "default" : "outline"}
              size="sm"
              onClick={() => setTab(id)}
            >
              {label}
            </Button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : null}

        {!loading && tab === "pending" ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="h-5 w-5" /> Pending Installations
              </CardTitle>
              <CardDescription>
                Approve or reject unknown devices. Secrets are never shown here — the installer claims automatically after approval.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="mb-4 flex flex-col gap-2 rounded-md border border-dashed p-3 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium">Approve by device code</p>
                  <p className="text-xs text-muted-foreground">
                    For DEVICE_CODE departments — enter the code shown on the installer.
                  </p>
                  <Input
                    placeholder="XXXX-XXXX"
                    value={deviceCodeInput}
                    onChange={(e) => setDeviceCodeInput(e.target.value.toUpperCase())}
                    className="max-w-xs font-mono"
                  />
                </div>
                <Button size="sm" onClick={() => void approveByCode()}>
                  Approve code
                </Button>
              </div>
              {!pending.length ? (
                <p className="text-sm text-muted-foreground">No pending installations.</p>
              ) : (
                pending.map((row) => (
                  <div
                    key={row.id}
                    className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{row.display_name || row.hostname || row.id}</span>
                        <Badge variant="outline">{typeLabel(row.device_type)}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Host {row.hostname || "—"} · Ver {row.application_version || "—"} · Dept{" "}
                        {row.department_name || "—"}
                      </p>
                      <p className="truncate font-mono text-[11px] text-muted-foreground">
                        fp {row.fingerprint || "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        First seen {row.first_seen || row.created_at || "—"}
                      </p>
                      <div className="flex max-w-md flex-col gap-2 pt-1 sm:flex-row">
                        <Input
                          placeholder="Rename display name"
                          value={renameDraft[row.id] ?? ""}
                          onChange={(e) =>
                            setRenameDraft((prev) => ({ ...prev, [row.id]: e.target.value }))
                          }
                        />
                        <Input
                          placeholder="Department ID"
                          value={deptDraft[row.id] ?? (row.department_id != null ? String(row.department_id) : "")}
                          onChange={(e) =>
                            setDeptDraft((prev) => ({ ...prev, [row.id]: e.target.value }))
                          }
                        />
                        <Button variant="outline" size="sm" onClick={() => void rename(row)}>
                          Rename
                        </Button>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button size="sm" onClick={() => void approve(row)}>
                        <Check className="mr-1 h-4 w-4" /> Approve
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => void reject(row)}>
                        <X className="mr-1 h-4 w-4" /> Reject
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        ) : null}

        {!loading && tab === "policies" ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Department Settings → Device Provisioning</CardTitle>
              <CardDescription>
                Choose Manual, Trusted Auto-Approve, Restricted Auto-Approve (CIDR), or Device Code.
                New departments default to Trusted Auto-Approve. Existing departments without a policy stay Manual.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Department ID</p>
                  <Input
                    className="w-40"
                    value={policyDeptId}
                    onChange={(e) => setPolicyDeptId(e.target.value)}
                    placeholder="e.g. 12"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={() => void loadPolicyForDept()}>
                  Load policy
                </Button>
              </div>

              {policyDraft.department_id || policyDeptId ? (
                <div className="grid max-w-2xl gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Provisioning Mode</p>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={policyDraft.provisioning_mode || "manual_approval"}
                      onChange={(e) =>
                        setPolicyDraft((prev) => ({ ...prev, provisioning_mode: e.target.value }))
                      }
                    >
                      {Object.entries(MODE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Allowed Networks (CIDR, one per line)</p>
                    <textarea
                      className="min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
                      value={
                        Array.isArray(policyDraft.allowed_networks)
                          ? policyDraft.allowed_networks.join("\n")
                          : ""
                      }
                      onChange={(e) =>
                        setPolicyDraft((prev) => ({
                          ...prev,
                          allowed_networks: e.target.value
                            .split(/[\n,;]+/)
                            .map((s) => s.trim())
                            .filter(Boolean),
                        }))
                      }
                      placeholder={"10.1.0.0/16\n172.16.5.0/24"}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={Boolean(policyDraft.require_mfa)}
                      onChange={(e) =>
                        setPolicyDraft((prev) => ({ ...prev, require_mfa: e.target.checked }))
                      }
                    />
                    Require MFA (falls back to Pending until portal MFA is wired)
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={policyDraft.require_device_fingerprint !== false}
                      onChange={(e) =>
                        setPolicyDraft((prev) => ({
                          ...prev,
                          require_device_fingerprint: e.target.checked,
                        }))
                      }
                    />
                    Require device fingerprint
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={policyDraft.auto_approve_existing_reinstalls !== false}
                      onChange={(e) =>
                        setPolicyDraft((prev) => ({
                          ...prev,
                          auto_approve_existing_reinstalls: e.target.checked,
                        }))
                      }
                    />
                    Auto-approve existing reinstalls (revoked → re-enroll)
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={policyDraft.audit_enabled !== false}
                      onChange={(e) =>
                        setPolicyDraft((prev) => ({ ...prev, audit_enabled: e.target.checked }))
                      }
                    />
                    Audit enabled
                  </label>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Maximum pending lifetime (hours)</p>
                    <Input
                      type="number"
                      min={1}
                      className="w-32"
                      value={policyDraft.maximum_pending_lifetime_hours ?? 24}
                      onChange={(e) =>
                        setPolicyDraft((prev) => ({
                          ...prev,
                          maximum_pending_lifetime_hours: Number(e.target.value || 24),
                        }))
                      }
                    />
                  </div>
                  <Button onClick={() => void savePolicy()} disabled={policySaving}>
                    {policySaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save policy
                  </Button>
                </div>
              ) : null}

              <div className="space-y-2">
                <p className="text-sm font-medium">Configured departments</p>
                {!policies.length ? (
                  <p className="text-sm text-muted-foreground">No policy rows yet (new departments create Trusted by default).</p>
                ) : (
                  policies.map((p) => (
                    <div key={p.department_id} className="rounded-md border p-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{p.department_name || `Dept ${p.department_id}`}</span>
                        <Badge variant="outline">
                          {MODE_LABELS[p.provisioning_mode] || p.provisioning_mode}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Networks: {(p.allowed_networks || []).join(", ") || "—"} · MFA{" "}
                        {p.require_mfa ? "on" : "off"}
                      </p>
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto px-0"
                        onClick={() => {
                          setPolicyDeptId(String(p.department_id));
                          setPolicyDraft(p);
                        }}
                      >
                        Edit
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {!loading && tab === "devices" ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <HardDrive className="h-5 w-5" /> Provisioned Devices
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {!devices.length ? (
                <p className="text-sm text-muted-foreground">No provisioned devices yet.</p>
              ) : (
                devices.map((d) => (
                  <div
                    key={d.id}
                    className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{d.display_name || d.hostname || d.id}</span>
                        <Badge variant="outline">{typeLabel(d.device_type)}</Badge>
                        <Badge>{d.lifecycle}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {d.hostname} · {d.department_name || "No department"} · HB{" "}
                        {d.last_heartbeat_at || "—"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => void lifecycle(d.id, "suspend")}>
                        Suspend
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void lifecycle(d.id, "revoke")}>
                        Revoke
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => void lifecycle(d.id, "retire")}>
                        <Trash2 className="mr-1 h-4 w-4" /> Retire
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        ) : null}

        {!loading && tab === "retired" ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Retired Devices</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {!retired.length ? (
                <p className="text-sm text-muted-foreground">No retired devices.</p>
              ) : (
                retired.map((d) => (
                  <div key={d.id} className="rounded-md border p-3 text-sm">
                    <span className="font-medium">{d.display_name || d.hostname}</span>{" "}
                    <Badge variant="secondary">{typeLabel(d.device_type)}</Badge>
                    <p className="text-xs text-muted-foreground">Retired {d.retired_at || "—"}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        ) : null}

        {!loading && tab === "audit" ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Provisioning Audit</CardTitle>
              <CardDescription>Secrets are never written to audit detail.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {audit.map((row) => (
                  <li key={row.id} className="border-b pb-2">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{row.action}</Badge>
                      <span>{row.message}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {row.created_at} · {row.actor || "system"} · device {row.device_id || "—"}
                    </p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}
      </main>
    </div>
  );
}
