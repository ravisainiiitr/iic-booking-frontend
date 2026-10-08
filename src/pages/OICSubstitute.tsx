import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarDays,
  CalendarRange,
  Check,
  ChevronDown,
  ClipboardCheck,
  History,
  Loader2,
  Mail,
  Search,
  UserCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";

import { PageHero, PageShell, StandaloneOnly } from "@/components/PageShell";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api";
import {
  buildAssignPlan,
  endActionLabel,
  equipmentLabel,
  formatDmy,
  groupByPerson,
  groupSubstitutions,
  periodDmy,
  periodProblem,
  personName,
  planBySubstitute,
  planProblems,
  planToAssignments,
  rowErrorsByEquipment,
  substitutionDays,
  substitutionStatusClass,
  todayInIst,
  type OicAssignPlanItem,
  type OicAssignRow,
  type OicSubstituteOptions,
  type OicSubstitutePerson,
  type OicSubstituteTab,
  type OicSubstitution,
} from "@/lib/oicSubstitute";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ExportMenu } from "@/components/ExportMenu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const REASON_MAX = 2000;
const CANDIDATE_FETCH_LIMIT = 200;
const FILTER_FROM = 7;

function dateTimeLabel(iso: string | null): string {
  if (!iso) return "";
  try {
    return format(parseISO(iso), "dd-MM-yyyy, h:mm a");
  } catch {
    return iso;
  }
}

function isoToLocalDate(iso: string): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : undefined;
}

function localDateToIso(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function emptyRow(start: string, end: string): OicAssignRow {
  return { selected: false, substitutes: [], customDates: false, startDate: start, endDate: end };
}

function initials(p: OicSubstitutePerson | null | undefined): string {
  const text = personName(p);
  const parts = text.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

function StatusBadge({ item }: { item: OicSubstitution }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        substitutionStatusClass(item.status),
      )}
    >
      {item.status_label}
    </span>
  );
}

function PersonAvatar({ person }: { person: OicSubstitutePerson | null | undefined }) {
  return (
    <span
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground"
      aria-hidden
    >
      {initials(person)}
    </span>
  );
}

