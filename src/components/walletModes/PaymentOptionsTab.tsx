import { useEffect, useMemo, useState } from "react";
import { Building2, ChevronDown, ChevronRight, Loader2, Search, SlidersHorizontal, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  apiClient,
  type AdminWalletModeSettings,
  type WalletModeDepartmentRow,
  type WalletModeDepartmentState,
  type WalletModeOptionKey,
  type WalletPaymentModesOverview,
} from "@/lib/api";
import { AWAITING_APPROVAL_TEXT } from "@/lib/walletModes";
import { cn } from "@/lib/utils";

import {
  isListedDepartment,
  MASTER_SETTING_KEY,
  OPTION_ICON,
  OPTION_ORDER,
  OPTION_SHORT_LABEL,
  SectionTitle,
  StatusChip,
} from "./shared";

const MASTER_OFF_HINT = "Turn on the master switch to manage departments";

type MasterKey = Exclude<WalletModeOptionKey, "direct_recharge">;
const MASTER_OPTIONS: MasterKey[] = ["project_grant", "direct_cash", "online_gateway", "peer_transfer", "credit"];

function mastersFromSettings(s: AdminWalletModeSettings): Record<MasterKey, boolean> {
  return {
    project_grant: Boolean(s.project_grant_recharge_enabled),
    direct_cash: Boolean(s.direct_cash_recharge_enabled),
    online_gateway: Boolean(s.online_gateway_recharge_enabled),
    peer_transfer: Boolean(s.peer_transfer_enabled),
    credit: Boolean(s.credit_facility_enabled),
  };
}

const allowedState = (option: WalletModeOptionKey): WalletModeDepartmentState => (option === "credit" ? "enabled" : "inherit");
const isAllowed = (state: WalletModeDepartmentState | undefined) => state !== "disabled";

