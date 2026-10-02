import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ClipboardList, Megaphone, Presentation } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { heroButtonClass } from "@/components/PageShell";
import { DemoRequestDialog } from "@/components/training/DemoRequestDialog";
import { DemoRequestForm } from "@/components/training/DemoRequestForm";
import { formatDateTime, formatDuration, formatWindow, humanizeCode } from "@/components/training/trainingHelpers";
import { EmptyState, LoadingBlock, ModuleUnavailable, SectionCard, StatusChip, TrainingPageFrame } from "@/components/training/trainingUi";
import { useTrainingAvailability } from "@/components/training/useTrainingAvailability";
import { trainingApi } from "@/lib/trainingApi";
import type { DemoRequest } from "@/lib/trainingTypes";
import { cn } from "@/lib/utils";

const FILTERS = [
  { value: "open", label: "Open requests" },
  { value: "all", label: "All requests" },
  { value: "COMPLETED", label: "Completed" },
  { value: "REJECTED,WITHDRAWN,CANCELLED,EXPIRED,NO_SHOW", label: "Closed / cancelled" },
];

export default function TrainingDemoRequests() {
  const { loading: bootLoading, menu } = useTrainingAvailability();
  const allowed = menu("training_events");
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "new" ? "new" : "mine";
  const requestParam = Number(params.get("request")) || null;

  const [filter, setFilter] = useState("open");
  const [requests, setRequests] = useState<DemoRequest[] | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await trainingApi.demoRequests({ scope: "mine", status: filter === "all" ? undefined : filter });
    setLoading(false);
    if (res.error) {
      toast.error(res.error);
      setRequests([]);
      return;
    }
    setRequests(res.data?.results ?? []);
  }, [filter]);

  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  return (
    <TrainingPageFrame
      title="Demonstration requests"
      description="Ask an OIC to demonstrate an instrument to your class or research group."
      icon={<Presentation className="h-5 w-5" />}
      onRefresh={allowed ? () => void load() : undefined}
      refreshing={loading}
      actions={(onHero) =>
        allowed ? (
          <Button asChild size="sm" variant="outline" className={cn("h-9", onHero && heroButtonClass.secondary)}>
            <Link to="/training/nominations">
              <Megaphone className="mr-1.5 h-4 w-4" /> Training nominations
            </Link>
          </Button>
        ) : null
      }
    >
      {bootLoading ? (
        <LoadingBlock />
      ) : !allowed ? (
        <ModuleUnavailable />
      ) : (
        <Tabs value={tab} onValueChange={(v) => setParam("tab", v === "new" ? "new" : null)}>
          <TabsList>
            <TabsTrigger value="mine">My requests</TabsTrigger>
            <TabsTrigger value="new">Request a demonstration</TabsTrigger>
          </TabsList>

          <TabsContent value="mine" className="mt-3">
            <SectionCard
              title="My demo requests"
              icon={<ClipboardList className="h-4 w-4" />}
              bodyClassName="p-0"
              actions={
                <Select value={filter} onValueChange={setFilter}>
                  <SelectTrigger className="h-8 w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FILTERS.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              }
            >
              {loading && !requests ? (
                <LoadingBlock />
              ) : !requests?.length ? (
                <EmptyState
                  className="m-4"
                  icon={<Presentation className="h-8 w-8" />}
                  title="No demonstration requests"
                  action={
                    <Button size="sm" onClick={() => setParam("tab", "new")}>
                      Request a demonstration
                    </Button>
                  }
                />
              ) : (
                <ul className="divide-y divide-border/60">
                  {requests.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => setParam("request", String(r.id))}
                        className="flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:gap-4"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold text-muted-foreground">{r.reference}</span>
                            <span className="truncate font-medium">{r.equipment.name}</span>
                            <StatusChip kind="demo" status={r.status} label={r.status_label} />
                            {r.curtailed ? <span className="text-[11px] text-amber-700 dark:text-amber-300">Curtailed</span> : null}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {r.purpose_label || humanizeCode(r.purpose)}
                            {r.course_code ? ` · ${r.course_code}` : ""} · {formatDuration(r.requested_duration_minutes)} · {r.participants_requested} participants
                          </p>
                        </div>
                        <div className="text-xs text-muted-foreground sm:text-right">
                          {r.approved_start_at ? (
                            <p className="font-medium text-foreground">{formatWindow(r.approved_start_at, r.approved_end_at)}</p>
                          ) : r.status === "PROPOSED_ALTERNATIVE" && r.proposed_start_at ? (
                            <p className="font-medium text-amber-700 dark:text-amber-300">Proposed {formatWindow(r.proposed_start_at, r.proposed_end_at)}</p>
                          ) : null}
                          <p>Submitted {formatDateTime(r.submitted_at)}</p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </TabsContent>

          <TabsContent value="new" className="mt-3">
            <SectionCard title="Request a demonstration" description="The OIC reviews the request, may propose another time, and confirms the schedule.">
              <DemoRequestForm
                onCreated={(created) => {
                  const next = new URLSearchParams(params);
                  next.delete("tab");
                  next.set("request", String(created.id));
                  setParams(next, { replace: true });
                  void load();
                }}
              />
            </SectionCard>
          </TabsContent>
        </Tabs>
      )}

      <DemoRequestDialog
        requestId={requestParam}
        open={Boolean(requestParam) && allowed}
        onOpenChange={(open) => !open && setParam("request", null)}
        onChanged={() => void load()}
      />
    </TrainingPageFrame>
  );
}
