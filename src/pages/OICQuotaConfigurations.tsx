import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardHeader from "@/components/DashboardHeader";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

type QuotaRow = {
  id?: number;
  quota_type: string;
  quota_type_display?: string;
  internal_individual_quota_minutes: number;
  internal_faculty_quota_minutes: number;
  external_individual_quota_minutes: number;
  external_faculty_quota_minutes: number;
  is_enforced: boolean;
};

type GroupRow = {
  equipment_group_id: number;
  name: string;
  code: string;
  description?: string;
  equipment?: Array<{ equipment_id: number; code?: string; name?: string }>;
  quotas?: QuotaRow[];
};

const QUOTA_TYPES = ["WEEKLY", "MONTHLY"] as const;

function emptyQuota(quotaType: string): QuotaRow {
  return {
    quota_type: quotaType,
    internal_individual_quota_minutes: 0,
    internal_faculty_quota_minutes: 0,
    external_individual_quota_minutes: 0,
    external_faculty_quota_minutes: 0,
    is_enforced: true,
  };
}

export default function OICQuotaConfigurations() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userType = String(user?.user_type ?? "").toLowerCase();
  const canManage = userType === "admin" || userType === "manager";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [quotas, setQuotas] = useState<QuotaRow[]>([]);

  const selected = useMemo(
    () => groups.find((g) => String(g.equipment_group_id) === selectedGroupId) ?? null,
    [groups, selectedGroupId]
  );

  const applyGroupQuotas = (group: GroupRow | null) => {
    if (!group) {
      setQuotas([]);
      return;
    }
    const existing = group.quotas || [];
    setQuotas(
      QUOTA_TYPES.map((t) => {
        const found = existing.find((q) => String(q.quota_type).toUpperCase() === t);
        return found
          ? {
              ...emptyQuota(t),
              ...found,
              quota_type: t,
              internal_individual_quota_minutes: Number(found.internal_individual_quota_minutes ?? 0),
              internal_faculty_quota_minutes: Number(found.internal_faculty_quota_minutes ?? 0),
              external_individual_quota_minutes: Number(found.external_individual_quota_minutes ?? 0),
              external_faculty_quota_minutes: Number(found.external_faculty_quota_minutes ?? 0),
              is_enforced: found.is_enforced !== false,
            }
          : emptyQuota(t);
      })
    );
  };

  useEffect(() => {
    if (!canManage) {
      toast.error("Only Admin or Officer In Charge can manage quota configurations.");
      navigate("/dashboard");
      return;
    }
    (async () => {
      setLoading(true);
      const res = await apiClient.getOicEquipmentGroupQuotas();
      setLoading(false);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      const list = (res.data?.groups || []) as GroupRow[];
      setGroups(list);
      if (list.length > 0) {
        setSelectedGroupId(String(list[0].equipment_group_id));
      }
    })();
  }, [canManage, navigate]);

  useEffect(() => {
    const g = groups.find((x) => String(x.equipment_group_id) === selectedGroupId) ?? null;
    applyGroupQuotas(g);
  }, [selectedGroupId, groups]);

  const updateQuotaField = (quotaType: string, field: keyof QuotaRow, value: number | boolean) => {
    setQuotas((prev) =>
      prev.map((q) => (q.quota_type === quotaType ? { ...q, [field]: value } : q))
    );
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    const res = await apiClient.updateOicEquipmentGroupQuotas(
      selected.equipment_group_id,
      quotas.map((q) => ({
        quota_type: q.quota_type,
        internal_individual_quota_minutes: Number(q.internal_individual_quota_minutes) || 0,
        internal_faculty_quota_minutes: Number(q.internal_faculty_quota_minutes) || 0,
        external_individual_quota_minutes: Number(q.external_individual_quota_minutes) || 0,
        external_faculty_quota_minutes: Number(q.external_faculty_quota_minutes) || 0,
        is_enforced: !!q.is_enforced,
      }))
    );
    setSaving(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Quota configurations saved.");
    const refreshed = await apiClient.getOicEquipmentGroupQuotas();
    if (!refreshed.error && refreshed.data?.groups) {
      const list = refreshed.data.groups as GroupRow[];
      setGroups(list);
      const g = list.find((x) => x.equipment_group_id === selected.equipment_group_id) ?? null;
      applyGroupQuotas(g);
    }
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
          <h1 className="text-2xl font-semibold tracking-tight">Quota Configurations</h1>
          <p className="mt-2 text-sm text-white/85 max-w-2xl">
            Weekly and monthly quotas (minutes) for equipment groups that include instruments you manage.
          </p>
        </div>

        <Card className="rounded-2xl border-border/70 shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle className="text-lg">Equipment group</CardTitle>
            <CardDescription>Select a group to edit its quota configurations.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : groups.length === 0 ? (
              <p className="text-sm text-muted-foreground">No equipment groups available for your instruments.</p>
            ) : (
              <div className="space-y-2">
                <Label>Group</Label>
                <Select
                  value={selectedGroupId}
                  onValueChange={(v) => {
                    setSelectedGroupId(v);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select group" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((g) => (
                      <SelectItem key={g.equipment_group_id} value={String(g.equipment_group_id)}>
                        {g.code} — {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selected?.equipment && selected.equipment.length > 0 && (
                  <p className="text-xs text-muted-foreground pt-1">
                    Equipment:{" "}
                    {selected.equipment.map((e) => e.code || e.name).filter(Boolean).join(", ")}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {selected && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quota Configurations</CardTitle>
              <CardDescription>
                Internal vs external, individual vs faculty. Values are in minutes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Quota type</TableHead>
                      <TableHead>Internal individual (min)</TableHead>
                      <TableHead>Internal faculty (min)</TableHead>
                      <TableHead>External individual (min)</TableHead>
                      <TableHead>External faculty (min)</TableHead>
                      <TableHead>Is enforced</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quotas.map((row) => (
                      <TableRow key={row.quota_type}>
                        <TableCell className="font-medium">
                          {row.quota_type === "WEEKLY" ? "Weekly" : "Monthly"}
                        </TableCell>
                        {(
                          [
                            "internal_individual_quota_minutes",
                            "internal_faculty_quota_minutes",
                            "external_individual_quota_minutes",
                            "external_faculty_quota_minutes",
                          ] as const
                        ).map((field) => (
                          <TableCell key={field}>
                            <Input
                              type="number"
                              min={0}
                              value={Number(row[field] ?? 0)}
                              onChange={(e) =>
                                updateQuotaField(row.quota_type, field, parseInt(e.target.value, 10) || 0)
                              }
                            />
                          </TableCell>
                        ))}
                        <TableCell>
                          <Checkbox
                            checked={!!row.is_enforced}
                            onCheckedChange={(c) => updateQuotaField(row.quota_type, "is_enforced", c === true)}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Button type="button" onClick={() => void save()} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