export default function PaymentOptionsTab({
  overview,
  settings,
  onSettingsSaved,
  onReload,
  onDirtyChange,
}: {
  overview: WalletPaymentModesOverview;
  settings: AdminWalletModeSettings;
  onSettingsSaved: (s: AdminWalletModeSettings) => void;
  onReload: () => Promise<void>;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const savedMasters = useMemo(() => mastersFromSettings(settings), [settings]);
  const [masters, setMasters] = useState(savedMasters);
  const [savingMasters, setSavingMasters] = useState(false);
  const [matrixDraft, setMatrixDraft] = useState<Record<string, WalletModeDepartmentState>>({});
  const [savingMatrix, setSavingMatrix] = useState(false);
  const [query, setQuery] = useState("");
  const [onlyRestricted, setOnlyRestricted] = useState(false);
  const [showSavedOnly, setShowSavedOnly] = useState(false);

  useEffect(() => setMasters(savedMasters), [savedMasters]);

  const mastersDirty = MASTER_OPTIONS.some((k) => masters[k] !== savedMasters[k]);
  const matrixChanges = useMemo(() => {
    const out: Array<{ department_id: number; option: WalletModeOptionKey; state: WalletModeDepartmentState }> = [];
    for (const [key, state] of Object.entries(matrixDraft)) {
      const [deptId, option] = key.split(":") as [string, WalletModeOptionKey];
      const dept = overview.departments.find((d) => String(d.id) === deptId);
      if (dept && dept.states[option] !== state) out.push({ department_id: dept.id, option, state });
    }
    return out;
  }, [matrixDraft, overview.departments]);

  useEffect(() => onDirtyChange(mastersDirty || matrixChanges.length > 0), [mastersDirty, matrixChanges.length, onDirtyChange]);

  const envBlocked = !settings.credit_facility_available_in_environment;
  const schemaReady = overview.schema_ready;
  const optionMeta = useMemo(() => new Map(overview.options.map((o) => [o.key, o])), [overview.options]);
  const masterOn = (option: WalletModeOptionKey) =>
    option === "direct_recharge"
      ? Boolean(settings.direct_recharge_enabled)
      : Boolean(savedMasters[option as MasterKey]) && !(option === "credit" && envBlocked);

  const stateOf = (deptId: number, option: WalletModeOptionKey) => {
    const draft = matrixDraft[`${deptId}:${option}`];
    if (draft) return draft;
    return overview.departments.find((d) => d.id === deptId)?.states[option] ?? allowedState(option);
  };

  const filteredDepartments = useMemo(() => {
    const q = query.trim().toLowerCase();
    return overview.departments.filter((d) => {
      if (q && !`${d.name} ${d.code}`.toLowerCase().includes(q)) return false;
      if (onlyRestricted) return OPTION_ORDER.some((o) => !isAllowed(matrixDraft[`${d.id}:${o}`] ?? d.states[o]));
      return true;
    });
  }, [overview.departments, query, onlyRestricted, matrixDraft]);
  const listedRows = filteredDepartments.filter(isListedDepartment);
  const savedOnlyRows = filteredDepartments.filter((d) => !isListedDepartment(d));
  const savedOnlyTotal = overview.departments.filter((d) => !isListedDepartment(d)).length;
  const visibleDepartments = showSavedOnly ? [...listedRows, ...savedOnlyRows] : listedRows;

  const setCell = (deptId: number, option: WalletModeOptionKey, allowed: boolean) => {
    setMatrixDraft((prev) => ({ ...prev, [`${deptId}:${option}`]: allowed ? allowedState(option) : "disabled" }));
  };

  const setColumn = (option: WalletModeOptionKey, allowed: boolean) => {
    setMatrixDraft((prev) => {
      const next = { ...prev };
      for (const d of visibleDepartments) next[`${d.id}:${option}`] = allowed ? allowedState(option) : "disabled";
      return next;
    });
  };

  const columnEditable = (option: WalletModeOptionKey) => (option === "credit" || schemaReady) && masterOn(option);

  const renderRow = (dept: WalletModeDepartmentRow) => (
    <tr key={dept.id}>
      <th scope="row" className="table-sticky-cell sticky left-0 z-10 px-3 py-2 text-left font-medium shadow-[1px_0_0_hsl(var(--border))]">
        <span className="line-clamp-2 max-w-[240px] break-words leading-snug" title={dept.name}>
          {dept.name}
        </span>
        {dept.code ? <span className="text-xs font-normal text-muted-foreground">{dept.code}</span> : null}
      </th>
      {OPTION_ORDER.map((option) => {
        const state = stateOf(dept.id, option);
        const allowed = isAllowed(state);
        const changed = state !== dept.states[option];
        const master = masterOn(option);
        const editable = columnEditable(option) && !savingMatrix;
        const label = !master ? "Off (master)" : allowed ? "Available" : "Disabled";
        const toggle = (
          <Switch
            checked={master && allowed}
            disabled={!editable}
            className={cn(!master && "opacity-40")}
            onCheckedChange={(v) => setCell(dept.id, option, v)}
            aria-label={`${OPTION_SHORT_LABEL[option]} for ${dept.name}: ${label}`}
          />
        );
        return (
          <td key={option} className={cn("px-2 py-2 text-center", changed && "bg-amber-50/70 dark:bg-amber-950/30")}>
            <div className="flex flex-col items-center gap-1">
              {master ? (
                toggle
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0} className="inline-flex cursor-not-allowed rounded-full">
                      {toggle}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{MASTER_OFF_HINT}</TooltipContent>
                </Tooltip>
              )}
              <span
                className={cn(
                  "text-[11px]",
                  master && allowed ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"
                )}
              >
                {label}
              </span>
            </div>
          </td>
        );
      })}
    </tr>
  );

  const saveMasters = async () => {
    setSavingMasters(true);
    const payload: Partial<AdminWalletModeSettings> = {};
    for (const k of MASTER_OPTIONS) {
      if (masters[k] !== savedMasters[k]) (payload as Record<string, boolean>)[MASTER_SETTING_KEY[k]] = masters[k];
    }
    const res = await apiClient.updateAdminWalletModeSettings(payload);
    setSavingMasters(false);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not save the master switches.");
      return;
    }
    onSettingsSaved(res.data);
    await onReload();
    toast.success("Master switches saved.");
  };

  const saveMatrix = async () => {
    if (!matrixChanges.length) return;
    setSavingMatrix(true);
    const res = await apiClient.updateWalletModeDepartmentStates(matrixChanges);
    if (res.error) {
      setSavingMatrix(false);
      toast.error(res.error || "Could not save the department settings.");
      return;
    }
    await onReload();
    setMatrixDraft({});
    setSavingMatrix(false);
    toast.success(`Department settings saved (${matrixChanges.length} change${matrixChanges.length === 1 ? "" : "s"}).`);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>
            <SectionTitle icon={<SlidersHorizontal className="h-4 w-4" />}>Master switches</SectionTitle>
          </CardTitle>
          <CardDescription>
            A master switch turns an option off everywhere. While it is on, each department follows it unless that
            department is disabled below. Users of a disabled option see “{AWAITING_APPROVAL_TEXT}” and the server
            rejects new requests. Requests already submitted are not affected.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y p-0">
          {MASTER_OPTIONS.map((key) => {
            const meta = optionMeta.get(key);
            const on = masters[key];
            const changed = on !== savedMasters[key];
            const blocked = key === "credit" && envBlocked;
            return (
              <div key={key} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary dark:text-sky-200">
                    {OPTION_ICON[key]}
                  </span>
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Label htmlFor={`master-${key}`} className="text-sm font-semibold">
                        {meta?.label ?? OPTION_SHORT_LABEL[key]}
                      </Label>
                      <StatusChip tone={on && !blocked ? "on" : "off"}>{on && !blocked ? "On" : "Off"}</StatusChip>
                      {changed ? <StatusChip tone="warn">Unsaved</StatusChip> : null}
                    </div>
                    <p className="text-sm text-muted-foreground">{meta?.description}</p>
                    {blocked ? (
                      <p className="text-xs text-destructive">
                        The credit facility is switched off in the server configuration, so users still see “
                        {AWAITING_APPROVAL_TEXT}” even when this is on.
                      </p>
                    ) : null}
                  </div>
                </div>
                <Switch
                  id={`master-${key}`}
                  className="self-end sm:self-center"
                  checked={on}
                  disabled={savingMasters}
                  onCheckedChange={(v) => setMasters((p) => ({ ...p, [key]: v }))}
                  aria-label={`${on ? "Turn off" : "Turn on"} ${meta?.label ?? key}`}
                />
              </div>
            );
          })}
        </CardContent>
        <div className="flex flex-col-reverse gap-2 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-end sm:px-6">
          <Button variant="ghost" disabled={!mastersDirty || savingMasters} onClick={() => setMasters(savedMasters)}>
            <Undo2 className="mr-2 h-4 w-4" />
            Discard
          </Button>
          <Button disabled={!mastersDirty || savingMasters} onClick={() => void saveMasters()}>
            {savingMasters ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save master switches
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>
            <SectionTitle icon={<Building2 className="h-4 w-4" />}>Department settings</SectionTitle>
          </CardTitle>
          <CardDescription>
            Switch an option off for individual departments. The department is that of the sub-wallet being funded,
            debited or transferred from. Credit Limit uses the department’s “wallet credit” setting, which is also
            shown in Department settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!schemaReady ? (
            <Alert>
              <AlertDescription>
                Department settings are being installed on the server. Until then every department follows the master
                switches; only the Credit Limit column can be changed.
              </AlertDescription>
            </Alert>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative sm:w-80">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search departments"
                className="pl-9"
                aria-label="Search departments"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Switch checked={onlyRestricted} onCheckedChange={setOnlyRestricted} aria-label="Show only restricted departments" />
              Only departments with an option off
            </label>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="ui-table w-full min-w-[760px] text-sm">
              <thead className="text-xs">
                <tr>
                  <th scope="col" className="table-sticky-cell sticky left-0 z-10 px-3 py-2 uppercase tracking-[0.06em] shadow-[1px_0_0_hsl(var(--border)),inset_0_-1px_0_var(--table-head-rule)]">
                    Department
                  </th>
                  {OPTION_ORDER.map((option) => (
                    <th key={option} scope="col" className="px-2 py-2 text-center font-medium">
                      <div className="flex flex-col items-center gap-1">
                        <span className="flex items-center gap-1 uppercase tracking-[0.06em]">
                          {OPTION_ICON[option]}
                          {OPTION_SHORT_LABEL[option]}
                        </span>
                        <span className="flex items-center gap-1">
                          <StatusChip tone={masterOn(option) ? "on" : "off"} className="px-1.5 py-0 text-[10px]">
                            Master {masterOn(option) ? "on" : "off"}
                          </StatusChip>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                disabled={!columnEditable(option) || savingMatrix || visibleDepartments.length === 0}
                                aria-label={`Bulk change ${OPTION_SHORT_LABEL[option]}`}
                              >
                                <ChevronDown className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel className="text-xs">
                                {OPTION_SHORT_LABEL[option]} · {visibleDepartments.length} shown
                              </DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onSelect={() => setColumn(option, true)}>Make available for all shown</DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => setColumn(option, false)}>Disable for all shown</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {listedRows.length === 0 ? (
                  <tr>
                    <td colSpan={OPTION_ORDER.length + 1} className="px-3 py-8 text-center text-muted-foreground">
                      {query || onlyRestricted ? "No departments match." : "No department has equipment listed in the catalog."}
                    </td>
                  </tr>
                ) : null}
                {listedRows.map(renderRow)}
                {savedOnlyTotal > 0 ? (
                  <tr className="bg-muted/40">
                    <td colSpan={OPTION_ORDER.length + 1} className="p-0">
                      <button
                        type="button"
                        className="sticky left-0 flex items-center gap-2 px-3 py-2 text-left text-xs font-medium text-muted-foreground hover:text-foreground"
                        aria-expanded={showSavedOnly}
                        onClick={() => setShowSavedOnly((v) => !v)}
                      >
                        <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", showSavedOnly && "rotate-90")} />
                        Other departments with saved settings ({savedOnlyRows.length})
                        <span className="font-normal">· no equipment listed in the catalog</span>
                      </button>
                    </td>
                  </tr>
                ) : null}
                {showSavedOnly ? savedOnlyRows.map(renderRow) : null}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            Only departments with equipment listed in the catalog are shown. “Available” means users of that department
            can use the option now. While a master switch is off its column is locked; each department’s saved choice
            comes back when the master is turned on again.
          </p>
        </CardContent>
        <div className="flex flex-col-reverse gap-2 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-end sm:px-6">
          {matrixChanges.length ? (
            <span className="text-sm text-amber-700 dark:text-amber-400 sm:mr-auto">
              {matrixChanges.length} unsaved change{matrixChanges.length === 1 ? "" : "s"}
            </span>
          ) : null}
          <Button variant="ghost" disabled={!matrixChanges.length || savingMatrix} onClick={() => setMatrixDraft({})}>
            <Undo2 className="mr-2 h-4 w-4" />
            Discard
          </Button>
          <Button disabled={!matrixChanges.length || savingMatrix} onClick={() => void saveMatrix()}>
            {savingMatrix ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save department settings
          </Button>
        </div>
      </Card>
    </div>
  );
}
