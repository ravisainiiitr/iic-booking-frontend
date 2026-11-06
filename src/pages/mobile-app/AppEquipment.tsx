import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronDown, MapPin, PackageSearch, Search, SlidersHorizontal, Star, X } from "lucide-react";
import EquipmentImage from "@/components/EquipmentImage";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  loadCatalogDepartments,
  loadCatalogEquipment,
  peekCatalogEquipment,
  type CatalogDepartment,
  type CatalogEquipmentRow,
} from "@/lib/catalogCache";
import { filterCatalogEquipmentForDisplay, isCatalogFamilyParent } from "@/lib/equipmentCatalog";
import { cn } from "@/lib/utils";
import { AppScreen, Card, ChoiceChips, EmptyState, ErrorState, ListSkeleton, StatusPill } from "./ui";

type Row = CatalogEquipmentRow & { avg_rating?: number | null; rating_count?: number | null; make?: string | null; model_information?: string | null };

function matches(eq: Row, words: string[]) {
  const text = [eq.name, eq.code, eq.location, eq.category_name, eq.internal_department_name, eq.profile_type_display, eq.make, eq.model_information]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return words.every((w) => text.includes(w));
}

function statusTone(status: string) {
  return String(status).toUpperCase() === "ACTIVE" ? ("success" as const) : ("warning" as const);
}

function EquipmentCard({ eq, family, expanded, onToggleFamily }: { eq: Row; family: boolean; expanded: boolean; onToggleFamily: () => void }) {
  const body = (
    <Card className="flex gap-3 p-3 text-left active:bg-muted/50">
      <EquipmentImage equipmentId={eq.equipment_id} alt="" sizes="88px" className="h-[88px] w-[88px] shrink-0 rounded-xl object-cover" />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 font-semibold leading-snug text-foreground">{eq.name}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{eq.internal_department_name || eq.category_name || eq.code}</p>
        {eq.location ? (
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" aria-hidden /> {eq.location}
          </p>
        ) : null}
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <StatusPill tone={statusTone(eq.status)}>{eq.status_display}</StatusPill>
          {eq.avg_rating && eq.rating_count ? (
            <span className="flex items-center gap-0.5 text-xs font-medium text-muted-foreground">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden /> {Number(eq.avg_rating).toFixed(1)}
            </span>
          ) : null}
          {family ? (
            <span className="flex items-center gap-0.5 text-xs font-medium text-primary">
              Modes <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} aria-hidden />
            </span>
          ) : null}
        </div>
      </div>
    </Card>
  );
  if (family) {
    return (
      <button type="button" className="block w-full" aria-expanded={expanded} onClick={onToggleFamily}>
        {body}
      </button>
    );
  }
  return (
    <Link to={`/app/equipment/${eq.equipment_id}`} className="block">
      {body}
    </Link>
  );
}

