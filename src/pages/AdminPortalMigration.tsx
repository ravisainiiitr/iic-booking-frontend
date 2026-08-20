import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.getPortalMigrationDashboard();
      if (res.error) throw new Error(res.error);
      setDash((res.data || null) as MigrationDashboard | null);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load migration dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    void load();
  }, [isAdmin, load]);

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
      toast.error('Type MIGRATE to confirm activation');
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
              Central state for Channel-I transition, legacy wallet sync, and cutover. No automatic destructive migration.
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading || busy}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

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
            Explicit transitions only. For NEW_PORTAL_ACTIVE type MIGRATE. Interrupted migrations resume from
            MIGRATION_INTERRUPTED.
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
              <Input id="confirm-migrate" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
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
