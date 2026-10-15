import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import type {
  AutomationLogRow,
  AutomationSettings,
  NoShowPreview,
  OicAlertPreview,
  TicketTriagePreview,
} from "@/lib/automationTypes";
import { useAuth } from "@/contexts/AuthContext";
import { PageHero, PageShell, StandaloneOnly } from "@/components/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type BoolKey = {
  [K in keyof AutomationSettings]: AutomationSettings[K] extends boolean ? K : never;
}[keyof AutomationSettings];
type NumKey =
  | "llm_daily_call_limit"
  | "oic_alert_utilisation_drop_pct"
  | "oic_alert_min_cancellations"
  | "oic_alert_min_disruptions"
  | "no_show_grace_minutes";

/** Switches that send email or change tickets: confirm before turning on. */
const ACTING: Partial<Record<BoolKey, string>> = {
  ticket_triage_enabled: "New tickets will get a suggested type, priority, handler and reply draft. Nothing is sent; staff accept or dismiss.",
  ticket_auto_assign_enabled: "New unassigned tickets that the rules are confident about will be assigned to the suggested handler, who is notified.",
  oic_alerts_enabled: "Officers in Charge will get an email on Monday mornings about flagged equipment.",
  no_show_prompts_enabled: "Lab operators will get an email at 5:30 pm about bookings that ended today with no sample recorded.",
  instrument_finder_llm_enabled: "When the rules find nothing, the request text (without emails or long numbers) is sent to the configured AI model, within the daily limit.",
};

const FLAG_LABEL: Record<string, string> = {
  utilisation_drop: "Booked hours drop",
  cancellation_spike: "Cancellation spike",
  repeated_disruptions: "Repeated disruptions",
};

