import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardHeader from "@/components/DashboardHeader";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Loader2, Wrench, Briefcase } from "lucide-react";
import { toast } from "sonner";

type AccessoryRow = {
  equipment_accessory_id: number;
  accessory_name: string;
  is_optional?: boolean;
  is_enabled?: boolean;
};

type AdditionalAccessoryRow = {
  equipment_additional_accessory_id: number;
  additional_accessory_name: string;
  additional_accessory_description?: string;
  is_optional?: boolean;
  is_enabled?: boolean;
};

type EquipmentAccessoriesBundle = {
  equipment_id: number;
  equipment_code: string;
  equipment_name: string;
  accessories: AccessoryRow[];
  additional_accessories: AdditionalAccessoryRow[];
};

export default function OICAccessories() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userType = String(user?.user_type ?? "").toLowerCase();
  const canManage = userType === "admin" || userType === "manager";

  const [loading, setLoading] = useState(true);
  const [equipments, setEquipments] = useState<EquipmentAccessoriesBundle[]>([]);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>("");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const selected = useMemo(
    () => equipments.find((e) => String(e.equipment_id) === selectedEquipmentId) ?? null,
    [equipments, selectedEquipmentId]
  );

  const load = async (preferEquipmentId?: string) => {
    setLoading(true);
    const res = await apiClient.getOicEquipmentAccessories();
    setLoading(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    const list = (res.data?.equipments || []) as EquipmentAccessoriesBundle[];
    setEquipments(list);
    const nextId =
      preferEquipmentId && list.some((e) => String(e.equipment_id) === preferEquipmentId)
        ? preferEquipmentId
        : list.length > 0
          ? String(list[0].equipment_id)
          : "";
    setSelectedEquipmentId(nextId);
  };

  useEffect(() => {
    if (!canManage) {
      toast.error("Only Admin or Officer In Charge can manage accessories.");
      navigate("/dashboard");
      return;
    }
    void load();
  }, [canManage, navigate]);

  const updateLocalAccessory = (accessoryId: number, isEnabled: boolean) => {
    setEquipments((prev) =>
      prev.map((eq) => ({
        ...eq,
        accessories: eq.accessories.map((a) =>
          a.equipment_accessory_id === accessoryId ? { ...a, is_enabled: isEnabled } : a
        ),
      }))
    );
  };

  const updateLocalAdditional = (accessoryId: number, isEnabled: boolean) => {
    setEquipments((prev) =>
      prev.map((eq) => ({
        ...eq,
        additional_accessories: eq.additional_accessories.map((a) =>
          a.equipment_additional_accessory_id === accessoryId ? { ...a, is_enabled: isEnabled } : a
        ),
      }))
    );
  };

  const onToggleAccessory = async (row: AccessoryRow, enabled: boolean) => {
    const key = `a-${row.equipment_accessory_id}`;
    setTogglingId(key);
    const res = await apiClient.setOicEquipmentAccessoryEnabled(row.equipment_accessory_id, enabled);
    setTogglingId(null);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    updateLocalAccessory(row.equipment_accessory_id, enabled);
    toast.success(enabled ? "Accessory enabled." : "Accessory disabled.");
  };

  const onToggleAdditional = async (row: AdditionalAccessoryRow, enabled: boolean) => {
    const key = `aa-${row.equipment_additional_accessory_id}`;
    setTogglingId(key);
    const res = await apiClient.setOicEquipmentAdditionalAccessoryEnabled(
      row.equipment_additional_accessory_id,
      enabled
    );
    setTogglingId(null);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    updateLocalAdditional(row.equipment_additional_accessory_id, enabled);
    toast.success(enabled ? "Additional accessory enabled." : "Additional accessory disabled.");
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Accessories</h1>
            <p className="text-sm text-muted-foreground">
              Enable or disable accessories shown on public equipment pages for instruments you manage.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Equipment</CardTitle>
            <CardDescription>Select an instrument to manage its accessories.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : equipments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No managed equipment found.</p>
            ) : (
              <div className="space-y-2">
                <Label>Equipment</Label>
                <Select value={selectedEquipmentId} onValueChange={setSelectedEquipmentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select equipment" />
                  </SelectTrigger>
                  <SelectContent>
                    {equipments.map((eq) => (
                      <SelectItem key={eq.equipment_id} value={String(eq.equipment_id)}>
                        {eq.equipment_code} — {eq.equipment_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>

        {selected && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Wrench className="h-5 w-5" /> Accessories
                </CardTitle>
                <CardDescription>Equipment accessories for {selected.equipment_code}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {selected.accessories.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No accessories configured.</p>
                ) : (
                  selected.accessories.map((a) => {
                    const busy = togglingId === `a-${a.equipment_accessory_id}`;
                    const enabled = a.is_enabled !== false;
                    return (
                      <div
                        key={a.equipment_accessory_id}
                        className="flex items-center justify-between gap-4 rounded-lg border px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="font-medium truncate">{a.accessory_name}</p>
                          {a.is_optional ? (
                            <p className="text-xs text-muted-foreground">Optional</p>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-muted-foreground">{enabled ? "Enabled" : "Disabled"}</span>
                          <Switch
                            checked={enabled}
                            disabled={busy}
                            onCheckedChange={(v) => void onToggleAccessory(a, v)}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Briefcase className="h-5 w-5" /> Additional Accessories
                </CardTitle>
                <CardDescription>Additional accessories for {selected.equipment_code}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {selected.additional_accessories.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No additional accessories configured.</p>
                ) : (
                  selected.additional_accessories.map((a) => {
                    const busy = togglingId === `aa-${a.equipment_additional_accessory_id}`;
                    const enabled = a.is_enabled !== false;
                    return (
                      <div
                        key={a.equipment_additional_accessory_id}
                        className="flex items-center justify-between gap-4 rounded-lg border px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="font-medium truncate">{a.additional_accessory_name}</p>
                          {a.additional_accessory_description ? (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {a.additional_accessory_description}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-muted-foreground">{enabled ? "Enabled" : "Disabled"}</span>
                          <Switch
                            checked={enabled}
                            disabled={busy}
                            onCheckedChange={(v) => void onToggleAdditional(a, v)}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
