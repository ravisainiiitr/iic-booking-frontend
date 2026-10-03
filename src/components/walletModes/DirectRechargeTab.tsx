import { useCallback, useEffect, useMemo, useState } from "react";
import { Ban, Loader2, Power, ShieldCheck, Undo2, UserPlus, UserRound, X } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  apiClient,
  type AdminWalletModeSettings,
  type WalletDirectRechargeAccess,
  type WalletDirectRechargeGrant,
  type WalletModeUserHit,
  type WalletPaymentModesOverview,
} from "@/lib/api";
import { AWAITING_APPROVAL_TEXT } from "@/lib/walletModes";

import DirectRechargeForm from "./DirectRechargeForm";
import DirectRechargeHistory from "./DirectRechargeHistory";
import {
  formatDateTime,
  formatInr,
  isListedDepartment,
  SearchPicker,
  SectionTitle,
  StatusChip,
  type ChipTone,
} from "./shared";

const ALL_DEPARTMENTS = "all";
const GRANT_TONE: Record<WalletDirectRechargeGrant["status"], ChipTone> = {
  active: "on",
  scheduled: "info",
  expired: "muted",
  revoked: "off",
};

function localInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type GrantForm = {
  user: WalletModeUserHit | null;
  validFrom: string;
  validUntil: string;
  departmentId: string;
  cap: string;
  reason: string;
};

const emptyGrantForm = (): GrantForm => {
  const now = new Date();
  const week = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
  return { user: null, validFrom: localInputValue(now), validUntil: localInputValue(week), departmentId: ALL_DEPARTMENTS, cap: "", reason: "" };
};

