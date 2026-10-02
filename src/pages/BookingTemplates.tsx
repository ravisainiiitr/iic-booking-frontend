import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  BookmarkCheck,
  Building2,
  CalendarCheck,
  CalendarClock,
  Copy,
  Layers,
  ListFilter,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient, type BookingTemplate } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useEmbeddedMode } from "@/contexts/EmbeddedModeContext";
import { PageHero, PageShell, StandaloneOnly, heroButtonClass } from "@/components/PageShell";
import { InlineError } from "@/components/my-research/researchUi";
import { NewBookingTemplateDialog } from "@/components/booking-templates/NewBookingTemplateDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  BOOKING_TEMPLATES_PATH,
  TEMPLATE_OPTION_LABELS,
  templateSlotSummary,
  bookWithTemplateUrl,
  copyTemplateName,
  createTemplateUrl,
  duplicateTemplateBody,
  editTemplateUrl,
  formatTemplateUpdated,
  shortPreferredSlotLabel,
} from "@/lib/bookingTemplates";
import { cn } from "@/lib/utils";

type SortKey = "equipment" | "updated" | "name";
const ALL = "all";

const SORT_LABELS: Record<SortKey, string> = {
  equipment: "Group by equipment",
  updated: "Recently updated",
  name: "Name (A–Z)",
};

const equipmentLabel = (t: BookingTemplate) => t.equipment_name || t.equipment_code || `Equipment #${t.equipment}`;

const idParam = (raw: string | null) => (raw && /^\d+$/.test(raw) ? raw : ALL);

type EquipmentGroup = { equipmentId: number; templates: BookingTemplate[] };

