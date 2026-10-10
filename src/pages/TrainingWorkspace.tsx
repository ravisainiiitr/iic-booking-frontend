import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ClipboardList, Presentation, School, UserCog } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { heroButtonClass } from "@/components/PageShell";
import { AssessmentsPanel } from "@/components/training/AssessmentsPanel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CallsPanel } from "@/components/training/CallsPanel";
import { CertificationsPanel } from "@/components/training/CertificationsTable";
import { DemoRequestDialog } from "@/components/training/DemoRequestDialog";
import { EventsPanel } from "@/components/training/EventsPanel";
import { SessionAttendancePanel } from "@/components/training/SessionAttendancePanel";
import { formatDateTime, formatDuration, formatWindow, humanizeCode } from "@/components/training/trainingHelpers";
import { CountTile, EmptyState, LoadingBlock, ModuleUnavailable, StatusChip, TrainingPageFrame } from "@/components/training/trainingUi";
import { useTrainingAvailability } from "@/components/training/useTrainingAvailability";
import { trainingApi } from "@/lib/trainingApi";
import type { DemoRequest, WorkspaceSummary } from "@/lib/trainingTypes";

const TABS = ["requests", "calls", "events", "attendance", "assessments", "certifications"] as const;
type Tab = (typeof TABS)[number];

const REQUEST_FILTERS = [
  { value: "open", label: "Open (needs action)" },
  { value: "SUBMITTED,UNDER_REVIEW", label: "Awaiting decision" },
  { value: "APPROVED", label: "Approved — to schedule" },
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "PROPOSED_ALTERNATIVE", label: "Awaiting faculty response" },
  { value: "all", label: "All history" },
];

