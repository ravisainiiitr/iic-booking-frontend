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
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

type RewardConfig = {
  is_enabled: boolean;
  points_per_duty_hour: string;
  points_per_sample: string;
  currency_per_point: string;
  max_redeem_percent_per_booking: string;
  max_redeem_points_per_booking: number;
  min_booking_amount_for_redeem: string;
  expiry_days: number | null;
  allow_stack_with_other_discounts: boolean;
};

type ManageableEquipment = {
  equipment_id: number;
  equipment_code: string;
  equipment_name: string;
  config_exists: boolean;
};

const DEFAULT_FORM: RewardConfig = {
  is_enabled: false,
  points_per_duty_hour: "10.00",
  points_per_sample: "0.00",
  currency_per_point: "1.0000",
  max_redeem_percent_per_booking: "30.00",
  max_redeem_points_per_booking: 300,
  min_booking_amount_for_redeem: "100.00",
  expiry_days: 180,
  allow_stack_with_other_discounts: true,
};

export default function AdminRewardsConfig() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userType = String(user?.user_type ?? "").toLowerCase();
  const canManage = ["admin", "manager", "operator"].includes(userType);

  const [loadingList, setLoadingList] = useState(true);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [saving, setSaving] = useState(false);
  const [equipments, setEquipments] = useState<ManageableEquipment[]>([]);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>("");
  const [form, setForm] = useState<RewardConfig>(DEFAULT_FORM);

  const selectedEquipment = useMemo(
    () => equipments.find((e) => String(e.equipment_id) === selectedEquipmentId) ?? null,
    [equipments, selectedEquipmentId]
  );

  useEffect(() => {
    if (!canManage) {
      toast.error("Only Admin/OIC/Operator can access reward config.");
      navigate("/dashboard");
      return;
    }
    (async () => {
      setLoadingList(true);
      const res = await apiClient.getAdminRewardConfigs();
      if (res.error) {
        toast.error(res.error);
        setLoadingList(false);
        return;
      }
      const list = (res.data?.manageable_equipments || []) as ManageableEquipment[];
      setEquipments(list);
      if (list.length > 0) setSelectedEquipmentId(String(list[0].equipment_id));
      setLoadingList(false);
    })();
  }, [canManage, navigate]);

  useEffect(() => {
    if (!selectedEquipmentId) return;
    (async () => {
      setLoadingConfig(true);
      const res = await apiClient.getAdminRewardConfigs(selectedEquipmentId);
      if (res.error) {
        toast.error(res.error);
        setLoadingConfig(false);
        return;
      }
      const cfg = (res.data?.config || DEFAULT_FORM) as RewardConfig;
      setForm({
        is_enabled: !!cfg.is_enabled,
        points_per_duty_hour: String(cfg.points_per_duty_hour ?? DEFAULT_FORM.points_per_duty_hour),
        points_per_sample: String(cfg.points_per_sample ?? DEFAULT_FORM.points_per_sample),
        currency_per_point: String(cfg.currency_per_point ?? DEFAULT_FORM.currency_per_point),
        max_redeem_percent_per_booking: String(cfg.max_redeem_percent_per_booking ?? DEFAULT_FORM.max_redeem_percent_per_booking),
        max_redeem_points_per_booking: Number(cfg.max_redeem_points_per_booking ?? DEFAULT_FORM.max_redeem_points_per_booking),
        min_booking_amount_for_redeem: String(cfg.min_booking_amount_for_redeem ?? DEFAULT_FORM.min_booking_amount_for_redeem),
        expiry_days: cfg.expiry_days == null ? null : Number(cfg.expiry_days),
        allow_stack_with_other_discounts: !!cfg.allow_stack_with_other_discounts,
      });
      setLoadingConfig(false);
    })();
  }, [selectedEquipmentId]);

  const save = async () => {
    if (!selectedEquipmentId) return;
    setSaving(true);
    const res = await apiClient.updateAdminRewardConfig(selectedEquipmentId, {
      ...form,
      expiry_days: form.expiry_days == null ? null : Number(form.expiry_days),
      max_redeem_points_per_booking: Number(form.max_redeem_points_per_booking),
    });
    setSaving(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Reward config saved.");
  };

  return (
    <div className="page-shell">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Button variant="ghost" size="sm" onClick={() => navigate("/admin-settings")} className="mb-2">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Admin Settings
            </Button>
            <h1 className="text-3xl font-bold">Reward Config (Per Equipment)</h1>
            <p className="text-muted-foreground mt-1">Manage TA reward policy per equipment.</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Select Equipment</CardTitle>
            <CardDescription>Admin sees all; OIC/Operator see managed equipments only.</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingList ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading equipments...</div>
            ) : (
              <Select value={selectedEquipmentId} onValueChange={setSelectedEquipmentId}>
                <SelectTrigger className="max-w-xl">
                  <SelectValue placeholder="Select equipment" />
                </SelectTrigger>
                <SelectContent>
                  {equipments.map((e) => (
                    <SelectItem key={e.equipment_id} value={String(e.equipment_id)}>
                      {e.equipment_code} - {e.equipment_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
            <CardDescription>
              {selectedEquipment ? `${selectedEquipment.equipment_code} - ${selectedEquipment.equipment_name}` : "Select equipment"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {loadingConfig ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading config...</div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <Label htmlFor="is_enabled">Enable reward system</Label>
                  <Switch id="is_enabled" checked={form.is_enabled} onCheckedChange={(v) => setForm((p) => ({ ...p, is_enabled: !!v }))} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><Label>Points per duty hour</Label><Input value={form.points_per_duty_hour} onChange={(e) => setForm((p) => ({ ...p, points_per_duty_hour: e.target.value }))} /></div>
                  <div><Label>Points per sample</Label><Input value={form.points_per_sample} onChange={(e) => setForm((p) => ({ ...p, points_per_sample: e.target.value }))} /></div>
                  <div><Label>Currency per point</Label><Input value={form.currency_per_point} onChange={(e) => setForm((p) => ({ ...p, currency_per_point: e.target.value }))} /></div>
                  <div><Label>Max redeem % per booking</Label><Input value={form.max_redeem_percent_per_booking} onChange={(e) => setForm((p) => ({ ...p, max_redeem_percent_per_booking: e.target.value }))} /></div>
                  <div><Label>Max points per booking</Label><Input type="number" value={form.max_redeem_points_per_booking} onChange={(e) => setForm((p) => ({ ...p, max_redeem_points_per_booking: Number(e.target.value || 0) }))} /></div>
                  <div><Label>Min booking amount for redeem</Label><Input value={form.min_booking_amount_for_redeem} onChange={(e) => setForm((p) => ({ ...p, min_booking_amount_for_redeem: e.target.value }))} /></div>
                  <div><Label>Expiry days (blank to disable)</Label><Input type="number" value={form.expiry_days ?? ""} onChange={(e) => setForm((p) => ({ ...p, expiry_days: e.target.value === "" ? null : Number(e.target.value) }))} /></div>
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="stack">Allow stack with other discounts</Label>
                  <Switch id="stack" checked={form.allow_stack_with_other_discounts} onCheckedChange={(v) => setForm((p) => ({ ...p, allow_stack_with_other_discounts: !!v }))} />
                </div>
                <div className="pt-2">
                  <Button onClick={save} disabled={!selectedEquipmentId || saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Save config
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