/** DD-MM-YYYY date field with a calendar; the value is YYYY-MM-DD. */
function DmyDateField({
  id,
  value,
  min,
  onChange,
  ariaLabel,
  className,
}: {
  id?: string;
  value: string;
  min?: string;
  onChange: (iso: string) => void;
  ariaLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = isoToLocalDate(value);
  const minDate = min ? isoToLocalDate(min) : undefined;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          aria-label={ariaLabel ? `${ariaLabel}: ${value ? formatDmy(value) : "not set"}` : undefined}
          className={cn("w-full justify-between font-normal tabular-nums", !value && "text-muted-foreground", className)}
        >
          {value ? formatDmy(value) : "DD-MM-YYYY"}
          <CalendarDays className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected ?? minDate}
          disabled={minDate ? { before: minDate } : undefined}
          onSelect={(d) => {
            if (!d) return;
            onChange(localDateToIso(d));
            setOpen(false);
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

/** Multi-select of same-department OICs (the list is loaded once and filtered here). */
function PersonPicker({
  candidates,
  department,
  selected,
  onChange,
  max,
  placeholder,
  ariaLabel,
}: {
  candidates: OicSubstitutePerson[];
  department: string;
  selected: OicSubstitutePerson[];
  onChange: (next: OicSubstitutePerson[]) => void;
  max: number;
  placeholder: string;
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const selectedIds = new Set(selected.map((s) => s.id));
  const atMax = selected.length >= max;
  const toggle = (person: OicSubstitutePerson) => {
    if (selectedIds.has(person.id)) onChange(selected.filter((s) => s.id !== person.id));
    else if (!atMax) onChange([...selected, person]);
  };
  const triggerText = selected.length
    ? selected.length === 1
      ? personName(selected[0])
      : `${personName(selected[0])} +${selected.length - 1}`
    : placeholder;

  return (
    <div className="min-w-0 space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label={ariaLabel}
            className="w-full justify-between font-normal"
          >
            <span className={cn("flex min-w-0 items-center gap-2", !selected.length && "text-muted-foreground")}>
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="truncate">{triggerText}</span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[16rem] p-0" align="start">
          <Command>
            <CommandInput placeholder="Type a name or email…" />
            <CommandList>
              <CommandEmpty>No OIC of your department matches.</CommandEmpty>
              <CommandGroup heading={department ? `OICs of ${department}` : undefined}>
                {candidates.map((person) => {
                  const isSelected = selectedIds.has(person.id);
                  return (
                    <CommandItem
                      key={person.id}
                      value={`${person.name} ${person.email} #${person.id}`}
                      onSelect={() => toggle(person)}
                      disabled={!isSelected && atMax}
                      className="gap-2"
                    >
                      <Check className={cn("h-4 w-4 shrink-0", isSelected ? "opacity-100" : "opacity-0")} aria-hidden />
                      <span className="min-w-0">
                        <span className="block truncate text-foreground">{person.name || person.email}</span>
                        {person.name && person.email ? (
                          <span className="block truncate text-xs text-muted-foreground">{person.email}</span>
                        ) : null}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selected.length > 1 ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="Selected substitutes">
          {selected.map((person) => (
            <li
              key={person.id}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-secondary py-0.5 pl-2.5 pr-0.5 text-xs text-secondary-foreground"
            >
              <span className="truncate">{personName(person)}</span>
              <button
                type="button"
                onClick={() => toggle(person)}
                className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Remove ${personName(person)}`}
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

type OpenByEquipment = Record<number, Array<{ name: string; status: string; until: string }>>;

function AssignPanel({
  options,
  candidates,
  openByEquipment,
  onCreated,
}: {
  options: OicSubstituteOptions;
  candidates: OicSubstitutePerson[];
  openByEquipment: OpenByEquipment;
  onCreated: () => void;
}) {
  const today = options.today || todayInIst();
  const max = options.max_substitutes ?? 5;
  const department = options.department?.name ?? "";
  const equipments = options.equipments;
  const [rows, setRows] = useState<Record<number, OicAssignRow>>({});
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [reason, setReason] = useState("");
  const [bulkSubs, setBulkSubs] = useState<OicSubstitutePerson[]>([]);
  const [filter, setFilter] = useState("");
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
  const [reviewOpen, setReviewOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const row = (id: number): OicAssignRow => rows[id] ?? emptyRow(startDate, endDate);
  const updateRow = (id: number, patch: Partial<OicAssignRow>) => {
    setRows((prev) => ({ ...prev, [id]: { ...(prev[id] ?? emptyRow(startDate, endDate)), ...patch } }));
    setRowErrors((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return equipments;
    return equipments.filter((e) => `${e.name} ${e.code}`.toLowerCase().includes(q));
  }, [equipments, filter]);

  const selectedCount = equipments.filter((e) => rows[e.id]?.selected).length;
  const visibleSelected = visible.filter((e) => rows[e.id]?.selected).length;
  const allVisibleSelected = visible.length > 0 && visibleSelected === visible.length;
  const plan = buildAssignPlan(equipments, rows, { startDate, endDate });
  const substituteCount = new Set(plan.flatMap((p) => p.substitutes.map((s) => s.id))).size;
  const sharedProblem = periodProblem(startDate, endDate, today);

  const setAllVisible = (checked: boolean) => {
    setRows((prev) => {
      const next = { ...prev };
      for (const e of visible) next[e.id] = { ...(prev[e.id] ?? emptyRow(startDate, endDate)), selected: checked };
      return next;
    });
  };

  const applyBulk = () => {
    if (!bulkSubs.length || !selectedCount) return;
    setRows((prev) => {
      const next = { ...prev };
      for (const e of equipments) {
        const r = prev[e.id];
        if (r?.selected) next[e.id] = { ...r, substitutes: bulkSubs };
      }
      return next;
    });
    setRowErrors({});
    toast.success(`${bulkSubs.map(personName).join(", ")} set for ${selectedCount} selected equipment.`);
  };

  const openReview = () => {
    if (!plan.length) {
      toast.error("Select at least one equipment.");
      return;
    }
    const problems = planProblems(plan, today);
    if (!reason.trim()) {
      toast.error("Please write the reason.");
      return;
    }
    if (Object.keys(problems).length) {
      setRowErrors(problems);
      toast.error("Some selected equipment need attention.");
      return;
    }
    setRowErrors({});
    setReviewOpen(true);
  };

  const submit = async () => {
    const assignments = planToAssignments(plan);
    setSubmitting(true);
    try {
      const res = await apiClient.createOicSubstitutionsBulk({
        assignments,
        start_date: startDate,
        end_date: endDate,
        reason: reason.trim(),
      });
      if (res.error) {
        const mapped = rowErrorsByEquipment(res.data?.row_errors, assignments);
        if (Object.keys(mapped).length) {
          setRowErrors(mapped);
          setReviewOpen(false);
        }
        toast.error(res.error);
        return;
      }
      toast.success(res.data?.message ?? "Substitutes assigned.");
      setReviewOpen(false);
      setRows({});
      setBulkSubs([]);
      setReason("");
      setStartDate(today);
      setEndDate(today);
      onCreated();
    } finally {
      setSubmitting(false);
    }
  };

  if (equipments.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
        You are not the permanent OIC of any equipment, so there is nothing to hand over.
      </p>
    );
  }
  if (!options.department) {
    return (
      <p className="rounded-lg border border-warning-border bg-warning-subtle p-4 text-sm text-warning-subtle-foreground">
        Your profile has no department, so substitutes cannot be chosen. Please ask the Main Administrator to set it.
      </p>
    );
  }

  return (
    <Card className="rounded-2xl border-border/70 shadow-[var(--shadow-card)]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <UserPlus className="h-5 w-5 text-primary" aria-hidden />
          Assign substitutes
        </CardTitle>
        <CardDescription>
          Tick the equipment to hand over and choose who manages each one. Give all of them to one OIC, or split them
          between OICs of your department. You keep your own access.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <section className="space-y-3" aria-labelledby="oic-sub-step1">
          <h3 id="oic-sub-step1" className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand text-xs text-brand-foreground">
              1
            </span>
            Equipment and substitutes
          </h3>

          <div className="space-y-3 rounded-xl border border-border bg-muted/40 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
                <Checkbox
                  checked={allVisibleSelected ? true : visibleSelected > 0 ? "indeterminate" : false}
                  onCheckedChange={(v) => setAllVisible(v === true)}
                  aria-label="Select all equipment"
                />
                {filter ? "Select all shown" : "Select all"} ({visible.length})
              </label>
              <span className="text-sm text-muted-foreground">
                {selectedCount} of {equipments.length} selected
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-start">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Same substitute for all selected</Label>
                <PersonPicker
                  candidates={candidates}
                  department={department}
                  selected={bulkSubs}
                  onChange={setBulkSubs}
                  max={max}
                  placeholder="Choose an OIC…"
                  ariaLabel="Substitute for all selected equipment"
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                className="sm:mt-5"
                disabled={!bulkSubs.length || selectedCount === 0}
                onClick={applyBulk}
              >
                Apply to {selectedCount} selected
              </Button>
            </div>
          </div>

          {equipments.length >= FILTER_FROM ? (
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter equipment by name or code"
                aria-label="Filter equipment"
                className="pl-9"
              />
            </div>
          ) : null}

          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {visible.map((eq) => {
              const r = row(eq.id);
              const error = rowErrors[eq.id];
              const open = openByEquipment[eq.id] ?? [];
              return (
                <li
                  key={eq.id}
                  className={cn(
                    "space-y-3 p-3 sm:p-4",
                    r.selected && "bg-accent/40",
                    error && "bg-destructive-subtle/60",
                  )}
                >
                  <div className="grid gap-3 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:items-center">
                    <label className="flex min-w-0 cursor-pointer items-start gap-3">
                      <Checkbox
                        className="mt-0.5"
                        checked={r.selected}
                        onCheckedChange={(v) => updateRow(eq.id, { selected: v === true })}
                        aria-label={`Select ${equipmentLabel(eq)}`}
                      />
                      <span className="min-w-0">
                        <span className="block break-words font-medium text-foreground">{equipmentLabel(eq)}</span>
                        {eq.name && eq.code ? <span className="block text-xs text-muted-foreground">{eq.code}</span> : null}
                        {open.length ? (
                          <span className="mt-1 block text-xs text-muted-foreground">
                            Current: {open.map((o) => `${o.name} (${o.status}, until ${o.until})`).join("; ")}
                          </span>
                        ) : null}
                      </span>
                    </label>
                    <PersonPicker
                      candidates={candidates}
                      department={department}
                      selected={r.substitutes}
                      onChange={(next) => updateRow(eq.id, { substitutes: next, selected: next.length ? true : r.selected })}
                      max={max}
                      placeholder="Choose substitute…"
                      ariaLabel={`Substitute for ${equipmentLabel(eq)}`}
                    />
                  </div>

                  {r.selected ? (
                    <div className="space-y-2 md:pl-7">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <CalendarRange className="h-3.5 w-3.5" aria-hidden />
                          {r.customDates
                            ? `Own dates: ${periodDmy(r.startDate, r.endDate)}`
                            : `Shared period: ${periodDmy(startDate, endDate)}`}
                        </span>
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-xs"
                          onClick={() =>
                            updateRow(eq.id, {
                              customDates: !r.customDates,
                              startDate: r.customDates ? r.startDate : startDate,
                              endDate: r.customDates ? r.endDate : endDate,
                            })
                          }
                        >
                          {r.customDates ? "Use the shared period" : "Different dates"}
                        </Button>
                      </div>
                      {r.customDates ? (
                        <div className="grid max-w-md grid-cols-2 gap-2">
                          <DmyDateField
                            value={r.startDate}
                            min={today}
                            ariaLabel={`From date for ${equipmentLabel(eq)}`}
                            onChange={(v) => updateRow(eq.id, { startDate: v, endDate: r.endDate < v ? v : r.endDate })}
                          />
                          <DmyDateField
                            value={r.endDate}
                            min={r.startDate || today}
                            ariaLabel={`Until date for ${equipmentLabel(eq)}`}
                            onChange={(v) => updateRow(eq.id, { endDate: v })}
                          />
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {error ? (
                    <p className="text-sm text-destructive md:pl-7" role="alert">
                      {error}
                    </p>
                  ) : null}
                </li>
              );
            })}
            {visible.length === 0 ? (
              <li className="p-6 text-center text-sm text-muted-foreground">No equipment matches the filter.</li>
            ) : null}
          </ul>
        </section>

        <section className="space-y-4" aria-labelledby="oic-sub-step2">
          <h3 id="oic-sub-step2" className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand text-xs text-brand-foreground">
              2
            </span>
            Period and reason
          </h3>
          <fieldset className="space-y-2">
            <legend className="sr-only">Shared period (IST)</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="oic-sub-start" className="text-xs text-muted-foreground">
                  From (IST)
                </Label>
                <DmyDateField
                  id="oic-sub-start"
                  value={startDate}
                  min={today}
                  onChange={(v) => {
                    setStartDate(v);
                    if (endDate < v) setEndDate(v);
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="oic-sub-end" className="text-xs text-muted-foreground">
                  Until (inclusive)
                </Label>
                <DmyDateField id="oic-sub-end" value={endDate} min={startDate || today} onChange={setEndDate} />
              </div>
            </div>
            {sharedProblem ? (
              <p className="text-sm text-destructive" role="alert">
                {sharedProblem}
              </p>
            ) : (
              <p className="flex items-start gap-2 text-sm text-muted-foreground">
                <CalendarRange className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>
                  Access {startDate === today ? "starts now" : `starts on ${formatDmy(startDate)}`} and ends automatically
                  at 11:59 PM IST on {formatDmy(endDate)}. Applies to every selected equipment without its own dates.
                </span>
              </p>
            )}
          </fieldset>
          <div className="space-y-2">
            <Label htmlFor="oic-sub-reason">Reason</Label>
            <Textarea
              id="oic-sub-reason"
              value={reason}
              maxLength={REASON_MAX}
              rows={3}
              placeholder="For example: on leave for a conference; urgent approvals must continue."
              onChange={(e) => setReason(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Required. Kept in the history and shared with the people notified.</p>
          </div>
        </section>

        <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {plan.length
              ? `${plan.length} equipment selected${substituteCount ? ` · ${substituteCount} substitute${substituteCount === 1 ? "" : "s"}` : ""}`
              : "No equipment selected yet."}
          </p>
          <Button type="button" onClick={openReview} disabled={!plan.length || submitting} className="sm:min-w-[11rem]">
            <ClipboardCheck className="mr-2 h-4 w-4" aria-hidden />
            Review and assign
          </Button>
        </div>
      </CardContent>

      <ReviewDialog
        open={reviewOpen}
        plan={plan}
        reason={reason.trim()}
        today={today}
        submitting={submitting}
        onClose={() => !submitting && setReviewOpen(false)}
        onConfirm={submit}
      />
    </Card>
  );
}

function ReviewDialog({
  open,
  plan,
  reason,
  today,
  submitting,
  onClose,
  onConfirm,
}: {
  open: boolean;
  plan: OicAssignPlanItem[];
  reason: string;
  today: string;
  submitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const groups = planBySubstitute(plan);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Review substitutes</DialogTitle>
          <DialogDescription>
            {plan.length} equipment to {groups.length} substitute{groups.length === 1 ? "" : "s"}. Nothing is saved until
            you confirm; if any row has a problem, nothing is assigned.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-3">
          {groups.map((g) => (
            <li key={g.substitute.id} className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center gap-3">
                <PersonAvatar person={g.substitute} />
                <div className="min-w-0">
                  <p className="break-words font-medium text-foreground">{personName(g.substitute)}</p>
                  {g.substitute.email && g.substitute.name ? (
                    <p className="break-all text-xs text-muted-foreground">{g.substitute.email}</p>
                  ) : null}
                </div>
                <span className="ml-auto shrink-0 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                  {g.items.length} equipment
                </span>
              </div>
              <ul className="mt-3 space-y-1.5 text-sm">
                {g.items.map((it) => (
                  <li key={it.equipment.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <span className="min-w-0 break-words text-foreground">
                      {equipmentLabel(it.equipment)}
                      {it.equipment.name && it.equipment.code ? (
                        <span className="text-muted-foreground"> · {it.equipment.code}</span>
                      ) : null}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {it.startDate === today ? "From now" : formatDmy(it.startDate)} to {formatDmy(it.endDate)}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
        <div className="rounded-xl border border-border bg-muted/40 p-3 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Reason</p>
          <p className="mt-1 whitespace-pre-line break-words text-foreground">{reason}</p>
        </div>
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <Mail className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            Each substitute gets one email listing all their equipment. Each Lab in-charge gets one email covering the
            equipment they look after, and you get one summary. Access ends automatically at 11:59 PM IST on the last day.
          </span>
        </p>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Back to edit
          </Button>
          <Button type="button" onClick={onConfirm} disabled={submitting}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <Check className="mr-2 h-4 w-4" aria-hidden />}
            Confirm and assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type Perspective = "granted" | "assigned" | "admin";

function SubstitutionRow({
  item,
  perspective,
  selectable,
  selected,
  onToggle,
  onEnd,
}: {
  item: OicSubstitution;
  perspective: Perspective;
  selectable: boolean;
  selected: boolean;
  onToggle: (checked: boolean) => void;
  onEnd: (items: OicSubstitution[]) => void;
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const ended = item.status === "revoked" || item.status === "cancelled";
  const days = substitutionDays(item);
  return (
    <li className={cn("p-3 sm:p-4", selected && "bg-accent/40")}>
      <div className="flex items-start gap-3">
        {selectable ? (
          <Checkbox
            className="mt-1"
            checked={selected}
            onCheckedChange={(v) => onToggle(v === true)}
            aria-label={`Select ${equipmentLabel(item.equipment)}`}
          />
        ) : null}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="min-w-0 break-words font-medium text-foreground">
              {equipmentLabel(item.equipment)}
              {item.equipment.name && item.equipment.code ? (
                <span className="text-sm font-normal text-muted-foreground"> · {item.equipment.code}</span>
              ) : null}
            </p>
            <StatusBadge item={item} />
          </div>
          <p className="text-sm tabular-nums text-muted-foreground">
            <CalendarRange className="mr-1 inline h-3.5 w-3.5 align-[-2px]" aria-hidden />
            {periodDmy(days.start, days.end)} <span className="text-xs">(IST, until 11:59 PM)</span>
          </p>
          {perspective === "admin" ? (
            <p className="text-sm text-muted-foreground">
              OIC: <span className="text-foreground">{personName(item.primary_oic)}</span>
            </p>
          ) : null}
          <p className="line-clamp-2 whitespace-pre-line break-words text-sm text-foreground">
            <span className="text-muted-foreground">Reason: </span>
            {item.reason || "—"}
          </p>
          {ended ? (
            <p className="whitespace-pre-line break-words text-sm text-foreground">
              <span className="text-muted-foreground">
                {item.status === "cancelled" ? "Cancelled" : "Revoked"} by {personName(item.ended_by)}
                {item.ended_at ? ` on ${dateTimeLabel(item.ended_at)}` : ""}:{" "}
              </span>
              {item.end_reason || "—"}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <Collapsible open={historyOpen} onOpenChange={setHistoryOpen} className="min-w-0 flex-1">
              <CollapsibleTrigger asChild>
                <Button type="button" variant="ghost" size="sm" className="-ml-2 gap-1.5 text-muted-foreground">
                  <History className="h-4 w-4" aria-hidden />
                  History ({item.events.length})
                  <ChevronDown className={cn("h-4 w-4 transition-transform", historyOpen && "rotate-180")} aria-hidden />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ol className="mt-2 space-y-2 border-l border-border pl-4">
                  {item.events.map((ev) => (
                    <li key={ev.id} className="text-sm">
                      <p className="text-foreground">
                        <span className="font-medium">{ev.action_label}</span>
                        <span className="text-muted-foreground"> · {ev.actor_name} · {dateTimeLabel(ev.created_at)}</span>
                      </p>
                      {ev.reason ? <p className="whitespace-pre-line break-words text-muted-foreground">{ev.reason}</p> : null}
                    </li>
                  ))}
                </ol>
              </CollapsibleContent>
            </Collapsible>
            {item.can_end ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-destructive-border text-destructive hover:bg-destructive-subtle hover:text-destructive"
                onClick={() => onEnd([item])}
              >
                {endActionLabel(item.status)}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </li>
  );
}

function endVerb(items: OicSubstitution[]): string {
  const labels = new Set(items.map((i) => endActionLabel(i.status)));
  return labels.size === 1 ? [...labels][0] : "End";
}

function GroupedTab({
  items,
  perspective,
  emptyText,
  onEnd,
}: {
  items: OicSubstitution[];
  perspective: Perspective;
  emptyText: string;
  onEnd: (items: OicSubstitution[]) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const groups = useMemo(
    () => groupByPerson(items, perspective === "assigned" ? "primary_oic" : "substitute"),
    [items, perspective],
  );
  const endable = items.filter((i) => i.can_end);
  const canSelect = perspective !== "assigned" && endable.length > 0;

  useEffect(() => {
    setSelectedIds((prev) => {
      const ids = new Set(items.filter((i) => i.can_end).map((i) => i.id));
      const next = new Set([...prev].filter((id) => ids.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [items]);

  const toggle = (ids: number[], checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };
  const selectedItems = endable.filter((i) => selectedIds.has(i.id));

  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{emptyText}</p>
    );
  }

  return (
    <div className="space-y-3">
      {canSelect ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
            <Checkbox
              checked={
                selectedItems.length === endable.length ? true : selectedItems.length > 0 ? "indeterminate" : false
              }
              onCheckedChange={(v) => toggle(endable.map((i) => i.id), v === true)}
              aria-label="Select all in this tab"
            />
            {selectedItems.length ? `${selectedItems.length} selected` : `Select all (${endable.length})`}
          </label>
          <div className="flex flex-wrap gap-2">
            {selectedItems.length ? (
              <>
                <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                  Clear
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-destructive-border text-destructive hover:bg-destructive-subtle hover:text-destructive"
                  onClick={() => onEnd(selectedItems)}
                >
                  {endVerb(selectedItems)} selected ({selectedItems.length})
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-destructive-border text-destructive hover:bg-destructive-subtle hover:text-destructive"
                onClick={() => onEnd(endable)}
              >
                {endVerb(endable)} all ({endable.length})
              </Button>
            )}
          </div>
        </div>
      ) : null}

      <ul className="space-y-3">
        {groups.map((g) => {
          const groupEndable = g.items.filter((i) => i.can_end);
          const groupSelected = groupEndable.filter((i) => selectedIds.has(i.id)).length;
          return (
            <li key={g.key} className="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
              <div className="flex flex-wrap items-center gap-3 border-b border-border bg-muted/30 px-3 py-2.5 sm:px-4">
                {canSelect && groupEndable.length ? (
                  <Checkbox
                    checked={groupSelected === groupEndable.length ? true : groupSelected > 0 ? "indeterminate" : false}
                    onCheckedChange={(v) => toggle(groupEndable.map((i) => i.id), v === true)}
                    aria-label={`Select all for ${personName(g.person)}`}
                  />
                ) : null}
                <PersonAvatar person={g.person} />
                <div className="min-w-0 flex-1">
                  <p className="break-words font-semibold text-foreground">
                    {perspective === "assigned" ? "Granted by " : ""}
                    {personName(g.person)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {g.items.length} equipment
                    {g.person?.email && g.person.name ? <span className="break-all"> · {g.person.email}</span> : null}
                  </p>
                </div>
                {perspective !== "assigned" && groupEndable.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:bg-destructive-subtle hover:text-destructive"
                    onClick={() => onEnd(groupEndable)}
                  >
                    {endVerb(groupEndable)} all ({groupEndable.length})
                  </Button>
                ) : null}
              </div>
              <ul className="divide-y divide-border">
                {g.items.map((item) => (
                  <SubstitutionRow
                    key={item.id}
                    item={item}
                    perspective={perspective}
                    selectable={canSelect && item.can_end}
                    selected={selectedIds.has(item.id)}
                    onToggle={(checked) => toggle([item.id], checked)}
                    onEnd={onEnd}
                  />
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SubstitutionTabs({
  items,
  perspective,
  onEnd,
  emptyText,
}: {
  items: OicSubstitution[];
  perspective: Perspective;
  onEnd: (items: OicSubstitution[]) => void;
  emptyText: Record<OicSubstituteTab, string>;
}) {
  const groups = useMemo(() => groupSubstitutions(items), [items]);
  const initial: OicSubstituteTab = groups.active.length ? "active" : groups.scheduled.length ? "scheduled" : "active";
  const [tab, setTab] = useState<OicSubstituteTab>(initial);
  const tabs: Array<{ id: OicSubstituteTab; label: string }> = [
    { id: "active", label: "Active" },
    { id: "scheduled", label: "Scheduled" },
    { id: "past", label: "Past" },
  ];
  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as OicSubstituteTab)}>
      <TabsList className="grid w-full grid-cols-3 sm:inline-flex sm:w-auto">
        {tabs.map((t) => (
          <TabsTrigger key={t.id} value={t.id}>
            {t.label} ({groups[t.id].length})
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((t) => (
        <TabsContent key={t.id} value={t.id} className="mt-4">
          <GroupedTab items={groups[t.id]} perspective={perspective} emptyText={emptyText[t.id]} onEnd={onEnd} />
        </TabsContent>
      ))}
    </Tabs>
  );
}

function EndDialog({
  items,
  onClose,
  onEnded,
}: {
  items: OicSubstitution[] | null;
  onClose: () => void;
  onEnded: () => void;
}) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const key = items?.map((i) => i.id).join(",") ?? "";
  useEffect(() => {
    setReason("");
  }, [key]);
  if (!items?.length) return null;
  const verb = endVerb(items);
  const groups = groupByPerson(items, "substitute");
  const single = items.length === 1 ? items[0] : null;
  const confirm = async () => {
    if (!reason.trim()) return;
    setSaving(true);
    try {
      const res = single
        ? await apiClient.endOicSubstitution(single.id, reason.trim())
        : await apiClient.endOicSubstitutionsBulk(
            items.map((i) => i.id),
            reason.trim(),
          );
      if (res.error) {
        toast.error(res.error);
        if (!single) onEnded();
        return;
      }
      toast.success(res.data?.message ?? "Substitution ended.");
      onEnded();
      onClose();
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {verb} {single ? "substitute access" : `${items.length} substitutions`}
          </DialogTitle>
          <DialogDescription>
            {single
              ? `${personName(single.substitute)} will lose OIC access to ${equipmentLabel(single.equipment)} immediately.`
              : "These substitutes lose OIC access to the equipment below immediately."}{" "}
            Each person involved gets one notification.
          </DialogDescription>
        </DialogHeader>
        {!single ? (
          <ul className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-border bg-muted/40 p-3 text-sm">
            {groups.map((g) => (
              <li key={g.key}>
                <p className="font-medium text-foreground">{personName(g.person)}</p>
                <p className="break-words text-muted-foreground">{g.items.map((i) => equipmentLabel(i.equipment)).join(", ")}</p>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="oic-sub-end-reason">Reason</Label>
          <Textarea
            id="oic-sub-end-reason"
            value={reason}
            maxLength={REASON_MAX}
            rows={3}
            autoFocus
            placeholder="For example: back from leave earlier than planned."
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Keep access
          </Button>
          <Button type="button" variant="destructive" onClick={confirm} disabled={saving || !reason.trim()}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
            {verb} {single ? "access" : `${items.length}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const GRANTED_EMPTY: Record<OicSubstituteTab, string> = {
  active: "No substitute currently has access to your equipment.",
  scheduled: "No substitutions are scheduled.",
  past: "No past substitutions yet.",
};

const ASSIGNED_EMPTY: Record<OicSubstituteTab, string> = {
  active: "You are not currently a substitute for any equipment.",
  scheduled: "No upcoming substitute assignments for you.",
  past: "No past substitute assignments.",
};

const ADMIN_EMPTY: Record<OicSubstituteTab, string> = {
  active: "No substitutions are active.",
  scheduled: "No substitutions are scheduled.",
  past: "No past substitutions match.",
};

function openSubstitutionsByEquipment(granted: OicSubstitution[]): OpenByEquipment {
  const out: OpenByEquipment = {};
  for (const item of granted) {
    if (item.status !== "active" && item.status !== "scheduled") continue;
    const days = substitutionDays(item);
    (out[item.equipment.id] ??= []).push({
      name: personName(item.substitute),
      status: item.status_label.toLowerCase(),
      until: formatDmy(days.end),
    });
  }
  return out;
}

export default function OICSubstitute() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const userType = user?.user_type != null ? String(user.user_type).toLowerCase() : "";
  const role: "oic" | "admin" | null = userType === "manager" ? "oic" : userType === "admin" ? "admin" : null;

  const [options, setOptions] = useState<OicSubstituteOptions | null>(null);
  const [candidates, setCandidates] = useState<OicSubstitutePerson[]>([]);
  const [granted, setGranted] = useState<OicSubstitution[]>([]);
  const [assigned, setAssigned] = useState<OicSubstitution[]>([]);
  const [adminItems, setAdminItems] = useState<OicSubstitution[]>([]);
  const [adminSearch, setAdminSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [ending, setEnding] = useState<OicSubstitution[] | null>(null);

  const load = useCallback(async () => {
    if (!role) return;
    const res = await apiClient.getOicSubstitutions(role === "admin" ? { search: adminSearch } : {});
    setLoading(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    if (res.data?.scope === "admin") {
      setAdminItems(res.data.items ?? []);
    } else {
      setGranted(res.data?.granted ?? []);
      setAssigned(res.data?.assigned_to_me ?? []);
    }
  }, [role, adminSearch]);

  useEffect(() => {
    if (role !== "oic") return;
    apiClient.getOicSubstituteOptions().then((res) => {
      if (res.error) toast.error(res.error);
      else setOptions(res.data ?? null);
    });
    apiClient.searchOicSubstituteCandidates("", CANDIDATE_FETCH_LIMIT).then((res) => {
      if (!res.error) setCandidates(res.data?.candidates ?? []);
    });
  }, [role]);

  useEffect(() => {
    if (!role) return;
    const handle = window.setTimeout(load, role === "admin" ? 300 : 0);
    return () => window.clearTimeout(handle);
  }, [role, load]);

  const openByEquipment = useMemo(() => openSubstitutionsByEquipment(granted), [granted]);

  return (
    <PageShell>
      <main className="container mx-auto max-w-5xl space-y-6 px-4 py-5">
        <StandaloneOnly>
          <PageHero
            compact
            icon={<UserCheck className="h-5 w-5" />}
            title="OIC Substitute"
            description="Hand one, several or all of your equipment to OICs of your department for a period, with a full history."
            actions={
              <Button
                variant="outline"
                size="sm"
                className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white"
                onClick={() => navigate("/dashboard")}
              >
                <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
                Dashboard
              </Button>
            }
          />
        </StandaloneOnly>

        {authLoading ? null : !role ? (
          <p className="rounded-lg border border-border p-6 text-sm text-muted-foreground">
            OIC Substitute is available to Officers in Charge and the Main Administrator.
          </p>
        ) : role === "oic" ? (
          <>
            {options ? (
              <AssignPanel
                options={options}
                candidates={candidates}
                openByEquipment={openByEquipment}
                onCreated={load}
              />
            ) : (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Loading" />
              </div>
            )}

            <section className="space-y-3" aria-labelledby="oic-sub-granted">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 id="oic-sub-granted" className="flex items-center gap-2 text-lg font-semibold text-foreground">
                    <Users className="h-5 w-5 text-primary" aria-hidden />
                    Substitutes you assigned
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Grouped by substitute. Tick several to revoke or cancel them together; a reason is required. Access also
                    ends automatically when the period is over.
                  </p>
                </div>
                <ExportMenu
                  report="oic-substitutes"
                  noun="substitutions"
                  description="Substitutions you assigned, those assigned to you, and their history"
                  disabled={loading}
                />
              </div>
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Loading" />
              ) : (
                <SubstitutionTabs items={granted} perspective="granted" onEnd={setEnding} emptyText={GRANTED_EMPTY} />
              )}
            </section>

            {assigned.length ? (
              <section className="space-y-3" aria-labelledby="oic-sub-assigned">
                <div>
                  <h2 id="oic-sub-assigned" className="text-lg font-semibold text-foreground">
                    Equipment assigned to you as substitute
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    While a substitution is active, the equipment appears in your OIC menus (bookings, approvals, slots,
                    waitlist, urgent requests and configuration).
                  </p>
                </div>
                <SubstitutionTabs items={assigned} perspective="assigned" onEnd={setEnding} emptyText={ASSIGNED_EMPTY} />
              </section>
            ) : null}
          </>
        ) : (
          <section className="space-y-4" aria-labelledby="oic-sub-admin">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 id="oic-sub-admin" className="text-lg font-semibold text-foreground">
                  All OIC substitutions
                </h2>
                <p className="text-sm text-muted-foreground">
                  Every substitution with its reason and history, grouped by substitute. You can revoke any active or
                  scheduled one, or several together.
                </p>
              </div>
              <div className="flex w-full items-center gap-2 sm:w-auto">
                <div className="relative w-full sm:w-72">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Input
                    value={adminSearch}
                    onChange={(e) => setAdminSearch(e.target.value)}
                    placeholder="Equipment, OIC or substitute"
                    aria-label="Search substitutions"
                    className="pl-9"
                  />
                </div>
                <ExportMenu
                  report="oic-substitutes"
                  noun="substitutions"
                  description="All substitutions matching the search, with their history"
                  getParams={() => ({ search: adminSearch.trim() || undefined })}
                />
              </div>
            </div>
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Loading" />
            ) : (
              <SubstitutionTabs items={adminItems} perspective="admin" onEnd={setEnding} emptyText={ADMIN_EMPTY} />
            )}
          </section>
        )}
      </main>
      <EndDialog items={ending} onClose={() => setEnding(null)} onEnded={load} />
    </PageShell>
  );
}
