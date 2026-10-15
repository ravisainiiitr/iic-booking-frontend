import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AuthorisedUsersPanel,
  GrandfatherPanel,
  RequestsPanel,
  SettingsPanel,
  liveExplanation,
} from "@/components/training/AuthorisationPanels";
import { resetGatedEquipment } from "@/components/training/useAuthorisation";
import { EmptyState, LoadingBlock, ModuleUnavailable, SectionCard, TrainingPageFrame } from "@/components/training/trainingUi";
import { useTrainingAvailability } from "@/components/training/useTrainingAvailability";
import { trainingApi } from "@/lib/trainingApi";
import type { ManagedAuthorisationEquipment } from "@/lib/trainingAuthTypes";
import { cn } from "@/lib/utils";

const TABS = ["requests", "users", "settings", "grandfather"] as const;
type Tab = (typeof TABS)[number];

function GateChip({ row }: { row: ManagedAuthorisationEquipment }) {
  const label = row.live ? (row.audience === "TEST_ACCOUNTS" ? "Gate on (test accounts)" : "Gate on") : row.required ? "Saved, not live" : "Gate off";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        row.live
          ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200"
          : row.required
            ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200"
            : "border-border bg-muted text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}

export default function TrainingAuthorisations() {
  const { loading: bootLoading, menu } = useTrainingAvailability();
  const allowed = menu("training_authorisations");
  const [params, setParams] = useSearchParams();
  const rawTab = params.get("tab") as Tab | null;
  const tab: Tab = rawTab && TABS.includes(rawTab) ? rawTab : "requests";
  const equipmentParam = Number(params.get("equipment")) || null;

  const [rows, setRows] = useState<ManagedAuthorisationEquipment[] | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await trainingApi.authorisationEquipment();
    setLoading(false);
    if (res.error) {
      toast.error(res.error);
      setRows([]);
      return;
    }
    setRows(res.data?.results ?? []);
  }, []);

  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  const current = useMemo(() => {
    if (!rows?.length) return null;
    return rows.find((r) => r.equipment.equipment_id === equipmentParam) ?? rows[0];
  }, [rows, equipmentParam]);

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const refresh = () => {
    resetGatedEquipment();
    void load();
  };

  return (
    <TrainingPageFrame
      title="Training authorisations"
      description="Who may book each equipment: training requests, authorised users, the booking gate and grandfathering."
      icon={<ShieldCheck className="h-5 w-5" />}
      onRefresh={allowed ? refresh : undefined}
      refreshing={loading}
    >
      {bootLoading ? (
        <LoadingBlock />
      ) : !allowed ? (
        <ModuleUnavailable message="Only Officers In Charge, Lab Operators and the Main Admin can open this page." />
      ) : rows === null ? (
        <LoadingBlock />
      ) : !current ? (
        <EmptyState icon={<ShieldCheck className="h-8 w-8" />} title="No equipment in Training scope" description="Training must be turned on for your equipment first." />
      ) : (
        <div className="space-y-4">
          <SectionCard>
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-[16rem] flex-1">
                <Select value={String(current.equipment.equipment_id)} onValueChange={(v) => setParam("equipment", v)}>
                  <SelectTrigger aria-label="Equipment">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {rows.map((r) => (
                      <SelectItem key={r.equipment.equipment_id} value={String(r.equipment.equipment_id)}>
                        {r.equipment.name} ({r.equipment.code}){r.open_requests ? ` · ${r.open_requests} request${r.open_requests === 1 ? "" : "s"}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <GateChip row={current} />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {liveExplanation(current)} Needs {current.min_level_name}; certificates last {current.validity_months} months
              {current.grace_completed_bookings
                ? `; users with ${current.grace_completed_bookings}+ completed bookings in ${current.grace_months} months may still book`
                : ""}
              .
            </p>
          </SectionCard>

          <Tabs value={tab} onValueChange={(v) => setParam("tab", v === "requests" ? null : v)}>
            <TabsList className="h-auto flex-wrap justify-start">
              <TabsTrigger value="requests">Requests{current.open_requests ? ` (${current.open_requests})` : ""}</TabsTrigger>
              <TabsTrigger value="users">Authorised users</TabsTrigger>
              <TabsTrigger value="settings">Booking gate</TabsTrigger>
              <TabsTrigger value="grandfather">Grandfathering</TabsTrigger>
            </TabsList>
            <TabsContent value="requests" className="mt-3">
              <RequestsPanel key={current.equipment.equipment_id} equipmentId={current.equipment.equipment_id} validityMonths={current.validity_months} onChanged={refresh} />
            </TabsContent>
            <TabsContent value="users" className="mt-3">
              <AuthorisedUsersPanel
                key={current.equipment.equipment_id}
                equipmentId={current.equipment.equipment_id}
                equipmentName={current.equipment.name}
                equipmentCode={current.equipment.code}
                validityMonths={current.validity_months}
                onChanged={refresh}
              />
            </TabsContent>
            <TabsContent value="settings" className="mt-3">
              <SettingsPanel
                key={`${current.equipment.equipment_id}-${current.updated_at ?? ""}`}
                setting={current}
                onSaved={() => refresh()}
              />
            </TabsContent>
            <TabsContent value="grandfather" className="mt-3">
              <GrandfatherPanel
                key={current.equipment.equipment_id}
                equipmentId={current.equipment.equipment_id}
                canApply={current.can_configure}
                validityMonths={current.validity_months}
                onChanged={refresh}
              />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </TrainingPageFrame>
  );
}