export default function BookingTemplates() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const embedded = useEmbeddedMode();
  const { user, loading: authLoading } = useAuth();

  const [templates, setTemplates] = useState<BookingTemplate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState(() => idParam(searchParams.get("department")));
  const [equipmentFilter, setEquipmentFilter] = useState(() => idParam(searchParams.get("equipment")));
  const [sort, setSort] = useState<SortKey>("equipment");
  const [newOpen, setNewOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<BookingTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await apiClient.listBookingTemplates();
    if (res.error || !res.data) {
      setError(res.error || "Could not load your booking templates.");
    } else {
      setTemplates(res.data.templates ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!apiClient.getToken() || !user) {
      navigate("/auth");
      return;
    }
    void load();
  }, [authLoading, user, navigate, load]);

  const all = useMemo(() => templates ?? [], [templates]);

  const departments = useMemo(() => {
    const seen = new Map<number, string>();
    for (const t of all) {
      if (t.department_id != null && !seen.has(t.department_id)) seen.set(t.department_id, t.department_name || "Department");
    }
    return [...seen.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [all]);

  const equipmentOptions = useMemo(() => {
    const seen = new Map<number, BookingTemplate>();
    for (const t of all) {
      if (departmentFilter !== ALL && String(t.department_id) !== departmentFilter) continue;
      if (!seen.has(t.equipment)) seen.set(t.equipment, t);
    }
    return [...seen.values()]
      .map((t) => ({ id: t.equipment, name: equipmentLabel(t), code: t.equipment_code }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [all, departmentFilter]);

  useEffect(() => {
    if (equipmentFilter !== ALL && templates && !equipmentOptions.some((o) => String(o.id) === equipmentFilter)) {
      setEquipmentFilter(ALL);
    }
  }, [equipmentFilter, equipmentOptions, templates]);

  const templateCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const t of all) counts.set(t.equipment, (counts.get(t.equipment) ?? 0) + 1);
    return counts;
  }, [all]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = all.filter((t) => {
      if (departmentFilter !== ALL && String(t.department_id) !== departmentFilter) return false;
      if (equipmentFilter !== ALL && String(t.equipment) !== equipmentFilter) return false;
      if (!q) return true;
      return [t.name, t.equipment_name, t.equipment_code, t.department_name].some((f) => (f || "").toLowerCase().includes(q));
    });
    const byName = (a: BookingTemplate, b: BookingTemplate) => a.name.localeCompare(b.name);
    if (sort === "updated") {
      return [...list].sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || "") || byName(a, b));
    }
    if (sort === "name") return [...list].sort(byName);
    return [...list].sort(
      (a, b) => equipmentLabel(a).localeCompare(equipmentLabel(b)) || a.equipment - b.equipment || byName(a, b)
    );
  }, [all, query, departmentFilter, equipmentFilter, sort]);

  const groups = useMemo<EquipmentGroup[]>(() => {
    if (sort !== "equipment") return [];
    const out: EquipmentGroup[] = [];
    for (const t of filtered) {
      const last = out[out.length - 1];
      if (last && last.equipmentId === t.equipment) last.templates.push(t);
      else out.push({ equipmentId: t.equipment, templates: [t] });
    }
    return out;
  }, [filtered, sort]);

  const stats = useMemo(
    () => ({
      templates: all.length,
      equipment: templateCounts.size,
      withSlot: all.filter((t) => t.preferred_slot).length,
    }),
    [all, templateCounts]
  );

  const filtersActive = query.trim() !== "" || departmentFilter !== ALL || equipmentFilter !== ALL;
  const clearFilters = () => {
    setQuery("");
    setDepartmentFilter(ALL);
    setEquipmentFilter(ALL);
  };

  const startCreate = (equipmentId: number) => {
    setNewOpen(false);
    navigate(createTemplateUrl(equipmentId, BOOKING_TEMPLATES_PATH));
  };

  const duplicate = async (t: BookingTemplate) => {
    const siblings = all.filter((x) => x.equipment === t.equipment).map((x) => x.name);
    setDuplicatingId(t.id);
    const res = await apiClient.createBookingTemplate(duplicateTemplateBody(t, copyTemplateName(t.name, siblings)));
    setDuplicatingId(null);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not duplicate the template.");
      return;
    }
    const copy = res.data;
    setTemplates((prev) => [...(prev ?? []), copy]);
    toast.success(
      t.if_slot_taken && t.if_slot_taken !== "ask"
        ? `Created "${copy.name}". If its slot is taken you now choose again; edit it to turn automatic booking back on.`
        : `Created "${copy.name}".`
    );
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    const res = await apiClient.deleteBookingTemplate(pendingDelete.id);
    setDeleting(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    const removed = pendingDelete;
    setTemplates((prev) => (prev ?? []).filter((t) => t.id !== removed.id));
    setPendingDelete(null);
    toast.success(`Template "${removed.name}" deleted.`);
  };

  if (!user) return null;

  const userDepartmentId = Number((user as { department?: unknown }).department);
  const dialogDepartmentId =
    departmentFilter !== ALL
      ? Number(departmentFilter)
      : Number.isInteger(userDepartmentId) && userDepartmentId > 0
        ? userDepartmentId
        : null;

  const newButton = (className?: string) => (
    <Button className={cn("gap-2", className)} onClick={() => setNewOpen(true)}>
      <Plus className="h-4 w-4" aria-hidden /> New template
    </Button>
  );

  const cardFor = (t: BookingTemplate, showEquipment: boolean) => (
    <TemplateCard
      key={t.id}
      template={t}
      showEquipment={showEquipment}
      duplicating={duplicatingId === t.id}
      onBook={() => navigate(bookWithTemplateUrl(t))}
      onEdit={() => navigate(editTemplateUrl(t, BOOKING_TEMPLATES_PATH))}
      onDuplicate={() => void duplicate(t)}
      onDelete={() => setPendingDelete(t)}
    />
  );

  return (
    <PageShell>
      <main className="container mx-auto space-y-5 px-4 py-5">
        <StandaloneOnly>
          <PageHero
            compact
            title="Booking templates"
            description="Save your usual sample details, booking options and preferred weekly slot per instrument, then book in one click when slots open."
            icon={<BookmarkCheck className="h-5 w-5" />}
            meta={
              templates ? (
                <>
                  <span>
                    {stats.templates} template{stats.templates === 1 ? "" : "s"}
                  </span>
                  <span>
                    {stats.equipment} instrument{stats.equipment === 1 ? "" : "s"}
                  </span>
                  <span>{stats.withSlot} with a preferred slot</span>
                </>
              ) : null
            }
            actions={
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => void load()}
                  disabled={loading}
                  aria-label="Refresh booking templates"
                  title="Refresh"
                  className={`h-9 w-9 ${heroButtonClass.icon}`}
                >
                  <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} aria-hidden />
                </Button>
                {newButton(heroButtonClass.primary)}
              </>
            }
          />
        </StandaloneOnly>

        <section
          aria-label="Search and filter templates"
          className="rounded-xl border border-border/80 bg-card p-3 shadow-sm sm:p-4"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative lg:w-72 xl:w-80">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search template or equipment…"
                aria-label="Search template or equipment"
                className="h-9 pl-9"
              />
            </div>
            <div className="grid flex-1 gap-2 sm:grid-cols-3">
              <Select value={departmentFilter} onValueChange={setDepartmentFilter} disabled={departments.length === 0}>
                <SelectTrigger className="h-9" aria-label="Filter by department">
                  <SelectValue placeholder="All departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All departments</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={equipmentFilter} onValueChange={setEquipmentFilter} disabled={equipmentOptions.length === 0}>
                <SelectTrigger className="h-9" aria-label="Filter by equipment">
                  <SelectValue placeholder="All equipment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All equipment</SelectItem>
                  {equipmentOptions.map((o) => (
                    <SelectItem key={o.id} value={String(o.id)}>
                      {o.name}
                      {o.code ? ` (${o.code})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
                <SelectTrigger className="h-9" aria-label="Sort templates">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {SORT_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {embedded ? (
              <div className="flex items-center gap-2 lg:shrink-0">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => void load()}
                  disabled={loading}
                  aria-label="Refresh booking templates"
                  title="Refresh"
                >
                  <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} aria-hidden />
                </Button>
                {newButton("h-9 flex-1 lg:flex-none")}
              </div>
            ) : null}
          </div>
          {templates && all.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <ListFilter className="h-3.5 w-3.5" aria-hidden />
                Showing {filtered.length} of {all.length} template{all.length === 1 ? "" : "s"}
              </span>
              {filtersActive ? (
                <Button variant="ghost" size="sm" className="h-6 gap-1 px-2 text-xs" onClick={clearFilters}>
                  <X className="h-3 w-3" aria-hidden /> Clear filters
                </Button>
              ) : null}
            </div>
          ) : null}
        </section>

        {error && !templates ? (
          <InlineError message={error} onRetry={() => void load()} />
        ) : loading && !templates ? (
          <TemplatesSkeleton />
        ) : all.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-14 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary dark:text-sky-200">
              <BookmarkCheck className="h-7 w-7" aria-hidden />
            </div>
            <h2 className="mt-4 text-lg font-semibold tracking-tight">No booking templates yet</h2>
            <p className="mx-auto mt-1.5 max-w-lg text-sm text-muted-foreground">
              A template remembers an instrument's sample details, your booking options and, if you like, a preferred
              weekly slot. Choose it when booking and only the slot is left to pick.
            </p>
            <div className="mt-5 flex justify-center">{newButton()}</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-border/80 bg-card px-6 py-10 text-center shadow-sm">
            <p className="font-medium">No templates match these filters.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={clearFilters}>
              Clear filters
            </Button>
          </div>
        ) : sort === "equipment" ? (
          <div className="space-y-6">
            {error ? <InlineError message={error} onRetry={() => void load()} /> : null}
            {groups.map((g) => {
              const first = g.templates[0];
              return (
                <section key={g.equipmentId} aria-labelledby={`tpl-eq-${g.equipmentId}`} className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-2">
                    <div className="min-w-0">
                      <h2 id={`tpl-eq-${g.equipmentId}`} className="flex flex-wrap items-center gap-2 text-base font-semibold tracking-tight">
                        <Layers className="h-4 w-4 text-primary dark:text-sky-300" aria-hidden />
                        <span className="truncate">{equipmentLabel(first)}</span>
                        {first.equipment_code ? (
                          <Badge variant="outline" className="font-mono text-[0.7rem] font-normal">
                            {first.equipment_code}
                          </Badge>
                        ) : null}
                        <Badge variant="secondary" className="font-normal">
                          {g.templates.length}
                        </Badge>
                      </h2>
                      {first.department_name ? (
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Building2 className="h-3.5 w-3.5" aria-hidden /> {first.department_name}
                        </p>
                      ) : null}
                    </div>
                    {first.bookable !== false ? (
                      <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => startCreate(g.equipmentId)}>
                        <Plus className="h-4 w-4" aria-hidden /> Add template
                      </Button>
                    ) : null}
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{g.templates.map((t) => cardFor(t, false))}</div>
                </section>
              );
            })}
          </div>
        ) : (
          <div className="space-y-3">
            {error ? <InlineError message={error} onRetry={() => void load()} /> : null}
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{filtered.map((t) => cardFor(t, true))}</div>
          </div>
        )}
      </main>

      <NewBookingTemplateDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        initialDepartmentId={dialogDepartmentId}
        templateCounts={templateCounts}
        onContinue={startCreate}
      />

      <AlertDialog open={pendingDelete != null} onOpenChange={(open) => !open && !deleting && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this template?</AlertDialogTitle>
            <AlertDialogDescription>
              “{pendingDelete?.name}” for {pendingDelete ? equipmentLabel(pendingDelete) : "this equipment"} will be
              removed. Your bookings are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}

function TemplateCard({
  template: t,
  showEquipment,
  duplicating,
  onBook,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  template: BookingTemplate;
  showEquipment: boolean;
  duplicating: boolean;
  onBook: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const updated = formatTemplateUpdated(t.updated_at);
  const summary = t.input_summary ?? [];
  const sets = t.sample_set_count ?? 1;
  const options = TEMPLATE_OPTION_LABELS.filter(([key]) => t.options?.[key] === true);
  const blocked = t.bookable === false;
  const slots = templateSlotSummary(t);

  return (
    <article className="flex h-full flex-col rounded-xl border border-border/80 bg-card shadow-sm transition-shadow hover:shadow-md dark:hover:border-primary/40">
      <div className="flex items-start justify-between gap-2 px-4 pt-4">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold tracking-tight" title={t.name}>
            {t.name}
          </h3>
          {showEquipment ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {equipmentLabel(t)}
              {t.equipment_code ? ` · ${t.equipment_code}` : ""}
              {t.department_name ? ` · ${t.department_name}` : ""}
            </p>
          ) : null}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="-mr-2 -mt-1 h-8 w-8 shrink-0" aria-label={`More actions for ${t.name}`}>
              {duplicating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <MoreHorizontal className="h-4 w-4" aria-hidden />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="mr-2 h-4 w-4" aria-hidden /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicate} disabled={duplicating || blocked}>
              <Copy className="mr-2 h-4 w-4" aria-hidden /> Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
              <Trash2 className="mr-2 h-4 w-4" aria-hidden /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-1 flex-col gap-3 px-4 py-3">
        {summary.length > 0 ? (
          <dl className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
            {summary.map((item) => (
              <div key={item.key} className="contents">
                <dt className="truncate text-muted-foreground" title={item.label}>
                  {item.label}
                </dt>
                <dd className="truncate font-medium text-foreground" title={item.value}>
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">No sample details saved yet.</p>
        )}

        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary" className="font-normal">
            {sets} sample set{sets === 1 ? "" : "s"}
          </Badge>
          {options.slice(0, 2).map(([key, label]) => (
            <Badge key={key} variant="outline" className="font-normal">
              {label}
            </Badge>
          ))}
          {options.length > 2 ? (
            <Badge variant="outline" className="font-normal" title={options.slice(2).map(([, l]) => l).join(", ")}>
              +{options.length - 2} more
            </Badge>
          ) : null}
        </div>

        <div className="rounded-lg border border-border/70 bg-muted/40 px-3 py-2 text-sm dark:bg-muted/20">
          <div className="flex items-start gap-2">
            <CalendarClock
              className={cn("mt-0.5 h-4 w-4 shrink-0", t.preferred_slot ? "text-primary dark:text-sky-300" : "text-muted-foreground")}
              aria-hidden
            />
            <div className="min-w-0">
              <p className={cn(t.preferred_slot ? "font-medium text-foreground" : "text-muted-foreground")}>
                {t.preferred_slot ? shortPreferredSlotLabel(t.preferred_slot) : slots.choice}
              </p>
              <p className={cn("text-xs", slots.autoBooks ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground")}>
                {slots.fallbackLabel}
              </p>
            </div>
          </div>
        </div>

        {blocked ? (
          <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            {t.booking_block_reason || "You cannot book this equipment right now."}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-4 py-3">
        <span className="text-xs text-muted-foreground">{updated ? `Updated ${updated}` : ""}</span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={onBook}
            disabled={blocked}
            title={blocked ? t.booking_block_reason || undefined : "Open the booking page with this template filled in"}
          >
            <CalendarCheck className="h-3.5 w-3.5" aria-hidden /> Book now
          </Button>
        </div>
      </div>
    </article>
  );
}

function TemplatesSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading booking templates">
      <Skeleton className="h-5 w-56" />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-xl border border-border/80 bg-card p-4">
            <Skeleton className="h-4 w-2/3" />
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
              <Skeleton className="h-3 w-3/4" />
            </div>
            <Skeleton className="h-12 w-full" />
            <div className="flex justify-end gap-2">
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-8 w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
