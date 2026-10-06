import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { ArrowLeft, CalendarRange, Check, ChevronDown, History, Loader2, Search, UserCheck, UserPlus, X } from "lucide-react";

import { PageHero, PageShell, StandaloneOnly } from "@/components/PageShell";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api";
import {
  endActionLabel,
  groupSubstitutions,
  substitutionStatusClass,
  todayInIst,
  type OicSubstituteOptions,
  type OicSubstitutePerson,
  type OicSubstituteTab,
  type OicSubstitution,
} from "@/lib/oicSubstitute";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const REASON_MAX = 2000;

function personLabel(p: OicSubstitutePerson | null | undefined): string {
  if (!p) return "—";
  return p.name || p.email || "—";
}

function dateLabel(iso: string): string {
  try {
    return format(parseISO(iso), "d MMM yyyy");
  } catch {
    return iso;
  }
}

function dateTimeLabel(iso: string | null): string {
  if (!iso) return "";
  try {
    return format(parseISO(iso), "d MMM yyyy, h:mm a");
  } catch {
    return iso;
  }
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

function SubstitutePicker({
  selected,
  onChange,
  max,
  disabled,
}: {
  selected: OicSubstitutePerson[];
  onChange: (next: OicSubstitutePerson[]) => void;
  max: number;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<OicSubstitutePerson[]>([]);
  const [loading, setLoading] = useState(false);
  const [department, setDepartment] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    const handle = window.setTimeout(() => {
      apiClient.searchOicSubstituteCandidates(query).then((res) => {
        if (cancelled) return;
        setLoading(false);
        if (res.error) {
          setResults([]);
          return;
        }
        setResults(res.data?.candidates ?? []);
        setDepartment(res.data?.department?.name ?? "");
      });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [open, query]);

  const selectedIds = new Set(selected.map((s) => s.id));
  const atMax = selected.length >= max;

  const toggle = (person: OicSubstitutePerson) => {
    if (selectedIds.has(person.id)) {
      onChange(selected.filter((s) => s.id !== person.id));
    } else if (!atMax) {
      onChange([...selected, person]);
    }
  };

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between font-normal"
          >
            <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
              <Search className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">
                {selected.length ? `${selected.length} selected — add or remove` : "Search OICs of your department…"}
              </span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[16rem] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder="Type a name or email…" value={query} onValueChange={setQuery} />
            <CommandList>
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Searching…
                </div>
              ) : (
                <>
                  <CommandEmpty>No OIC of your department matches.</CommandEmpty>
                  <CommandGroup heading={department ? `OICs of ${department}` : undefined}>
                    {results.map((person) => {
                      const isSelected = selectedIds.has(person.id);
                      return (
                        <CommandItem
                          key={person.id}
                          value={String(person.id)}
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
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selected.length ? (
        <ul className="flex flex-wrap gap-2" aria-label="Selected substitutes">
          {selected.map((person) => (
            <li
              key={person.id}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-secondary py-1 pl-3 pr-1 text-sm text-secondary-foreground"
            >
              <span className="truncate">{person.name || person.email}</span>
              <button
                type="button"
                onClick={() => toggle(person)}
                className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Remove ${person.name || person.email}`}
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Only active OICs of your own department are listed. Up to {max} substitutes.
      </p>
    </div>
  );
}

function AssignForm({ options, onCreated }: { options: OicSubstituteOptions; onCreated: () => void }) {
  const today = options.today || todayInIst();
  const max = options.max_substitutes ?? 5;
  const [equipmentId, setEquipmentId] = useState("");
  const [substitutes, setSubstitutes] = useState<OicSubstitutePerson[]>([]);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const noEquipment = options.equipments.length === 0;
  const noDepartment = !options.department;
  const periodError =
    startDate && startDate < today
      ? "The start date cannot be in the past."
      : startDate && endDate && endDate < startDate
        ? "The end date must be on or after the start date."
        : "";
  const canSubmit =
    !submitting && !!equipmentId && substitutes.length > 0 && !!startDate && !!endDate && !periodError && reason.trim().length > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await apiClient.createOicSubstitution({
        equipment_id: Number(equipmentId),
        substitute_ids: substitutes.map((s) => s.id),
        start_date: startDate,
        end_date: endDate,
        reason: reason.trim(),
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(res.data?.message ?? "Substitute assigned.");
      setSubstitutes([]);
      setReason("");
      setStartDate(today);
      setEndDate(today);
      onCreated();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="rounded-2xl border-border/70 shadow-[var(--shadow-card)]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <UserPlus className="h-5 w-5 text-primary" aria-hidden />
          Assign a substitute
        </CardTitle>
        <CardDescription>
          The substitute can manage the equipment with the same OIC permissions for the chosen days. You keep your own
          access. They and the equipment&apos;s Lab in-charges are notified.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {noEquipment ? (
          <p className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            You are not the permanent OIC of any equipment, so there is nothing to hand over.
          </p>
        ) : noDepartment ? (
          <p className="rounded-lg border border-warning-border bg-warning-subtle p-4 text-sm text-warning-subtle-foreground">
            Your profile has no department, so substitutes cannot be searched. Please ask the Main Administrator to set it.
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="oic-sub-equipment">Equipment</Label>
                <Select value={equipmentId} onValueChange={setEquipmentId}>
                  <SelectTrigger id="oic-sub-equipment">
                    <SelectValue placeholder="Select equipment" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.equipments.map((eq) => (
                      <SelectItem key={eq.id} value={String(eq.id)}>
                        {eq.name || eq.code}
                        {eq.name && eq.code ? <span className="text-muted-foreground"> · {eq.code}</span> : null}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Equipment you are the permanent OIC of.</p>
              </div>
              <div className="space-y-2">
                <Label>Substitute OIC(s)</Label>
                <SubstitutePicker selected={substitutes} onChange={setSubstitutes} max={max} />
              </div>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium leading-none">Period (IST)</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="oic-sub-start" className="text-xs text-muted-foreground">
                    From
                  </Label>
                  <Input
                    id="oic-sub-start"
                    type="date"
                    value={startDate}
                    min={today}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      if (endDate && e.target.value > endDate) setEndDate(e.target.value);
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="oic-sub-end" className="text-xs text-muted-foreground">
                    Until (inclusive)
                  </Label>
                  <Input
                    id="oic-sub-end"
                    type="date"
                    value={endDate}
                    min={startDate || today}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
              {periodError ? (
                <p className="text-sm text-destructive" role="alert">
                  {periodError}
                </p>
              ) : startDate && endDate ? (
                <p className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CalendarRange className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>
                    Access {startDate === today ? "starts now" : `starts on ${dateLabel(startDate)}`} and ends automatically at
                    11:59 PM IST on {dateLabel(endDate)}.
                  </span>
                </p>
              ) : null}
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

            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button type="submit" disabled={!canSubmit} className="min-w-[10rem]">
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    Assigning…
                  </>
                ) : (
                  "Assign substitute"
                )}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function SubstitutionCard({
  item,
  perspective,
  onEnd,
}: {
  item: OicSubstitution;
  perspective: "granted" | "assigned" | "admin";
  onEnd: (item: OicSubstitution) => void;
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const ended = item.status === "revoked" || item.status === "cancelled";
  return (
    <li className="rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="break-words font-semibold text-foreground">{item.equipment.name || item.equipment.code}</p>
          {item.equipment.name && item.equipment.code ? (
            <p className="text-xs text-muted-foreground">{item.equipment.code}</p>
          ) : null}
        </div>
        <StatusBadge item={item} />
      </div>

      <dl className="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
        {perspective !== "assigned" ? (
          <div className="min-w-0">
            <dt className="text-xs text-muted-foreground">Substitute</dt>
            <dd className="break-words text-foreground">{personLabel(item.substitute)}</dd>
          </div>
        ) : null}
        {perspective !== "granted" ? (
          <div className="min-w-0">
            <dt className="text-xs text-muted-foreground">{perspective === "assigned" ? "Granted by" : "OIC"}</dt>
            <dd className="break-words text-foreground">{personLabel(item.primary_oic)}</dd>
          </div>
        ) : null}
        <div className="min-w-0 sm:col-span-2">
          <dt className="text-xs text-muted-foreground">Period (IST)</dt>
          <dd className="text-foreground">
            {item.start_display} – {item.end_display}
          </dd>
        </div>
        <div className="min-w-0 sm:col-span-2">
          <dt className="text-xs text-muted-foreground">Reason</dt>
          <dd className="whitespace-pre-line break-words text-foreground">{item.reason || "—"}</dd>
        </div>
        {ended ? (
          <div className="min-w-0 sm:col-span-2">
            <dt className="text-xs text-muted-foreground">
              {item.status === "cancelled" ? "Cancelled" : "Revoked"} by {personLabel(item.ended_by)}
              {item.ended_at ? ` on ${dateTimeLabel(item.ended_at)}` : ""}
            </dt>
            <dd className="whitespace-pre-line break-words text-foreground">{item.end_reason || "—"}</dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
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
            onClick={() => onEnd(item)}
          >
            {endActionLabel(item.status)}
          </Button>
        ) : null}
      </div>
    </li>
  );
}

function SubstitutionTabs({
  items,
  perspective,
  onEnd,
  emptyText,
}: {
  items: OicSubstitution[];
  perspective: "granted" | "assigned" | "admin";
  onEnd: (item: OicSubstitution) => void;
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
          {groups[t.id].length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              {emptyText[t.id]}
            </p>
          ) : (
            <ul className="grid gap-3 lg:grid-cols-2">
              {groups[t.id].map((item) => (
                <SubstitutionCard key={item.id} item={item} perspective={perspective} onEnd={onEnd} />
              ))}
            </ul>
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}

function EndDialog({
  item,
  onClose,
  onEnded,
}: {
  item: OicSubstitution | null;
  onClose: () => void;
  onEnded: () => void;
}) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setReason("");
  }, [item?.id]);
  if (!item) return null;
  const action = endActionLabel(item.status);
  const confirm = async () => {
    if (!reason.trim()) return;
    setSaving(true);
    try {
      const res = await apiClient.endOicSubstitution(item.id, reason.trim());
      if (res.error) {
        toast.error(res.error);
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
          <DialogTitle>{action} substitute access</DialogTitle>
          <DialogDescription>
            {personLabel(item.substitute)} will lose OIC access to {item.equipment.name || item.equipment.code} immediately.
            They and the Lab in-charges are notified.
          </DialogDescription>
        </DialogHeader>
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
            {action} access
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

export default function OICSubstitute() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const userType = user?.user_type != null ? String(user.user_type).toLowerCase() : "";
  const role: "oic" | "admin" | null = userType === "manager" ? "oic" : userType === "admin" ? "admin" : null;

  const [options, setOptions] = useState<OicSubstituteOptions | null>(null);
  const [granted, setGranted] = useState<OicSubstitution[]>([]);
  const [assigned, setAssigned] = useState<OicSubstitution[]>([]);
  const [adminItems, setAdminItems] = useState<OicSubstitution[]>([]);
  const [adminSearch, setAdminSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [ending, setEnding] = useState<OicSubstitution | null>(null);

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
  }, [role]);

  useEffect(() => {
    if (!role) return;
    const handle = window.setTimeout(load, role === "admin" ? 300 : 0);
    return () => window.clearTimeout(handle);
  }, [role, load]);

  return (
    <PageShell>
      <main className="container mx-auto max-w-5xl space-y-6 px-4 py-5">
        <StandaloneOnly>
          <PageHero
            compact
            icon={<UserCheck className="h-5 w-5" />}
            title="OIC Substitute"
            description="Let another OIC of your department manage your equipment for a period, with a full history."
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
              <AssignForm options={options} onCreated={load} />
            ) : (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Loading" />
              </div>
            )}

            <section className="space-y-3" aria-labelledby="oic-sub-granted">
              <div>
                <h2 id="oic-sub-granted" className="text-lg font-semibold text-foreground">
                  Substitutes you assigned
                </h2>
                <p className="text-sm text-muted-foreground">
                  Revoke active access or cancel a scheduled one at any time; a reason is required. Access also ends
                  automatically when the period is over.
                </p>
              </div>
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Loading" />
              ) : (
                <SubstitutionTabs
                  items={granted}
                  perspective="granted"
                  onEnd={setEnding}
                  emptyText={GRANTED_EMPTY}
                />
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
                <SubstitutionTabs
                  items={assigned}
                  perspective="assigned"
                  onEnd={setEnding}
                  emptyText={ASSIGNED_EMPTY}
                />
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
                  Every substitution with its reason and history. You can revoke any active or scheduled one.
                </p>
              </div>
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
            </div>
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Loading" />
            ) : (
              <SubstitutionTabs
                items={adminItems}
                perspective="admin"
                onEnd={setEnding}
                emptyText={ADMIN_EMPTY}
              />
            )}
          </section>
        )}
      </main>
      <EndDialog item={ending} onClose={() => setEnding(null)} onEnded={load} />
    </PageShell>
  );
}
