import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Activity, CalendarPlus, ClipboardList, Scale, Timer, UserCog, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AllocatePanel } from "@/components/training/duty/AllocatePanel";
import { AllocationDialog } from "@/components/training/duty/AllocationDialog";
import { AllocationsPanel } from "@/components/training/duty/AllocationsPanel";
import { HoursPanel } from "@/components/training/duty/HoursPanel";
import { LivePanel } from "@/components/training/duty/LivePanel";
import { OperatorPolicyForm } from "@/components/training/duty/OperatorPolicyForm";
import { RosterPanel } from "@/components/training/duty/RosterPanel";
import { LoadingBlock, ModuleUnavailable, TrainingPageFrame } from "@/components/training/trainingUi";
import { useTrainingAvailability } from "@/components/training/useTrainingAvailability";

const TABS = ["live", "allocate", "allocations", "roster", "hours", "rules"] as const;
type Tab = (typeof TABS)[number];

export default function OperatorDuty() {
  const { loading, menu } = useTrainingAvailability();
  const allowed = menu("operator_duty");
  const [params, setParams] = useSearchParams();
  const rawTab = params.get("tab") as Tab | null;
  const tab: Tab = rawTab && TABS.includes(rawTab) ? rawTab : "live";
  const allocationParam = Number(params.get("allocation")) || null;
  const [refreshKey, setRefreshKey] = useState(0);

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next, { replace: true });
  };
  const openAllocation = (id: number) => update({ allocation: String(id) });
  const bump = () => setRefreshKey((k) => k + 1);

  return (
    <TrainingPageFrame
      title="Operator duty"
      description="Allocate certified operators to instrument slots fairly, track confirmations and hours operated in real time, and keep the roster and rules up to date."
      icon={<UserCog className="h-5 w-5" />}
      onRefresh={allowed ? bump : undefined}
    >
      {loading ? (
        <LoadingBlock />
      ) : !allowed ? (
        <ModuleUnavailable message="Operator duty is for equipment OICs, department administrators and the Main Admin." />
      ) : (
        <Tabs value={tab} onValueChange={(v) => update({ tab: v === "live" ? null : v })}>
          <TabsList className="h-auto flex-wrap justify-start">
            <TabsTrigger value="live">
              <Activity className="mr-1.5 h-4 w-4" /> Live
            </TabsTrigger>
            <TabsTrigger value="allocate">
              <CalendarPlus className="mr-1.5 h-4 w-4" /> Allocate
            </TabsTrigger>
            <TabsTrigger value="allocations">
              <ClipboardList className="mr-1.5 h-4 w-4" /> Allocations
            </TabsTrigger>
            <TabsTrigger value="roster">
              <Users className="mr-1.5 h-4 w-4" /> Roster
            </TabsTrigger>
            <TabsTrigger value="hours">
              <Timer className="mr-1.5 h-4 w-4" /> Hours
            </TabsTrigger>
            <TabsTrigger value="rules">
              <Scale className="mr-1.5 h-4 w-4" /> Rules
            </TabsTrigger>
          </TabsList>
          <TabsContent value="live" className="mt-3">
            <LivePanel refreshKey={refreshKey} onOpenAllocation={openAllocation} />
          </TabsContent>
          <TabsContent value="allocate" className="mt-3">
            <AllocatePanel
              onCreated={(a) => {
                bump();
                update({ tab: "allocations", allocation: String(a.id) });
              }}
            />
          </TabsContent>
          <TabsContent value="allocations" className="mt-3">
            <AllocationsPanel refreshKey={refreshKey} onOpen={openAllocation} />
          </TabsContent>
          <TabsContent value="roster" className="mt-3">
            <RosterPanel refreshKey={refreshKey} />
          </TabsContent>
          <TabsContent value="hours" className="mt-3">
            <HoursPanel refreshKey={refreshKey} />
          </TabsContent>
          <TabsContent value="rules" className="mt-3">
            <OperatorPolicyForm key={`rules-${refreshKey}`} />
          </TabsContent>
        </Tabs>
      )}

      <AllocationDialog
        allocationId={allowed ? allocationParam : null}
        onOpenChange={(open) => !open && update({ allocation: null })}
        onChanged={bump}
      />
    </TrainingPageFrame>
  );
}
