import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api";

type MigrationDashboard = {
  phase?: string;
  end_user_booking_enabled?: boolean;
  booking_opens_at?: string | null;
  incremental_sync_enabled?: boolean;
  legacy_ledger_frozen?: boolean;
  last_wallet_txn_watermark?: number;
  last_sync_at?: string | null;
  last_sync_error?: string;
  transactions_imported?: number;
  overall_status?: string;
  exception_count?: number;
  mappings?: { total?: number; valid?: number; exception?: number };
  booking_migration_mode?: string;
  migration_start_at?: string | null;
  migration_window_end_at?: string | null;
  new_portal_url?: string;
  mapping_counts?: Record<string, number>;
  block_counts?: Record<string, number>;
  migration_summary?: Record<string, unknown>;
};

export default function AdminPortalMigration() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = String(user?.user_type || "").toLowerCase() === "admin";
  const [dash, setDash] = useState<MigrationDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [toPhase, setToPhase] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [modeDraft, setModeDraft] = useState("NORMAL");
  const [windowStartDraft, setWindowStartDraft] = useState("");
  const [windowEndDraft, setWindowEndDraft] = useState("");
  const [newPortalUrlDraft, setNewPortalUrlDraft] = useState("");
  const [datetimeContract, setDatetimeContract] = useState<Record<string, unknown> | null>(null);
  const [approvalReason, setApprovalReason] = useState("");
  const [approveConfirm, setApproveConfirm] = useState(false);
  const [goNoGo, setGoNoGo] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.getPortalMigrationDashboard();
      if (res.error) throw new Error(res.error);
      const base = (res.data || null) as MigrationDashboard | null;
      const overview = await apiClient.getLegacyMigrationOverview();
      const summary = await apiClient.getPortalMigrationSummary({ include_discovery: "1" });
      if (!overview.error && overview.data) {
        setDash({
          ...(base || {}),
          booking_migration_mode: String(
            overview.data.booking_migration_mode || base?.booking_migration_mode || "",
          ),
          migration_start_at:
            (overview.data.migration_start_at as string | null) ?? base?.migration_start_at,
          migration_window_end_at:
            (overview.data.migration_window_end_at as string | null) ?? base?.migration_window_end_at,
          new_portal_url: String(overview.data.new_portal_url || base?.new_portal_url || ""),
          mapping_counts: overview.data.mapping_counts as Record<string, number> | undefined,
          block_counts: overview.data.block_counts as Record<string, number> | undefined,
          migration_summary: !summary.error ? summary.data : undefined,
        });
      } else {
        setDash(base);
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to load migration dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    void load();
    void apiClient.getDatetimeContract().then((res) => {
      if (!res.error && res.data) setDatetimeContract(res.data);
    });
    void apiClient.getPhase10mGoNoGo().then((res) => {
      if (!res.error && res.data) {
        setGoNoGo(res.data);
        return;
      }
      void apiClient.getPhase10lGoNoGo().then((res2) => {
        if (!res2.error && res2.data) {
          setGoNoGo(res2.data);
          return;
        }
        void apiClient.getPhase10kGoNoGo().then((res3) => {
          if (!res3.error && res3.data) {
            setGoNoGo(res3.data);
            return;
          }
          void apiClient.getPhase10jGoNoGo().then((res4) => {
            if (!res4.error && res4.data) {
              setGoNoGo(res4.data);
              return;
            }
            void apiClient.getPhase10iGoNoGo().then((res5) => {
              if (!res5.error && res5.data) {
                setGoNoGo(res5.data);
                return;
              }
              void apiClient.getPhase10gGoNoGo().then((res6) => {
                if (!res6.error && res6.data) setGoNoGo(res6.data);
              });
            });
          });
        });
      });
    });
  }, [isAdmin, load]);

  useEffect(() => {
    if (!dash) return;
    setModeDraft(dash.booking_migration_mode || "NORMAL");
    setWindowStartDraft(dash.migration_start_at || "");
    setWindowEndDraft(dash.migration_window_end_at || "");
    setNewPortalUrlDraft(dash.new_portal_url || "");
  }, [dash]);

  if (!isAdmin) {
    return (
      <div className="container mx-auto max-w-3xl p-6">
        <p className="text-muted-foreground">Main Administrator access required.</p>
      </div>
    );
  }

  const transition = async () => {
    if (!toPhase.trim()) {
      toast.error("Enter target phase");
      return;
    }
    if (toPhase === "NEW_PORTAL_ACTIVE" && confirmText.trim() !== "MIGRATE") {
      toast.error("Type MIGRATE to confirm activation");
      return;
    }
    setBusy(true);
    try {
      const res = await apiClient.transitionPortalMigration({
        to_phase: toPhase.trim(),
        note: "admin UI transition",
      });
      if (res.error) throw new Error(res.error);
      toast.success(`Transitioned toward ${toPhase}`);
      setConfirmText("");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Transition failed");
    } finally {
      setBusy(false);
    }
  };

  const setBooking = async (enabled: boolean) => {
    setBusy(true);
    try {
      const res = await apiClient.patchPortalMigrationState({ end_user_booking_enabled: enabled });
      if (res.error) throw new Error(res.error);
      toast.success(enabled ? "New-portal booking enabled" : "New-portal booking blocked");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const savePhase8b = async () => {
    setBusy(true);
    try {
      const res = await apiClient.patchPortalMigrationState({
        booking_migration_mode: modeDraft.trim() || "NORMAL",
        migration_start_at: windowStartDraft.trim() || null,
        migration_window_end_at: windowEndDraft.trim() || null,
        new_portal_url: newPortalUrlDraft.trim(),
      });
      if (res.error) throw new Error(res.error);
      toast.success(
        "Phase 8B settings saved (does not activate production T0 or create production blocks)",
      );
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to save Phase 8B settings");
    } finally {
      setBusy(false);
    }
  };

  const approveDatetimeContract = async () => {
    if (!approveConfirm) {
      toast.error("Check confirm before approving datetime contract");
      return;
    }
    if (!approvalReason.trim()) {
      toast.error("Approval reason is required");
      return;
    }
    setBusy(true);
    try {
      const res = await apiClient.approveDatetimeContract({
        confirm: true,
        approval_reason: approvalReason.trim(),
      });
      if (res.error) throw new Error(res.error);
      toast.success("Datetime contract approved (discovery enabled; T0 not activated)");
      setApprovalReason("");
      setApproveConfirm(false);
      const refreshed = await apiClient.getDatetimeContract();
      if (!refreshed.error && refreshed.data) setDatetimeContract(refreshed.data);
    } catch (e: any) {
      toast.error(e?.message || "Approval failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/user-management")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">Portal Migration</h1>
            <p className="text-sm text-muted-foreground">
              Central state for Channel-I transition, legacy wallet sync, and cutover. No automatic
              destructive migration.
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading || busy}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {goNoGo ? (
        <Card className="border-red-300">
          <CardHeader>
            <CardTitle>Phase {String(goNoGo.phase || "10J")} GO / NO-GO</CardTitle>
            <CardDescription>
              {String(goNoGo.verdict)} — T0 executed: {String(goNoGo.t0_executed)}. Gates never show PASS
              without evidence. Datetime approval and migration window remain operator-gated; discovery is
              blocked until both are set. USER UNRESOLVED does not block T0 when equipment + time are valid.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid gap-2 sm:grid-cols-2">
              <p>Environment: {String(goNoGo.environment || "—")}</p>
              <p>Production baseline: {String(goNoGo.production_baseline_sha || "—")}</p>
              <p>Backend local: {String(goNoGo.backend_local_sha || "—")}</p>
              <p>Schema: {String(goNoGo.schema || "—")}</p>
            </div>
            {goNoGo.gate_matrix && typeof goNoGo.gate_matrix === "object" ? (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="p-2">Gate</th>
                      <th className="p-2">Status</th>
                      <th className="p-2">Blocking</th>
                      <th className="p-2">Evidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(goNoGo.gate_matrix as Record<string, Record<string, unknown>>).map(
                      ([name, gate]) => (
                        <tr key={name} className="border-b align-top">
                          <td className="p-2 font-medium">{name}</td>
                          <td className="p-2">{String(gate.result)}</td>
                          <td className="p-2">{String(gate.blocking)}</td>
                          <td className="p-2 text-muted-foreground">{String(gate.evidence)}</td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            ) : null}
            {Array.isArray(goNoGo.blockers) && goNoGo.blockers.length > 0 ? (
              <div>
                <p className="font-medium">Blockers</p>
                <ul className="list-disc pl-5">
                  {(goNoGo.blockers as unknown[]).map((b, i) => (
                    <li key={i}>{String(b)}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {datetimeContract ? (
        <Card className="border-amber-300">
          <CardHeader>
            <CardTitle>Datetime contract</CardTitle>
            <CardDescription>
              {String(datetimeContract.approval_status)} — approval enables MySQL discovery only; does not
              activate T0, create blocks, freeze portal, or send email. User unresolved does not block slot
              readiness.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid gap-2 sm:grid-cols-2">
              <p>Start column: {String(datetimeContract.booking_datetime_source)}</p>
              <p>
                Duration column: {String(datetimeContract.duration_source)} (
                {String(datetimeContract.duration_unit)})
              </p>
              <p>Derived end: {String(datetimeContract.derived_end_formula || datetimeContract.derived_end)}</p>
              <p>Strategy: {String(datetimeContract.datetime_strategy)}</p>
              <p>Blocks T0: {String(datetimeContract.blocks_t0)}</p>
              <p>Blocks discovery: {String(datetimeContract.blocks_discovery)}</p>
            </div>
            {datetimeContract.validation_summary &&
            typeof datetimeContract.validation_summary === "object" ? (
              <div className="rounded-md border p-3">
                <p className="font-medium">MySQL validation summary (read-only)</p>
                <div className="mt-2 grid gap-1 sm:grid-cols-2">
                  {Object.entries(datetimeContract.validation_summary as Record<string, unknown>)
                    .filter(([k]) => !k.endsWith("_sample") && k !== "duration_distribution_top")
                    .map(([k, v]) => (
                      <p key={k}>
                        {k}: {String(v ?? "—")}
                      </p>
                    ))}
                </div>
              </div>
            ) : null}
            {String(datetimeContract.approval_status) === "OPERATOR_REQUIRED" ? (
              <div className="space-y-3 rounded-md border border-amber-400 p-3">
                <p className="font-medium">Operator approval (Main Administrator)</p>
                <Label htmlFor="approval-reason">Approval reason</Label>
                <Input
                  id="approval-reason"
                  value={approvalReason}
                  onChange={(e) => setApprovalReason(e.target.value)}
                  placeholder="Reviewed datetime validation report; booking_date + time_required minutes confirmed"
                />
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={approveConfirm}
                    onChange={(e) => setApproveConfirm(e.target.checked)}
                  />
                  I confirm the datetime contract is correct (confirm=true)
                </label>
                <Button onClick={() => void approveDatetimeContract()} disabled={busy}>
                  Approve datetime contract
                </Button>
              </div>
            ) : (
              <p className="text-muted-foreground">
                Approved by {String(datetimeContract.approved_by || "—")} at{" "}
                {String(datetimeContract.approved_at_utc || "—")}
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Portal migration navigation</CardTitle>
          <CardDescription>Phase 10D/10E — equipment and booking slot mapping (no T0 activation from UI)</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild variant="secondary">
            <Link to="/admin/portal-migration/equipment-mapping">Equipment mapping</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/admin/portal-migration/legacy-bookings">Legacy bookings</Link>
          </Button>
        </CardContent>
      </Card>

      {dash?.migration_summary ? (
        <Card>
          <CardHeader>
            <CardTitle>Migration summary</CardTitle>
            <CardDescription>
              User mapping pending does not block readiness when equipment and datetime are valid.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3 text-sm">
            {[
              ["Legacy equipment", dash.migration_summary.legacy_equipment_discovered],
              ["New equipment", dash.migration_summary.new_equipment_available],
              ["Equipment mapped", dash.migration_summary.equipment_mapped],
              ["Eligible bookings", dash.migration_summary.eligible],
              ["User resolved", dash.migration_summary.user_mapping_resolved],
              ["User pending", dash.migration_summary.user_mapping_pending],
              ["Conflicts", dash.migration_summary.conflicts],
              ["Unmapped eq. bookings", dash.migration_summary.unmapped_equipment],
              ["Active blocks", dash.migration_summary.active_slot_blocks],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <Label>{label}</Label>
                <p className="font-mono">{String(value ?? "—")}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Current state</CardTitle>
          <CardDescription>Authoritative database-backed migration phase</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Phase</Label>
            <p className="font-mono text-sm">{loading ? "…" : dash?.phase || "—"}</p>
          </div>
          <div>
            <Label>Overall status</Label>
            <p className="font-mono text-sm">{dash?.overall_status || "—"}</p>
          </div>
          <div>
            <Label>New booking enabled</Label>
            <p className="font-mono text-sm">{String(dash?.end_user_booking_enabled)}</p>
          </div>
          <div>
            <Label>Booking migration mode</Label>
            <p className="font-mono text-sm">{dash?.booking_migration_mode || "—"}</p>
          </div>
          <div>
            <Label>Legacy sync enabled</Label>
            <p className="font-mono text-sm">{String(dash?.incremental_sync_enabled)}</p>
          </div>
          <div>
            <Label>Ledger frozen</Label>
            <p className="font-mono text-sm">{String(dash?.legacy_ledger_frozen)}</p>
          </div>
          <div>
            <Label>Wallet watermark</Label>
            <p className="font-mono text-sm">{dash?.last_wallet_txn_watermark ?? "—"}</p>
          </div>
          <div>
            <Label>Last sync</Label>
            <p className="font-mono text-sm">{dash?.last_sync_at || "—"}</p>
          </div>
          <div>
            <Label>Imported transactions</Label>
            <p className="font-mono text-sm">{dash?.transactions_imported ?? "—"}</p>
          </div>
          {dash?.last_sync_error ? (
            <div className="sm:col-span-2">
              <Label>Last sync warning</Label>
              <p className="text-sm text-amber-700">{dash.last_sync_error}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Phase 8B — equipment / booking bridge</CardTitle>
          <CardDescription>
            Configurable migration window, NEW_PORTAL_URL, mode, and Main Admin visibility into
            mappings/blocks. Saving here does not create production blocks or activate T0. Do not
            invent window dates — Main Administrator must set explicit ISO start/end.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-amber-300 bg-amber-50/50 p-3 text-sm">
            <p className="font-medium">Migration window status</p>
            <p>
              Configured:{" "}
              {dash?.migration_start_at && dash?.migration_window_end_at ? "YES" : "NO — OPERATOR REQUIRED"}
            </p>
            <p>Start: {dash?.migration_start_at || "—"}</p>
            <p>End: {dash?.migration_window_end_at || "—"}</p>
            <p className="text-muted-foreground">
              Purpose: select legacy bookings whose start falls in [start, end) for T0 slot blocking.
              Discovery cannot proceed until datetime contract is approved AND window is configured.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="mig-mode">booking_migration_mode</Label>
              <Input
                id="mig-mode"
                placeholder="NORMAL|PREPARATION|FREEZE|ACTIVE|SETTLEMENT|COMPLETED"
                value={modeDraft}
                onChange={(e) => setModeDraft(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-portal-url">NEW_PORTAL_URL</Label>
              <Input
                id="new-portal-url"
                placeholder="https://…"
                value={newPortalUrlDraft}
                onChange={(e) => setNewPortalUrlDraft(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mig-start">MIGRATION_START_AT (ISO)</Label>
              <Input
                id="mig-start"
                value={windowStartDraft}
                onChange={(e) => setWindowStartDraft(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mig-end">MIGRATION_WINDOW_END_AT (ISO)</Label>
              <Input
                id="mig-end"
                value={windowEndDraft}
                onChange={(e) => setWindowEndDraft(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 text-sm">
            <p>
              Mapping counts:{" "}
              <span className="font-mono">{JSON.stringify(dash?.mapping_counts || {})}</span>
            </p>
            <p>
              Block counts:{" "}
              <span className="font-mono">{JSON.stringify(dash?.block_counts || {})}</span>
            </p>
          </div>
          <Button disabled={busy} onClick={() => void savePhase8b()}>
            Save Phase 8B settings
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Booking gate</CardTitle>
          <CardDescription>Backend-enforced. Frontend alone is not sufficient.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button variant="destructive" disabled={busy} onClick={() => void setBooking(false)}>
            Block new booking
          </Button>
          <Button disabled={busy} onClick={() => void setBooking(true)}>
            Enable new booking
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Phase transition</CardTitle>
          <CardDescription>
            Explicit transitions only. For NEW_PORTAL_ACTIVE type MIGRATE. Interrupted migrations
            resume from MIGRATION_INTERRUPTED.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="to-phase">Target phase</Label>
            <Input
              id="to-phase"
              placeholder="e.g. PARALLEL_OPERATION, FINAL_SYNC, RECONCILIATION, NEW_PORTAL_ACTIVE"
              value={toPhase}
              onChange={(e) => setToPhase(e.target.value)}
            />
          </div>
          {toPhase.trim() === "NEW_PORTAL_ACTIVE" ? (
            <div className="space-y-2">
              <Label htmlFor="confirm-migrate">Type MIGRATE to confirm</Label>
              <Input
                id="confirm-migrate"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
              />
            </div>
          ) : null}
          <Button disabled={busy} onClick={() => void transition()}>
            Apply transition
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