export default function DirectRechargeTab({
  overview,
  settings,
  onSettingsSaved,
  onDirtyChange,
}: {
  overview: WalletPaymentModesOverview;
  settings: AdminWalletModeSettings;
  onSettingsSaved: (s: AdminWalletModeSettings) => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const savedEnabled = Boolean(settings.direct_recharge_enabled);
  const [enabled, setEnabled] = useState(savedEnabled);
  const [savingMaster, setSavingMaster] = useState(false);
  const [grants, setGrants] = useState<WalletDirectRechargeGrant[]>([]);
  const [grantsLoading, setGrantsLoading] = useState(true);
  const [grantForm, setGrantForm] = useState<GrantForm>(emptyGrantForm);
  const [grantErrors, setGrantErrors] = useState<Record<string, string>>({});
  const [savingGrant, setSavingGrant] = useState(false);
  const [showGrantForm, setShowGrantForm] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<WalletDirectRechargeGrant | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [revoking, setRevoking] = useState(false);
  const [access, setAccess] = useState<WalletDirectRechargeAccess | null>(null);
  const [formDirty, setFormDirty] = useState(false);
  const [historyKey, setHistoryKey] = useState(0);
  const [grantFilter, setGrantFilter] = useState<"current" | "all">("current");

  useEffect(() => setEnabled(savedEnabled), [savedEnabled]);

  const grantDirty = showGrantForm && Boolean(grantForm.user || grantForm.reason || grantForm.cap);
  useEffect(
    () => onDirtyChange(enabled !== savedEnabled || grantDirty || formDirty),
    [enabled, savedEnabled, grantDirty, formDirty, onDirtyChange]
  );

  const loadGrants = useCallback(async () => {
    setGrantsLoading(true);
    const res = await apiClient.getWalletDirectRechargeGrants();
    setGrantsLoading(false);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not load the designated persons.");
      return;
    }
    setGrants(res.data.grants);
  }, []);

  const loadAccess = useCallback(async () => {
    const res = await apiClient.getWalletDirectRechargeAccess();
    if (!res.error && res.data) setAccess(res.data);
  }, []);

  useEffect(() => {
    void loadGrants();
  }, [loadGrants]);
  useEffect(() => {
    void loadAccess();
  }, [loadAccess, savedEnabled]);

  const visibleGrants = useMemo(
    () => (grantFilter === "current" ? grants.filter((g) => g.status === "active" || g.status === "scheduled") : grants),
    [grants, grantFilter]
  );

  const saveMaster = async () => {
    setSavingMaster(true);
    const res = await apiClient.updateAdminWalletModeSettings({ direct_recharge_enabled: enabled });
    setSavingMaster(false);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not save the switch.");
      return;
    }
    onSettingsSaved(res.data);
    toast.success(`Direct wallet recharge turned ${enabled ? "on" : "off"}.`);
  };

  const createGrant = async () => {
    const e: Record<string, string> = {};
    if (!grantForm.user) e.user_id = "Select the person.";
    if (!grantForm.validUntil) e.valid_until = "Enter until when the permission is valid.";
    else if (new Date(grantForm.validUntil) <= new Date(grantForm.validFrom || Date.now()))
      e.valid_until = "Valid until must be after valid from.";
    else if (new Date(grantForm.validUntil) <= new Date()) e.valid_until = "Valid until must be in the future.";
    if (grantForm.cap && !(Number(grantForm.cap) > 0)) e.max_amount_per_transaction = "Enter an amount greater than zero.";
    if (grantForm.reason.trim().length < 3) e.reason = "Give the reason for this permission.";
    setGrantErrors(e);
    if (Object.keys(e).length || !grantForm.user) return;
    setSavingGrant(true);
    const res = await apiClient.createWalletDirectRechargeGrant({
      user_id: grantForm.user.id,
      valid_from: grantForm.validFrom ? new Date(grantForm.validFrom).toISOString() : undefined,
      valid_until: new Date(grantForm.validUntil).toISOString(),
      department_id: grantForm.departmentId === ALL_DEPARTMENTS ? null : Number(grantForm.departmentId),
      max_amount_per_transaction: grantForm.cap || undefined,
      reason: grantForm.reason.trim(),
    });
    setSavingGrant(false);
    if (res.error || !res.data) {
      const detail = res.fieldErrors?.errors;
      toast.error(detail ? `${res.error} ${Array.isArray(detail) ? detail.join(" ") : detail}` : res.error || "Could not save.");
      return;
    }
    toast.success(`${res.data.user.name} can recharge wallets until ${formatDateTime(res.data.valid_until)}.`);
    setGrantForm(emptyGrantForm());
    setShowGrantForm(false);
    await loadGrants();
  };

  const revoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    const res = await apiClient.revokeWalletDirectRechargeGrant(revokeTarget.id, revokeReason.trim());
    setRevoking(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(`Permission for ${revokeTarget.user.name} revoked.`);
    setRevokeTarget(null);
    setRevokeReason("");
    await loadGrants();
  };

  const masterDirty = enabled !== savedEnabled;
  const departmentOptions = overview.departments.filter(isListedDepartment);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>
            <SectionTitle icon={<Power className="h-4 w-4" />}>Direct wallet recharge</SectionTitle>
          </CardTitle>
          <CardDescription>
            Lets the Main Administrator, and people you designate below, add funds directly to a user’s wallet. Off by
            default. Departments can be excluded in the Payment options tab.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Label htmlFor="direct-recharge-master" className="text-sm font-semibold">
                Allow direct wallet recharge
              </Label>
              <StatusChip tone={savedEnabled ? "on" : "off"}>{savedEnabled ? "On" : "Off"}</StatusChip>
              {masterDirty ? <StatusChip tone="warn">Unsaved</StatusChip> : null}
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <Switch
                id="direct-recharge-master"
                checked={enabled}
                onCheckedChange={setEnabled}
                disabled={savingMaster || overview.schema_ready === false}
              />
            </div>
          </div>
          {!overview.schema_ready ? (
            <Alert className="mt-3">
              <AlertDescription>Direct recharge is being installed on the server and can be turned on shortly.</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
        <div className="flex flex-col-reverse gap-2 border-t px-4 py-3 sm:flex-row sm:justify-end sm:px-6">
          <Button variant="ghost" disabled={!masterDirty || savingMaster} onClick={() => setEnabled(savedEnabled)}>
            <Undo2 className="mr-2 h-4 w-4" />
            Discard
          </Button>
          <Button disabled={!masterDirty || savingMaster} onClick={() => void saveMaster()}>
            {savingMaster ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>
                <SectionTitle icon={<ShieldCheck className="h-4 w-4" />}>Designated persons</SectionTitle>
              </CardTitle>
              <CardDescription className="mt-1.5">
                Give someone temporary permission to recharge wallets. Permission ends automatically at “valid until”
                and can be revoked at any time.
              </CardDescription>
            </div>
            {!showGrantForm ? (
              <Button size="sm" onClick={() => setShowGrantForm(true)} disabled={!overview.schema_ready}>
                <UserPlus className="mr-2 h-4 w-4" />
                Add person
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {showGrantForm ? (
            <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
              <div className="space-y-1.5">
                <Label htmlFor="grant-user">Person</Label>
                {grantForm.user ? (
                  <div className="flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">
                        <span className="font-medium">{grantForm.user.name}</span>{" "}
                        <span className="text-muted-foreground">{grantForm.user.email}</span>
                      </span>
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setGrantForm((f) => ({ ...f, user: null }))}
                      aria-label="Change person"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <SearchPicker<WalletModeUserHit>
                    id="grant-user"
                    placeholder="Search by name, email or employee ID"
                    itemKey={(u) => u.id}
                    search={async (q) => (await apiClient.searchWalletModeUsers(q)).data?.results ?? []}
                    onPick={(u) => setGrantForm((f) => ({ ...f, user: u }))}
                    renderItem={(u) => (
                      <span className="block">
                        <span className="font-medium">{u.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {u.email}
                          {u.department_name ? ` · ${u.department_name}` : ""}
                        </span>
                      </span>
                    )}
                  />
                )}
                {grantErrors.user_id ? <p className="text-xs text-destructive">{grantErrors.user_id}</p> : null}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="grant-from">Valid from</Label>
                  <Input
                    id="grant-from"
                    type="datetime-local"
                    value={grantForm.validFrom}
                    onChange={(e) => setGrantForm((f) => ({ ...f, validFrom: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="grant-until">Valid until</Label>
                  <Input
                    id="grant-until"
                    type="datetime-local"
                    value={grantForm.validUntil}
                    onChange={(e) => setGrantForm((f) => ({ ...f, validUntil: e.target.value }))}
                    aria-invalid={Boolean(grantErrors.valid_until)}
                  />
                  {grantErrors.valid_until ? <p className="text-xs text-destructive">{grantErrors.valid_until}</p> : null}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="grant-dept">Departments</Label>
                  <Select
                    value={grantForm.departmentId}
                    onValueChange={(v) => setGrantForm((f) => ({ ...f, departmentId: v }))}
                  >
                    <SelectTrigger id="grant-dept">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_DEPARTMENTS}>All departments</SelectItem>
                      {departmentOptions.map((d) => (
                        <SelectItem key={d.id} value={String(d.id)}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="grant-cap">Maximum per transaction (₹, optional)</Label>
                  <Input
                    id="grant-cap"
                    inputMode="decimal"
                    className="tabular-nums"
                    value={grantForm.cap}
                    placeholder="No limit"
                    onChange={(e) => setGrantForm((f) => ({ ...f, cap: e.target.value.replace(/[^\d.]/g, "") }))}
                    aria-invalid={Boolean(grantErrors.max_amount_per_transaction)}
                  />
                  {grantErrors.max_amount_per_transaction ? (
                    <p className="text-xs text-destructive">{grantErrors.max_amount_per_transaction}</p>
                  ) : null}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="grant-reason">Reason</Label>
                <Textarea
                  id="grant-reason"
                  rows={2}
                  maxLength={2000}
                  value={grantForm.reason}
                  onChange={(e) => setGrantForm((f) => ({ ...f, reason: e.target.value }))}
                  placeholder="e.g. Accounts In Charge covering cheque deposits during the audit week"
                  aria-invalid={Boolean(grantErrors.reason)}
                />
                {grantErrors.reason ? <p className="text-xs text-destructive">{grantErrors.reason}</p> : null}
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowGrantForm(false);
                    setGrantForm(emptyGrantForm());
                    setGrantErrors({});
                  }}
                  disabled={savingGrant}
                >
                  Cancel
                </Button>
                <Button onClick={() => void createGrant()} disabled={savingGrant}>
                  {savingGrant ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Grant permission
                </Button>
              </div>
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {visibleGrants.length} {grantFilter === "current" ? "active or upcoming" : "in total"}
            </p>
            <Select value={grantFilter} onValueChange={(v) => setGrantFilter(v as "current" | "all")}>
              <SelectTrigger className="w-44" aria-label="Show permissions">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current">Active and upcoming</SelectItem>
                <SelectItem value="all">All, including expired</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <Table className="min-w-[760px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Person</TableHead>
                  <TableHead>Valid</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead className="text-right">Per transaction</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24 text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grantsLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-6 text-center">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : visibleGrants.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                      No designated persons. Only the Main Administrator can recharge wallets directly.
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleGrants.map((g) => (
                    <TableRow key={g.id}>
                      <TableCell>
                        <span className="block text-sm font-medium">{g.user.name}</span>
                        <span className="block text-xs text-muted-foreground">{g.user.email}</span>
                        {g.reason ? (
                          <span className="mt-0.5 block max-w-xs truncate text-xs text-muted-foreground" title={g.reason}>
                            {g.reason}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {formatDateTime(g.valid_from)}
                        <span className="block text-muted-foreground">to {formatDateTime(g.valid_until)}</span>
                      </TableCell>
                      <TableCell className="text-sm">{g.department_name ?? "All departments"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {g.max_amount_per_transaction ? formatInr(g.max_amount_per_transaction) : "No limit"}
                      </TableCell>
                      <TableCell>
                        <StatusChip tone={GRANT_TONE[g.status]} className="capitalize">
                          {g.status}
                        </StatusChip>
                        {g.recharge_count ? (
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {g.recharge_count} recharge{g.recharge_count === 1 ? "" : "s"}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right">
                        {g.status === "active" || g.status === "scheduled" ? (
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setRevokeTarget(g)}>
                            <Ban className="mr-1.5 h-3.5 w-3.5" />
                            Revoke
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {access?.allowed ? (
        <DirectRechargeForm
          access={access}
          onRecharged={() => setHistoryKey((k) => k + 1)}
          onDirtyChange={setFormDirty}
        />
      ) : (
        <Alert>
          <AlertDescription>
            {savedEnabled
              ? "The recharge form appears here once direct wallet recharge is available to you."
              : `Turn on direct wallet recharge to use the recharge form. Until then designated persons see “${AWAITING_APPROVAL_TEXT}”.`}
          </AlertDescription>
        </Alert>
      )}

      <DirectRechargeHistory
        isAdmin
        departments={overview.departments}
        modes={access?.modes ?? []}
        refreshKey={historyKey}
      />

      <AlertDialog open={revokeTarget != null} onOpenChange={(open) => !open && !revoking && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke permission?</AlertDialogTitle>
            <AlertDialogDescription>
              {revokeTarget?.user.name} will no longer be able to recharge wallets. Recharges already made are kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="revoke-reason">Reason (optional)</Label>
            <Textarea id="revoke-reason" rows={2} value={revokeReason} onChange={(e) => setRevokeReason(e.target.value)} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revoking}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void revoke();
              }}
              disabled={revoking}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {revoking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
