import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Award, CalendarDays, ClipboardList, GraduationCap, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AwardsTable } from "@/components/training/CertificationsTable";
import { NominationCard } from "@/components/training/NominationCard";
import { TrainingBadgeChips } from "@/components/training/TrainingBadgeChips";
import { formatDateTime, formatWindow, humanizeCode } from "@/components/training/trainingHelpers";
import { EmptyState, LoadingBlock, ModuleUnavailable, SectionCard, StatusChip, TrainingPageFrame } from "@/components/training/trainingUi";
import { useTrainingAvailability } from "@/components/training/useTrainingAvailability";
import { trainingApi } from "@/lib/trainingApi";
import type { MyTrainings as MyTrainingsData } from "@/lib/trainingTypes";

const TABS = ["applications", "sessions", "certifications"] as const;
type Tab = (typeof TABS)[number];

export default function MyTrainings() {
  const { loading: bootLoading, menu } = useTrainingAvailability();
  const allowed = menu("my_trainings");
  const [params, setParams] = useSearchParams();
  const rawTab = params.get("tab") as Tab | null;
  const tab: Tab = rawTab && TABS.includes(rawTab) ? rawTab : "applications";

  const [data, setData] = useState<MyTrainingsData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await trainingApi.meTrainings();
    setLoading(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setData(res.data ?? null);
  }, []);

  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  const pendingActions = (data?.nominations ?? []).filter(
    (n) => n.permissions.confirm_interest || n.permissions.accept_seat,
  ).length;

  return (
    <TrainingPageFrame
      title="My trainings"
      description="Nominations for hands-on instrument training, your sessions and certifications."
      icon={<GraduationCap className="h-5 w-5" />}
      onRefresh={allowed ? () => void load() : undefined}
      refreshing={loading}
    >
      {bootLoading ? (
        <LoadingBlock />
      ) : !allowed ? (
        <ModuleUnavailable />
      ) : loading && !data ? (
        <LoadingBlock />
      ) : (
        <Tabs
          value={tab}
          onValueChange={(v) => {
            const next = new URLSearchParams(params);
            if (v === "applications") next.delete("tab");
            else next.set("tab", v);
            setParams(next, { replace: true });
          }}
        >
          <TabsList className="h-auto flex-wrap justify-start">
            <TabsTrigger value="applications">
              Applications{pendingActions ? ` (${pendingActions} to respond)` : ""}
            </TabsTrigger>
            <TabsTrigger value="sessions">Sessions</TabsTrigger>
            <TabsTrigger value="certifications">Certifications</TabsTrigger>
          </TabsList>

          <TabsContent value="applications" className="mt-3">
            {!data?.nominations.length ? (
              <EmptyState
                icon={<ClipboardList className="h-8 w-8" />}
                title="No nominations yet"
                description="Your supervisor nominates you for hands-on training when an OIC opens a call."
              />
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {data.nominations.map((n) => (
                  <NominationCard key={n.id} nomination={n} viewer="student" onChanged={() => void load()} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="sessions" className="mt-3 space-y-3">
            {!data?.events.length ? (
              <EmptyState icon={<CalendarDays className="h-8 w-8" />} title="No training sessions" description="Sessions appear here once you accept a seat." />
            ) : (
              data.events.map((event) => (
                <SectionCard
                  key={event.id}
                  title={
                    <span className="flex flex-wrap items-center gap-2">
                      {event.title}
                      <StatusChip kind="event" status={event.status} label={event.status_label} />
                    </span>
                  }
                  description={`${event.equipment?.name} (${event.equipment?.code})${event.registration_status ? ` · ${humanizeCode(event.registration_status)}` : ""}`}
                  bodyClassName="p-0"
                >
                  {event.sessions?.length ? (
                    <ul className="divide-y divide-border/60">
                      {[...event.sessions]
                        .sort((a, b) => a.seq - b.seq)
                        .map((s) => (
                          <li key={s.id} className="flex flex-col gap-1 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              <p className="text-sm font-medium">
                                {s.seq}. {s.title || humanizeCode(s.session_type)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatWindow(s.start_at, s.end_at)}
                                {s.location || event.venue ? (
                                  <span className="ml-2 inline-flex items-center gap-1">
                                    <MapPin className="h-3 w-3" aria-hidden />
                                    {s.location || event.venue}
                                  </span>
                                ) : null}
                              </p>
                            </div>
                            <StatusChip kind="session" status={s.status} label={s.status_label} />
                          </li>
                        ))}
                    </ul>
                  ) : (
                    <p className="px-4 py-3 text-sm text-muted-foreground">Session times will be announced by the OIC.</p>
                  )}
                  {event.completed_at ? <p className="border-t px-4 py-2 text-xs text-muted-foreground">Completed {formatDateTime(event.completed_at)}</p> : null}
                </SectionCard>
              ))
            )}
          </TabsContent>

          <TabsContent value="certifications" className="mt-3 space-y-3">
            {data?.badges.length ? (
              <SectionCard title="Badges" icon={<Award className="h-4 w-4" />}>
                <TrainingBadgeChips badges={data.badges} max={50} />
              </SectionCard>
            ) : null}
            {!data?.certifications.length ? (
              <EmptyState icon={<Award className="h-8 w-8" />} title="No certifications yet" description="Complete every session of a training to earn the Trained certification." />
            ) : (
              <AwardsTable awards={data.certifications} showUser={false} />
            )}
          </TabsContent>
        </Tabs>
      )}
    </TrainingPageFrame>
  );
}
