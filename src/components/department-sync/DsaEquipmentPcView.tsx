import { useMemo } from "react";

import type { DsaFleetDetail } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { DsaActionsPanel } from "./DsaActionsPanel";
import { ErrorsList, UploadsTable, WorkspacesTable } from "./DsaAgentView";
import { CheckIcon, Fact, HealthBadge, TraceChecklist } from "./DsaTraceBits";
import { type Dict, checkTally, exactTime, formatBytes, pcChecks, pcHealth, pcName, pcProbe, relativeTime } from "./dsaTrace";

function show(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

/** Bookings and uploads tied to this PC's equipment (matched by portal equipment id or code). */
function sameEquipment(pc: Dict, eq?: { id?: number; code?: string } | null) {
  if (!eq) return false;
  const id = pc.equipment_id;
  if (id === null || id === undefined || id === "") return false;
  return String(eq.id) === String(id) || (Boolean(eq.code) && String(eq.code).toLowerCase() === String(id).toLowerCase());
}

export function DsaEquipmentPcView({
  detail,
  pc,
  latestVersion,
  onAction,
}: {
  detail: DsaFleetDetail;
  pc: Dict;
  latestVersion?: string;
  onAction: () => void;
}) {
  const name = pcName(pc);
  const checks = useMemo(() => pcChecks(pc, latestVersion, detail.reasons), [pc, latestVersion, detail.reasons]);
  const tally = checkTally(checks);
  const probe = pcProbe(pc);
  const uploads = (detail.uploads || []).filter((u) => sameEquipment(pc, u.equipment));
  const workspaces = (detail.workspaces || []).filter((w) => sameEquipment(pc, w.equipment));

  return (
    <div className="space-y-4" data-testid="pc-detail">
      <Card className="rounded-2xl border-border/60">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold tracking-tight">{name}</h2>
                <HealthBadge health={pcHealth(pc)} />
              </div>
              <p className="text-sm text-muted-foreground">
                Equipment PC on {detail.agent.department} · {detail.agent.agent_name}
                {pc.workspace_role ? ` · role ${String(pc.workspace_role)}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1"><CheckIcon state="fail" /> {tally.fail}</span>
              <span className="flex items-center gap-1"><CheckIcon state="warn" /> {tally.warn}</span>
              <span className="flex items-center gap-1"><CheckIcon state="pass" /> {tally.pass}</span>
              <span className="flex items-center gap-1"><CheckIcon state="unknown" /> {tally.unknown}</span>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
            <Fact label="Last heartbeat">
              <span title={exactTime(pc.last_heartbeat_at as string)}>
                {relativeTime((pc.last_heartbeat_at ?? pc.last_seen ?? pc.last_status_at) as string | null)}
              </span>
            </Fact>
            <Fact label="Equipment">{show(pc.equipment_id)}</Fact>
            <Fact label="Observed IP" mono>{show(pc.observed_ip)}</Fact>
            <Fact label="Reserved IP" mono>{show(pc.assigned_ip ?? pc.preferred_ip)}</Fact>
            <Fact label="Windows">{show(pc.windows_version)}</Fact>
            <Fact label="CPU / memory / disk">
              {[pc.cpu_percent, pc.memory_percent, pc.disk_used_percent].map((v) => (v == null ? "—" : `${Math.round(Number(v))}%`)).join(" / ")}
              {pc.disk_free_bytes != null ? ` · ${formatBytes(pc.disk_free_bytes)} free` : ""}
            </Fact>
          </dl>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-4">
          <TraceChecklist checks={checks} />

          <Card className="rounded-2xl border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Last connectivity probe</CardTitle>
            </CardHeader>
            <CardContent>
              {probe ? (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
                  <Fact label="Result">{probe.success ? "Reachable" : "Failed"}</Fact>
                  <Fact label="Connectivity">{show(probe.connectivity)}</Fact>
                  <Fact label="SMB share">{show(probe.smb_status)}</Fact>
                  <Fact label="Write test">{show(probe.write_test)}</Fact>
                  <Fact label="Agent">{show(probe.agent_status)}</Fact>
                  <Fact label="Error category">{show(probe.error_category)}</Fact>
                  <Fact label="Took">{probe.duration_ms != null ? `${probe.duration_ms} ms` : "—"}</Fact>
                  <Fact label="Probed">{relativeTime(probe.probed_at)}</Fact>
                  {probe.message ? (
                    <div className="col-span-full">
                      <Fact label="Message">{probe.message}</Fact>
                    </div>
                  ) : null}
                </dl>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Not probed yet. Run “Refresh Equipment PCs” to test ping, agent, SMB share and a write (firewall check).
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Errors for this PC</CardTitle>
            </CardHeader>
            <CardContent>
              <ErrorsList
                detail={detail}
                subject={name}
                equipmentId={pc.equipment_id == null ? "" : String(pc.equipment_id)}
              />
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Bookings and results on this equipment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-0 sm:p-2">
              {pc.equipment_id == null || pc.equipment_id === "" ? (
                <p className="px-4 pb-4 text-sm text-muted-foreground">This PC is not linked to an equipment yet.</p>
              ) : (
                <>
                  <WorkspacesTable workspaces={workspaces} />
                  <UploadsTable uploads={uploads} />
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit rounded-2xl border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Remote actions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-2 text-xs text-muted-foreground">Sent to {detail.agent.agent_name}, which manages this PC.</p>
            <DsaActionsPanel detail={detail} onDone={onAction} only={["refresh_equipment_pcs", "retry_failed_uploads", "resync_bookings", "run_diagnostics"]} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