export default function AppEquipment() {
  const [params] = useSearchParams();
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [departments, setDepartments] = useState<CatalogDepartment[]>([]);
  const [department, setDepartment] = useState<"all" | number>("all");
  const [category, setCategory] = useState("all");
  const [type, setType] = useState("all");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [expandedParent, setExpandedParent] = useState<number | null>(null);
  const [rows, setRows] = useState<Row[] | null>(() => (peekCatalogEquipment("all", null)?.data as Row[] | undefined) ?? null);
  const [error, setError] = useState("");

  const load = useCallback((dept: "all" | number) => {
    setError("");
    const cached = peekCatalogEquipment(dept, null);
    setRows((cached?.data as Row[] | undefined) ?? null);
    loadCatalogEquipment(dept, null)
      .then((list) => setRows(list as Row[]))
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => load(department), [department, load]);
  useEffect(() => {
    void loadCatalogDepartments().then((list) => setDepartments(list ?? []));
  }, []);
  useEffect(() => {
    if (params.get("search") === "1") searchRef.current?.focus();
  }, [params]);

  const words = useMemo(() => query.toLowerCase().split(/\s+/).filter(Boolean), [query]);
  const searching = words.length > 0;

  const categories = useMemo(() => [...new Set((rows ?? []).map((r) => r.category_name).filter((c): c is string => Boolean(c)))].sort(), [rows]);
  const types = useMemo(() => [...new Set((rows ?? []).map((r) => r.profile_type_display).filter(Boolean))].sort(), [rows]);

  const visible = useMemo(() => {
    if (!rows) return [];
    const filtered = rows.filter(
      (r) =>
        (category === "all" || r.category_name === category) &&
        (type === "all" || r.profile_type_display === type) &&
        (!availableOnly || String(r.status).toUpperCase() === "ACTIVE") &&
        (!searching || matches(r, words)),
    );
    return filterCatalogEquipmentForDisplay(filtered, expandedParent, { searchActive: searching });
  }, [rows, category, type, availableOnly, searching, words, expandedParent]);

  const activeFilters = (department !== "all" ? 1 : 0) + (category !== "all" ? 1 : 0) + (type !== "all" ? 1 : 0);
  const clearFilters = () => {
    setDepartment("all");
    setCategory("all");
    setType("all");
    setAvailableOnly(false);
    setQuery("");
  };

  return (
    <AppScreen
      title="Equipment"
      subtitle={rows ? `${visible.length} of ${rows.length} shown` : undefined}
      toolbar={
        <div className="space-y-2.5">
          <div className="flex gap-2">
            <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-background px-3">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="sr-only">Search equipment</span>
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search equipment"
                className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
              />
              {query ? (
                <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="-mr-1 flex h-8 w-8 items-center justify-center text-muted-foreground">
                  <X className="h-4 w-4" aria-hidden />
                </button>
              ) : null}
            </label>
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              aria-label={activeFilters ? `Filters, ${activeFilters} on` : "Filters"}
              className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-foreground active:bg-muted"
            >
              <SlidersHorizontal className="h-5 w-5" aria-hidden />
              {activeFilters ? (
                <span className="absolute -right-1 -top-1 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">{activeFilters}</span>
              ) : null}
            </button>
          </div>
          <ChoiceChips
            label="Availability"
            value={availableOnly ? "available" : "all"}
            onChange={(v) => setAvailableOnly(v === "available")}
            options={[
              { value: "all", label: "All" },
              { value: "available", label: "Operational now" },
            ]}
          />
        </div>
      }
    >
      {error && !rows ? (
        <ErrorState message={error} onRetry={() => load(department)} />
      ) : !rows ? (
        <ListSkeleton rows={6} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<PackageSearch className="h-6 w-6" aria-hidden />}
          title="No equipment found"
          hint="Try a different word, or clear the filters."
          action={<Button variant="outline" className="h-11" onClick={clearFilters}>Clear search and filters</Button>}
        />
      ) : (
        <ul className="space-y-3">
          {visible.map((eq) => {
            const family = isCatalogFamilyParent(rows, eq.equipment_id, { searchActive: searching });
            return (
              <li key={eq.equipment_id} className="[content-visibility:auto] [contain-intrinsic-size:auto_114px]">
                <EquipmentCard
                  eq={eq}
                  family={family}
                  expanded={expandedParent === eq.equipment_id}
                  onToggleFamily={() => setExpandedParent((cur) => (cur === eq.equipment_id ? null : eq.equipment_id))}
                />
              </li>
            );
          })}
        </ul>
      )}

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="bottom" className="max-h-[80dvh] overflow-y-auto rounded-t-3xl pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <SheetHeader className="text-left">
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-5">
            <FilterGroup title="Department">
              <FilterOption active={department === "all"} onClick={() => setDepartment("all")}>All departments</FilterOption>
              {departments.map((d) => (
                <FilterOption key={d.id} active={department === d.id} onClick={() => setDepartment(d.id)}>{d.name}</FilterOption>
              ))}
            </FilterGroup>
            {categories.length > 0 ? (
              <FilterGroup title="Category">
                <FilterOption active={category === "all"} onClick={() => setCategory("all")}>All categories</FilterOption>
                {categories.map((c) => (
                  <FilterOption key={c} active={category === c} onClick={() => setCategory(c)}>{c}</FilterOption>
                ))}
              </FilterGroup>
            ) : null}
            {types.length > 1 ? (
              <FilterGroup title="Testing facility">
                <FilterOption active={type === "all"} onClick={() => setType("all")}>All types</FilterOption>
                {types.map((t) => (
                  <FilterOption key={t} active={type === t} onClick={() => setType(t)}>{t}</FilterOption>
                ))}
              </FilterGroup>
            ) : null}
            <Button className="h-12 w-full text-base" onClick={() => setFiltersOpen(false)}>Show {visible.length} results</Button>
          </div>
        </SheetContent>
      </Sheet>
    </AppScreen>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold text-foreground">{title}</h3>
      <div className="flex flex-wrap gap-2">{children}</div>
    </section>
  );
}

function FilterOption({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "min-h-10 rounded-full border px-3.5 py-1.5 text-left text-sm font-medium transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground active:bg-muted",
      )}
    >
      {children}
    </button>
  );
}