function Row({ title, description, children }: { title: string; description: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-b py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}

export default function AdminSettingsAutomation() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = String(user?.user_type ?? "") === "admin" || Boolean((user as { is_superuser?: boolean } | null)?.is_superuser);
  const [cfg, setCfg] = useState<AutomationSettings | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<BoolKey | null>(null);
  const [numbers, setNumbers] = useState<Partial<Record<NumKey, string>>>({});
  const [oic, setOic] = useState<OicAlertPreview | null>(null);
  const [noShow, setNoShow] = useState<NoShowPreview | null>(null);
  const [triage, setTriage] = useState<TicketTriagePreview | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [log, setLog] = useState<AutomationLogRow[]>([]);
  const [logLoading, setLogLoading] = useState(false);

  const loadLog = useCallback(async () => {
    setLogLoading(true);
    const res = await apiClient.automationLog("", 100);
    setLogLoading(false);
    if (res.data) setLog(res.data.results);
  }, []);

  useEffect(() => {
    void (async () => {
      const res = await apiClient.automationSettings();
      if (res.data) setCfg(res.data);
      else setForbidden(true);
    })();
    void loadLog();
  }, [loadLog]);

  const save = async (patch: Partial<AutomationSettings>, key: string) => {
    setSaving(key);
    const res = await apiClient.updateAutomationSettings(patch);
    setSaving(null);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not save");
      return;
    }
    setCfg(res.data);
    toast.success("Saved");
    void loadLog();
  };

  const toggle = (key: BoolKey, value: boolean) => {
    if (value && ACTING[key]) setConfirm(key);
    else void save({ [key]: value } as Partial<AutomationSettings>, key);
  };

  const numField = (key: NumKey, min: number, max: number, suffix: string) => {
    const value = numbers[key] ?? String(cfg?.[key] ?? "");
    const dirty = cfg && value !== String(cfg[key]);
    return (
      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => setNumbers((n) => ({ ...n, [key]: e.target.value }))}
          className="h-8 w-24"
          aria-label={key}
        />
        <span className="text-xs text-muted-foreground">{suffix}</span>
        {dirty && (
          <Button
            size="sm"
            variant="outline"
            disabled={saving === key}
            onClick={() => void save({ [key]: Number(value) } as Partial<AutomationSettings>, key).then(() => setNumbers((n) => ({ ...n, [key]: undefined })))}
          >
            Save
          </Button>
        )}
      </div>
    );
  };

  const sw = (key: BoolKey, disabled = false) => (
    <Switch
      checked={Boolean(cfg?.[key])}
      disabled={disabled || saving === key || !cfg}
      onCheckedChange={(v) => toggle(key, v)}
      aria-label={key}
    />
  );

  const preview = async (kind: "oic" | "noshow" | "triage") => {
    setPreviewing(kind);
    if (kind === "oic") {
      const res = await apiClient.automationPreviewOicAlerts();
      if (res.data) setOic(res.data);
      else toast.error(res.error || "Preview failed");
    } else if (kind === "noshow") {
      const res = await apiClient.automationPreviewNoShow();
      if (res.data) setNoShow(res.data);
      else toast.error(res.error || "Preview failed");
    } else {
      const res = await apiClient.automationPreviewTicketTriage(20);
      if (res.data) setTriage(res.data);
      else toast.error(res.error || "Preview failed");
    }
    setPreviewing(null);
  };

  const previewButton = (kind: "oic" | "noshow" | "triage") => (
    <Button size="sm" variant="outline" onClick={() => void preview(kind)} disabled={previewing !== null}>
      {previewing === kind ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Eye className="mr-1.5 h-3.5 w-3.5" />}
      Preview (dry run)
    </Button>
  );

  const header = (
    <PageHero
      title="AI and automation"
      description="Switches for the instrument finder, best times, ticket triage and scheduled staff emails. Anything that sends email or changes a ticket starts off; preview it first. Every action is listed in the activity log."
    >
      <StandaloneOnly>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/admin-settings")}
          className="mb-4 text-white/90 hover:bg-white/20 hover:text-white"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Admin Settings
        </Button>
      </StandaloneOnly>
    </PageHero>
  );

  if (!isAdmin || forbidden) {
    return (
      <PageShell>
        <main className="container mx-auto px-4 py-5">
          {header}
          <Card>
            <CardContent className="py-8 text-sm text-muted-foreground">Only the Main Administrator can change these settings.</CardContent>
          </Card>
        </main>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <main className="container mx-auto max-w-5xl space-y-4 px-4 py-5">
        {header}
        {!cfg ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">For users (read-only, send nothing)</CardTitle>
                <CardDescription>Suggestions shown to people booking.</CardDescription>
              </CardHeader>
              <CardContent>
                <Row title="Instrument finder" description="Describe the sample and goal; get ranked instruments with reasons. Also used by the Booking Assistant.">
                  {sw("instrument_finder_enabled")}
                </Row>
                <Row title="Best times for you" description="Up to five free runs on the booking page: earliest, and ones matching the user's usual times; similar instruments when nothing is free soon.">
                  {sw("smart_slots_enabled")}
                </Row>
                <Row
                  title="Instrument finder: ask the AI model"
                  description={`Only when the rules find nothing. Calls today: ${cfg.llm_calls_today}${cfg.llm_provider ? ` · provider ${cfg.llm_provider}` : ""}.`}
                >
                  {sw("instrument_finder_llm_enabled")}
                </Row>
                <Row title="AI model calls per day" description="Hard daily cap for these automations. 0 means never call the model.">
                  {numField("llm_daily_call_limit", 0, 5000, "calls")}
                </Row>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                <div>
                  <CardTitle className="text-base">Support ticket triage</CardTitle>
                  <CardDescription>Rules only. Staff see the suggestion on the ticket; the reply draft is never sent by itself.</CardDescription>
                </div>
                {previewButton("triage")}
              </CardHeader>
              <CardContent>
                <Row title="Suggest type, priority, handler and reply draft" description="For each new ticket.">
                  {sw("ticket_triage_enabled")}
                </Row>
                <Row title="Assign automatically" description="Only unassigned tickets, only when the rules are at least 70% sure and found the equipment's OIC or operator.">
                  {sw("ticket_auto_assign_enabled", !cfg.ticket_triage_enabled)}
                </Row>
                {triage && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Dry run on the last {triage.count} tickets: {triage.results.filter((r) => r.suggested_assignee).length} with a named handler,{" "}
                      {triage.results.filter((r) => r.confidence >= 0.7 && r.suggested_assignee && !r.assigned).length} would be assigned automatically.
                    </p>
                    <div className="max-h-80 overflow-auto rounded border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Ticket</TableHead>
                            <TableHead>Suggested type</TableHead>
                            <TableHead>Priority</TableHead>
                            <TableHead>Handler</TableHead>
                            <TableHead className="text-right">Sure</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {triage.results.map((r) => (
                            <TableRow key={r.ticket_id}>
                              <TableCell className="max-w-[16rem] truncate" title={r.subject}>
                                #{r.ticket_id} {r.subject}
                              </TableCell>
                              <TableCell>
                                {r.category}
                                {r.category !== r.current_type && <span className="text-xs text-muted-foreground"> (was {r.current_type})</span>}
                              </TableCell>
                              <TableCell className="capitalize">{r.priority}</TableCell>
                              <TableCell>{r.suggested_assignee?.name ?? (r.route_role === "admin" ? "Support team" : r.route_role)}</TableCell>
                              <TableCell className="text-right">{Math.round(r.confidence * 100)}%</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                <div>
                  <CardTitle className="text-base">Weekly anomaly alerts to Officers in Charge</CardTitle>
                  <CardDescription>Monday 9:15 am, last full week against the 4 weeks before. Lab operations email category.</CardDescription>
                </div>
                {previewButton("oic")}
              </CardHeader>
              <CardContent>
                <Row title="Send weekly alerts" description="One email per OIC, listing only their flagged equipment; at most once a week.">
                  {sw("oic_alerts_enabled")}
                </Row>
                <Row title="Booked hours drop" description="Flag when booked hours fall by at least this much (weekly average of 4 h or more).">
                  {numField("oic_alert_utilisation_drop_pct", 10, 100, "%")}
                </Row>
                <Row title="Cancellations" description="Flag at least this many cancellations or refunds, and at least twice the weekly average.">
                  {numField("oic_alert_min_cancellations", 1, 50, "or more")}
                </Row>
                <Row title="Disruptions" description="Flag at least this many bookings hit by maintenance, analysis not possible or operator unavailable.">
                  {numField("oic_alert_min_disruptions", 1, 50, "or more")}
                </Row>
                {oic && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Dry run for week {oic.week}: {oic.equipment_flagged} equipment flagged, {oic.recipients} OIC email(s) would be sent.
                    </p>
                    <ul className="space-y-1 text-sm">
                      {oic.equipment.map((e) => (
                        <li key={e.equipment_id} className="rounded border px-3 py-2">
                          <span className="font-medium">{e.name}</span> <span className="text-muted-foreground">({e.code})</span>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {e.flags.map((f) => (
                              <Badge key={f.kind} variant="outline" title={f.text}>
                                {FLAG_LABEL[f.kind] ?? f.kind}
                              </Badge>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground">{e.flags.map((f) => f.text).join(" ")}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                <div>
                  <CardTitle className="text-base">Likely no-show prompts to Lab operators</CardTitle>
                  <CardDescription>Daily 5:30 pm. Never changes a booking; the operator decides.</CardDescription>
                </div>
                {previewButton("noshow")}
              </CardHeader>
              <CardContent>
                <Row title="Send no-show prompts" description="Bookings still Booked whose slots ended today with no sample recorded (walk-in and fabrication equipment excluded). Each booking is prompted once.">
                  {sw("no_show_prompts_enabled")}
                </Row>
                <Row title="Wait after the slot ends" description="Minutes after the last slot before a booking counts.">
                  {numField("no_show_grace_minutes", 0, 720, "minutes")}
                </Row>
                {noShow && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Dry run now: {noShow.bookings} booking(s), {noShow.recipients} operator email(s) would be sent
                    {noShow.already_prompted ? `; ${noShow.already_prompted} already prompted` : ""}.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                <div>
                  <CardTitle className="text-base">Activity log</CardTitle>
                  <CardDescription>
                    Every email, suggestion, assignment, AI call and settings change.
                    {cfg.updated_by ? ` Settings last changed by ${cfg.updated_by}.` : ""}
                  </CardDescription>
                </div>
                <Button size="sm" variant="ghost" onClick={() => void loadLog()} disabled={logLoading}>
                  <RefreshCw className={`h-4 w-4 ${logLoading ? "animate-spin" : ""}`} />
                </Button>
              </CardHeader>
              <CardContent>
                {log.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nothing yet.</p>
                ) : (
                  <div className="max-h-96 overflow-auto rounded border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>When</TableHead>
                          <TableHead>Automation</TableHead>
                          <TableHead>Action</TableHead>
                          <TableHead>Target</TableHead>
                          <TableHead>Who</TableHead>
                          <TableHead>Summary</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {log.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell className="whitespace-nowrap text-xs">{new Date(r.created_at).toLocaleString()}</TableCell>
                            <TableCell>{r.kind_label}</TableCell>
                            <TableCell>
                              <Badge variant={r.action === "failed" ? "destructive" : "outline"}>{r.action}</Badge>
                            </TableCell>
                            <TableCell className="text-xs">
                              {r.target_type} {r.target_id}
                            </TableCell>
                            <TableCell className="text-xs">{r.recipient ?? r.actor ?? "System"}</TableCell>
                            <TableCell className="text-xs">{r.summary}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Switch this on?</AlertDialogTitle>
              <AlertDialogDescription>
                {confirm ? ACTING[confirm] : ""} Run Preview (dry run) first if you have not. You can switch it off at any time.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (confirm) void save({ [confirm]: true } as Partial<AutomationSettings>, confirm);
                  setConfirm(null);
                }}
              >
                Switch on
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </PageShell>
  );
}