function RequestsInbox({ onOpen, reloadKey }: { onOpen: (id: number) => void; reloadKey: number }) {
  const [filter, setFilter] = useState("open");
  const [rows, setRows] = useState<DemoRequest[] | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await trainingApi.demoRequests({ scope: "inbox", status: filter === "all" ? undefined : filter });
    setLoading(false);
    if (res.error) {
      toast.error(res.error);
      setRows([]);
      return;
    }
    setRows(res.data?.results ?? []);
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  return (
    <div className="space-y-3">
      <Select value={filter} onValueChange={setFilter}>
        <SelectTrigger className="h-9 w-60">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {REQUEST_FILTERS.map((f) => (
            <SelectItem key={f.value} value={f.value}>
              {f.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {loading && !rows ? (
        <LoadingBlock />
      ) : !rows?.length ? (
        <EmptyState icon={<Presentation className="h-8 w-8" />} title="No demonstration requests" description="Requests from faculty for your equipment appear here." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/70 bg-card">
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow>
                <TableHead>Request</TableHead>
                <TableHead>Faculty</TableHead>
                <TableHead>Purpose</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => onOpen(r.id)}>
                  <TableCell>
                    <p className="text-xs font-semibold text-muted-foreground">{r.reference}</p>
                    <p className="font-medium">{r.equipment.name}</p>
                    <p className="text-xs text-muted-foreground">{r.equipment.code}</p>
                  </TableCell>
                  <TableCell className="text-sm">
                    {r.requester.name}
                    {r.requester.department ? <p className="text-xs text-muted-foreground">{r.requester.department}</p> : null}
                  </TableCell>
                  <TableCell className="text-sm">
                    {r.purpose_label || humanizeCode(r.purpose)}
                    {r.course_code ? <p className="text-xs text-muted-foreground">{r.course_code}</p> : null}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDuration(r.requested_duration_minutes)}
                    <p className="text-xs text-muted-foreground">{r.participants_requested} participants</p>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1">
                      <StatusChip kind="demo" status={r.status} label={r.status_label} />
                      {r.sla_escalated ? <span className="text-[11px] font-medium text-rose-700 dark:text-rose-300">Review overdue</span> : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.approved_start_at ? (
                      <span className="font-medium text-foreground">{formatWindow(r.approved_start_at, r.approved_end_at)}</span>
                    ) : r.preferred_windows?.[0] ? (
                      <>Prefers {formatWindow(r.preferred_windows[0].start, r.preferred_windows[0].end)}</>
                    ) : null}
                    <p>Submitted {formatDateTime(r.submitted_at)}</p>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

export default function TrainingWorkspace() {
  const { loading: bootLoading, menu } = useTrainingAvailability();
  const allowed = menu("training_workspace");
  const dutyAllowed = menu("operator_duty");
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const rawTab = params.get("tab") as Tab | null;
  const tab: Tab = rawTab && TABS.includes(rawTab) ? rawTab : "requests";
  const requestParam = Number(params.get("request")) || null;
  const callParam = Number(params.get("call")) || null;

  const [summary, setSummary] = useState<WorkspaceSummary | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [demoKey, setDemoKey] = useState(0);

  const loadSummary = useCallback(async () => {
    const res = await trainingApi.workspaceSummary();
    if (res.error) toast.error(res.error);
    else setSummary(res.data ?? null);
  }, []);

  useEffect(() => {
    if (allowed) void loadSummary();
  }, [allowed, loadSummary, reloadKey, demoKey]);

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next, { replace: true });
  };
  const goTab = (t: Tab) => update({ tab: t === "requests" ? null : t, call: null });

  return (
    <TrainingPageFrame
      title="Training workspace"
      description="Demonstration requests, nomination calls, sessions, attendance, competency assessments and certificates for your equipment."
      icon={<School className="h-5 w-5" />}
      onRefresh={allowed ? () => setReloadKey((k) => k + 1) : undefined}
      actions={(onHero) =>
        dutyAllowed ? (
          <Button
            type="button"
            variant={onHero ? "ghost" : "outline"}
            size="sm"
            className={onHero ? heroButtonClass.secondary : undefined}
            onClick={() => navigate("/training/duty")}
          >
            <UserCog className="mr-1.5 h-4 w-4" /> Operator duty
          </Button>
        ) : null
      }
    >
      {bootLoading ? (
        <LoadingBlock />
      ) : !allowed ? (
        <ModuleUnavailable />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-9">
            <CountTile label="Requests to decide" value={summary?.demo_open} highlight onClick={() => goTab("requests")} />
            <CountTile label="Demos to schedule" value={summary?.demo_to_schedule} highlight onClick={() => goTab("requests")} />
            <CountTile label="Open calls" value={summary?.calls_open} onClick={() => goTab("calls")} />
            <CountTile label="Calls to publish" value={summary?.calls_to_publish} highlight onClick={() => goTab("calls")} />
            <CountTile label="Appeals pending" value={summary?.appeals_pending} highlight onClick={() => goTab("calls")} />
            <CountTile label="Attendance due" value={summary?.attendance_due} highlight onClick={() => goTab("attendance")} />
            <CountTile label="To sign off" value={summary?.assessments_to_sign_off} highlight onClick={() => goTab("assessments")} />
            <CountTile label="Active certifications" value={summary?.certified_active} onClick={() => goTab("certifications")} />
            <CountTile label="Expiring in 30 days" value={summary?.certifications_expiring} highlight onClick={() => goTab("certifications")} />
          </div>

          <Tabs value={tab} onValueChange={(v) => goTab(v as Tab)}>
            <TabsList className="h-auto flex-wrap justify-start">
              <TabsTrigger value="requests">
                <ClipboardList className="mr-1.5 h-4 w-4" /> Demo requests
              </TabsTrigger>
              <TabsTrigger value="calls">Nomination calls</TabsTrigger>
              <TabsTrigger value="events">Events & sessions</TabsTrigger>
              <TabsTrigger value="attendance">Attendance</TabsTrigger>
              <TabsTrigger value="assessments">Assessments</TabsTrigger>
              <TabsTrigger value="certifications">Certifications</TabsTrigger>
            </TabsList>
            <TabsContent value="requests" className="mt-3">
              <RequestsInbox reloadKey={reloadKey + demoKey} onOpen={(id) => update({ request: String(id) })} />
            </TabsContent>
            <TabsContent value="calls" className="mt-3">
              <CallsPanel key={`calls-${reloadKey}`} callId={callParam} onCallChange={(id) => update({ call: id ? String(id) : null })} />
            </TabsContent>
            <TabsContent value="events" className="mt-3">
              <EventsPanel key={`events-${reloadKey}`} />
            </TabsContent>
            <TabsContent value="attendance" className="mt-3">
              <SessionAttendancePanel key={`attendance-${reloadKey}`} onOpenDemoRequest={(id) => update({ request: String(id) })} />
            </TabsContent>
            <TabsContent value="assessments" className="mt-3">
              <AssessmentsPanel key={`assess-${reloadKey}`} onChanged={() => void loadSummary()} />
            </TabsContent>
            <TabsContent value="certifications" className="mt-3">
              <CertificationsPanel key={`certs-${reloadKey}`} />
            </TabsContent>
          </Tabs>
        </>
      )}

      <DemoRequestDialog
        requestId={requestParam}
        open={Boolean(requestParam) && allowed}
        onOpenChange={(open) => !open && update({ request: null })}
        onChanged={() => setDemoKey((k) => k + 1)}
      />
    </TrainingPageFrame>
  );
}
