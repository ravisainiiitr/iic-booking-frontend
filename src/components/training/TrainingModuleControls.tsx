import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Loader2, Power, Search, Users, Wrench } from "lucide-react";
import { toast } from "sonner";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/components/training/trainingHelpers";
import { DetailRow, LoadingBlock, SectionCard } from "@/components/training/trainingUi";
import { resetTrainingBootstrap } from "@/components/training/useTrainingAvailability";
import { trainingApi } from "@/lib/trainingApi";
import type { TrainingAudience, TrainingModuleEquipment, TrainingModuleState } from "@/lib/trainingTypes";

const AUDIENCE_HELP: Record<TrainingAudience, string> = {
  TEST_ACCOUNTS:
    "Only flagged test faculty and test students see the Training menus and can request demos, nominate or join trainings. Everyone else sees nothing.",
  EVERYONE: "All eligible faculty and students of the enabled equipment see Training.",
};

function Pill({ tone, children }: { tone: "on" | "off" | "info"; children: ReactNode }) {
  const cls =
    tone === "on"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200"
      : tone === "info"
        ? "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-200"
        : "border-border bg-muted text-muted-foreground";
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}>{children}</span>;
}

/** Main Admin controls: module switch, audience and per-equipment enablement. */
export function TrainingModuleControls({ onChanged }: { onChanged?: () => void }) {
  const [state, setState] = useState<TrainingModuleState | null>(null);
  const [savingModule, setSavingModule] = useState(false);
  const [confirmEveryone, setConfirmEveryone] = useState(false);

  const [query, setQuery] = useState("");
  const [enabledOnly, setEnabledOnly] = useState(false);
  const [rows, setRows] = useState<TrainingModuleEquipment[] | null>(null);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(0);
  const [listLoading, setListLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const loadState = useCallback(async () => {
    const res = await trainingApi.moduleState();
    if (res.error || !res.data) {
      toast.error(res.error || "Could not load the Training module settings.");
      return;
    }
    setState(res.data);
  }, []);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  useEffect(() => {
    let alive = true;
    const t = window.setTimeout(async () => {
      setListLoading(true);
      const res = await trainingApi.moduleEquipment({ q: query.trim() || undefined, enabled: enabledOnly });
      if (!alive) return;
      setListLoading(false);
      if (res.error || !res.data) {
        toast.error(res.error || "Could not load equipment.");
        return;
      }
      setRows(res.data.results);
      setTotal(res.data.count);
      setLimit(res.data.limit);
    }, 250);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [query, enabledOnly]);

  const afterChange = (next?: TrainingModuleState) => {
    if (next) setState(next);
    resetTrainingBootstrap();
    onChanged?.();
  };

  const updateModule = async (input: { module_enabled?: boolean; audience?: TrainingAudience }) => {
    setSavingModule(true);
    const res = await trainingApi.updateModule(input);
    setSavingModule(false);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not save.");
      return;
    }
    afterChange(res.data);
    if (input.module_enabled !== undefined) toast.success(input.module_enabled ? "Training & Certification switched on." : "Training & Certification switched off.");
    else toast.success(`Audience set to: ${res.data.audience_label}.`);
  };

  const toggleEquipment = async (row: TrainingModuleEquipment, enabled: boolean) => {
    setBusyId(row.equipment_id);
    const res = await trainingApi.setEquipmentEnabled(row.equipment_id, enabled);
    setBusyId(null);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not update the equipment.");
      return;
    }
    const updated = res.data;
    setRows((prev) => {
      const next = (prev ?? []).map((r) => (r.equipment_id === updated.equipment_id ? updated : r));
      return enabledOnly ? next.filter((r) => r.training_active) : next;
    });
    toast.success(`Training ${enabled ? "enabled" : "disabled"} for ${row.name} (${row.code}).`);
    void loadState();
    afterChange();
  };

  if (!state) return <LoadingBlock />;

  const enabledCount = state.enabled_equipment.length;

  return (
    <>
      <SectionCard
        title="Module & audience"
        description={state.updated_at ? `Last changed ${formatDateTime(state.updated_at)}${state.updated_by ? ` by ${state.updated_by}` : ""}.` : undefined}
        icon={<Power className="h-4 w-4" />}
      >
        <div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <Label htmlFor="training-module-switch" className="text-sm font-medium">
                Training &amp; Certification
              </Label>
              <p className="text-xs text-muted-foreground">
                Turns the module on for the equipment enabled below. Menus appear only for the audience you choose.
              </p>
              {state.env_module_enabled ? (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  The server environment switch is also on, so the module stays on even if you turn this off.
                </p>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              {savingModule ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
              <Pill tone={state.module_enabled ? "on" : "off"}>{state.module_enabled ? "On" : "Off"}</Pill>
              <Switch
                id="training-module-switch"
                checked={state.db_module_enabled}
                disabled={savingModule}
                onCheckedChange={(v) => void updateModule({ module_enabled: v })}
                aria-label="Training & Certification module"
              />
            </div>
          </div>

          <fieldset className="space-y-2">
            <legend className="flex items-center gap-1.5 text-sm font-medium">
              <Users className="h-4 w-4 text-muted-foreground" aria-hidden /> Who can see Training
            </legend>
            <RadioGroup
              value={state.audience}
              onValueChange={(v) => {
                if (v === state.audience) return;
                if (v === "EVERYONE") setConfirmEveryone(true);
                else void updateModule({ audience: v as TrainingAudience });
              }}
              className="gap-2 sm:grid-cols-2"
              disabled={savingModule}
            >
              {(state.audience_choices.length ? state.audience_choices : [
                { value: "TEST_ACCOUNTS" as const, label: "Test accounts only" },
                { value: "EVERYONE" as const, label: "Everyone eligible" },
              ]).map((choice) => (
                <label
                  key={choice.value}
                  htmlFor={`training-audience-${choice.value}`}
                  className={`flex cursor-pointer gap-2.5 rounded-lg border p-3 text-sm ${state.audience === choice.value ? "border-primary/60 bg-primary/5" : "border-border/70"}`}
                >
                  <RadioGroupItem id={`training-audience-${choice.value}`} value={choice.value} className="mt-0.5" />
                  <span className="min-w-0">
                    <span className="font-medium">{choice.label}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{AUDIENCE_HELP[choice.value]}</span>
                  </span>
                </label>
              ))}
            </RadioGroup>
            <p className="text-xs text-muted-foreground">
              OICs, Lab Operators and administrators of enabled equipment always see the Training workspace and attendance pages so the flow can be run.
            </p>
          </fieldset>

          <dl className="grid grid-cols-1 gap-3 border-t border-border/60 pt-4 sm:grid-cols-3">
            <DetailRow label="Server env switch">{state.env_module_enabled ? "On" : "Off"}</DetailRow>
            <DetailRow label="Server pilot list">{state.env_pilot_equipment_codes.length ? state.env_pilot_equipment_codes.join(", ") : "None"}</DetailRow>
            <DetailRow label="Equipment in scope">
              {state.all_equipment_in_scope ? "Every equipment (server switch on, nothing listed)" : enabledCount ? `${enabledCount}` : "None yet"}
            </DetailRow>
          </dl>
        </div>
      </SectionCard>

      <SectionCard
        title="Equipment enabled for Training"
        description="Only enabled equipment offers demonstrations, nomination calls and trainings."
        icon={<Wrench className="h-4 w-4" />}
        bodyClassName="p-0"
      >
        <div className="flex flex-wrap items-center gap-3 border-b border-border/60 p-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by equipment name, code or department"
              className="h-9 pl-8"
              aria-label="Search equipment"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={enabledOnly} onCheckedChange={(v) => setEnabledOnly(v === true)} />
            Enabled only
          </label>
          {listLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Loading" /> : null}
        </div>
        {rows === null ? (
          <LoadingBlock />
        ) : !rows.length ? (
          <p className="p-4 text-sm text-muted-foreground">{enabledOnly ? "No equipment is enabled for Training yet." : "No equipment matches your search."}</p>
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[560px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Equipment</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-36 text-right">Training</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.equipment_id}>
                    <TableCell>
                      <p className="font-medium">{row.name}</p>
                      <p className="text-xs text-muted-foreground">{row.code}</p>
                    </TableCell>
                    <TableCell className="text-sm">{row.department || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{row.status}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {row.env_pilot ? <Pill tone="info">Server list</Pill> : null}
                        {busyId === row.equipment_id ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
                        <Switch
                          checked={row.enabled}
                          disabled={busyId === row.equipment_id}
                          onCheckedChange={(v) => void toggleEquipment(row, v)}
                          aria-label={`Training for ${row.name}`}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {total > rows.length ? (
              <p className="border-t border-border/60 px-4 py-2 text-xs text-muted-foreground">
                Showing the first {limit || rows.length} of {total}. Search to narrow the list.
              </p>
            ) : null}
          </div>
        )}
      </SectionCard>

      <AlertDialog open={confirmEveryone} onOpenChange={setConfirmEveryone}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Open Training to everyone?</AlertDialogTitle>
            <AlertDialogDescription>
              All eligible faculty and students will see the Training menus for the enabled equipment, and faculty will be notified when
              nomination calls open.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep test accounts only</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmEveryone(false);
                void updateModule({ audience: "EVERYONE" });
              }}
            >
              Open to everyone
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
