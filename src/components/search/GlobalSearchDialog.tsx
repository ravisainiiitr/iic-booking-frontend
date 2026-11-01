import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
  ArrowRight,
  CalendarClock,
  Clock,
  FileSearch,
  FlaskConical,
  IdCard,
  LayoutGrid,
  UserRound,
  Loader2,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { Command as CommandPrimitive } from "cmdk";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useAutomationFeatures } from "@/components/automation/useAutomationFeatures";
import { useUserCard } from "@/components/users/UserIdCardLink";
import { apiClient, type GlobalSearchResult } from "@/lib/api";
import type { ModeInactive } from "@/lib/modeAvailability";
import { ModeInactivePill } from "@/components/modeAvailability/ModeInactiveNotice";
import { TrainingRequiredBadge } from "@/components/training/AuthorisationGateCard";
import { useGatedEquipmentIds } from "@/components/training/useAuthorisation";
import { cn } from "@/lib/utils";
import { SEARCH_SHORTCUT_LABEL } from "./GlobalSearch";
import { SearchContacts } from "./SearchContacts";
import {
  bookingHref,
  clearRecentSearches,
  loadRecentSearches,
  matchPages,
  pagesFor,
  rememberSearch,
  searchablePages,
} from "./searchCatalog";
import { menuActionsFor } from "./menuActions";
import { adminSettingsTiles } from "@/pages/adminSettingsTiles";

const DEBOUNCE_MS = 200;

const STATUS_TONE: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100",
  PENDING_PAYMENT: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100",
  WAITLISTED: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100",
  BOOKED: "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-100",
  PROCESSING: "bg-violet-100 text-violet-900 dark:bg-violet-900/40 dark:text-violet-100",
  COMPLETED: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100",
};

function StatusPill({ status, label }: { status: string; label: string }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
        STATUS_TONE[status] ?? "bg-rose-100 text-rose-900 dark:bg-rose-900/40 dark:text-rose-100",
      )}
    >
      {label}
    </span>
  );
}

/** Photo, or initials when there is none or it cannot be loaded. */
function PersonAvatar({ name, photoUrl }: { name: string; photoUrl?: string | null }) {
  const [failed, setFailed] = useState(false);
  const initials = name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w) && !/^(dr|prof|mr|mrs|ms)\.?$/i.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return photoUrl && !failed ? (
    <img
      src={photoUrl}
      alt=""
      width={36}
      height={36}
      loading="lazy"
      onError={() => setFailed(true)}
      className="mr-3 h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-border"
    />
  ) : (
    <span className="mr-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary dark:text-sky-300" aria-hidden>
      {initials || <UserRound className="h-4 w-4" />}
    </span>
  );
}

function shortDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return format(new Date(iso), "d MMM yyyy, HH:mm");
  } catch {
    return "";
  }
}

/** Base whose other mode runs on its own today: listed, not bookable (search API ``mode_inactive``). */
function modeInactiveOf(e: GlobalSearchResult["equipment"][number]): ModeInactive | null {
  return (e as { mode_inactive?: ModeInactive | null }).mode_inactive ?? null;
}

const SECONDARY = "truncate text-xs text-muted-foreground group-data-[selected=true]:text-current group-data-[selected=true]:opacity-90";

const EMPTY: GlobalSearchResult = { query: "", equipment: [], bookings: [], people: [], people_enabled: false };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Bumped on every open so the field resets to ``initialQuery``. */
  openToken: number;
  initialQuery: string;
};

/** The search palette itself; loaded on first use so cmdk stays out of the entry bundle. */
export default function GlobalSearchDialog({ open, onOpenChange, openToken, initialQuery }: Props) {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { openUserCard } = useUserCard();
  const gatedIds = useGatedEquipmentIds(isAuthenticated && open);
  const finderOn = Boolean(useAutomationFeatures(isAuthenticated && open)?.instrument_finder);
  const [query, setQuery] = useState(initialQuery);
  const [result, setResult] = useState<GlobalSearchResult>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [recent, setRecent] = useState<string[]>(() => loadRecentSearches());
  const abortRef = useRef<AbortController | null>(null);

  const pages = useMemo(() => pagesFor(user?.user_type, isAuthenticated), [user?.user_type, isAuthenticated]);
  const trimmed = query.trim();
  // Fixed pages, the user's own dashboard menu and their Admin Settings tiles (re-read on every open).
  const actionPages = useMemo(
    () => (open && isAuthenticated ? searchablePages(pages, menuActionsFor(user?.id), adminSettingsTiles(user)) : pages),
    [open, isAuthenticated, pages, user],
  );
  const pageHits = useMemo(() => matchPages(actionPages, trimmed, 8), [actionPages, trimmed]);
  const staffView = Boolean(result.staff_view);

  useEffect(() => {
    setQuery(initialQuery);
    setRecent(loadRecentSearches());
    // Only a new open resets the field, not edits to the initial query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openToken]);

  useEffect(() => {
    abortRef.current?.abort();
    if (!open || trimmed.length < 2) {
      setResult(EMPTY);
      setLoading(false);
      setFailed(false);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;
    const timer = window.setTimeout(async () => {
      const res = await apiClient.globalSearch(trimmed, controller.signal);
      if (controller.signal.aborted) return;
      setLoading(false);
      if (!res.error && res.data?.equipment) {
        setResult(res.data);
        setFailed(false);
      } else {
        setResult(EMPTY);
        setFailed(true);
      }
    }, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, trimmed]);

  const go = (path: string) => {
    if (trimmed) setRecent(rememberSearch(trimmed));
    onOpenChange(false);
    navigate(path);
  };

  const openPerson = (id: number) => {
    if (trimmed) setRecent(rememberSearch(trimmed));
    onOpenChange(false);
    openUserCard(id);
  };

  const searching = trimmed.length >= 2;
  const isStaffUser =
    isAuthenticated && (staffView || ["admin", "dept_admin", "manager", "operator"].includes(String(user?.user_type ?? "").toLowerCase()));
  const hasHits = pageHits.length + result.equipment.length + result.bookings.length + result.people.length > 0;
  const placeholder = isAuthenticated
    ? isStaffUser
      ? "Search booking ID, equipment, a person, a page or a setting…"
      : "Search equipment, your bookings, people, pages or settings…"
    : "Search equipment and pages…";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="top-[12vh] max-w-2xl translate-y-0 gap-0 overflow-hidden p-0 shadow-2xl sm:rounded-xl [&>button:last-child]:hidden"
      >
        <DialogTitle className="sr-only">Search the portal</DialogTitle>
        <DialogDescription className="sr-only">
          Type at least two characters. Use the arrow keys to move through results and Enter to open one.
        </DialogDescription>
        <Command shouldFilter={false} loop className="rounded-none">
          <div className="flex items-center gap-2 border-b px-4" cmdk-input-wrapper="">
            {loading ? (
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-muted-foreground" aria-hidden />
            ) : (
              <Search className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
            )}
            <CommandPrimitive.Input
              value={query}
              onValueChange={setQuery}
              placeholder={placeholder}
              aria-label="Search"
              className="flex h-14 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            ) : null}
            <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline">
              Esc
            </kbd>
          </div>
          <CommandList className="max-h-[min(60vh,520px)]">
            {!searching ? (
              <>
                {recent.length > 0 ? (
                  <CommandGroup
                    heading={
                      <span className="flex items-center justify-between">
                        Recent searches
                        <button
                          type="button"
                          className="text-[11px] font-normal text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            clearRecentSearches();
                            setRecent([]);
                          }}
                        >
                          Clear
                        </button>
                      </span>
                    }
                  >
                    {recent.map((r) => (
                      <CommandItem key={`recent-${r}`} value={`recent-${r}`} onSelect={() => setQuery(r)}>
                        <Clock className="mr-3 h-4 w-4 text-muted-foreground" aria-hidden />
                        {r}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ) : null}
                <CommandGroup heading="Go to">
                  {pages.slice(0, isAuthenticated ? 6 : 4).map((p) => (
                    <CommandItem key={p.path} value={`page-${p.path}`} onSelect={() => go(p.path)}>
                      <LayoutGrid className="mr-3 h-4 w-4 text-muted-foreground" aria-hidden />
                      {p.title}
                    </CommandItem>
                  ))}
                  {finderOn ? (
                    <CommandItem value="page-instrument-finder" onSelect={() => go("/find-instrument")}>
                      <Sparkles className="mr-3 h-4 w-4 text-muted-foreground" aria-hidden />
                      Instrument finder
                      <span className="ml-2 truncate text-xs text-muted-foreground">describe your sample and goal</span>
                    </CommandItem>
                  ) : null}
                </CommandGroup>
                <p className="px-4 pb-4 pt-1 text-xs text-muted-foreground">
                  {!isAuthenticated
                    ? "Tip: type an instrument name, code or what you want to measure, e.g. XRD, crystal structure or thermal stability. Sign in to search your bookings."
                    : isStaffUser
                      ? "Tip: type a booking ID (e.g. IICXRD2026…), an equipment name, code or technique, a user's name, email or phone, or a page or setting such as change slot status."
                      : "Tip: type a booking ID (e.g. IICXRD2026…), an equipment name or code, a technique such as surface morphology, a person, or a page such as wallet."}
                </p>
              </>
            ) : null}

            {searching && !loading && !hasHits ? (
              <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                {failed ? (
                  "Search is unavailable right now. Please try again in a moment."
                ) : (
                  <>
                    No matches for <span className="font-medium text-foreground">“{trimmed}”</span>.
                    <br />
                    Try another word for the technique, or search by booking ID or equipment code.
                  </>
                )}
              </div>
            ) : null}

            {searching && pageHits.length > 0 ? (
              <CommandGroup heading="Pages and settings">
                {pageHits.map((p) => (
                  <CommandItem key={p.path} value={`page-${p.path}`} onSelect={() => go(p.path)}>
                    <LayoutGrid className="mr-3 h-4 w-4 text-muted-foreground" aria-hidden />
                    {p.title}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {searching && result.bookings.length > 0 ? (
              <CommandGroup heading="Bookings">
                {result.bookings.map((b) => (
                  <CommandItem
                    key={`b-${b.id}`}
                    value={`booking-${b.id}`}
                    onSelect={() => go(bookingHref(b, staffView))}
                    className="group items-start"
                  >
                    <CalendarClock className="mr-3 mt-0.5 h-4 w-4 shrink-0 text-muted-foreground group-data-[selected=true]:text-current" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-semibold">{b.virtual_booking_id}</span>
                        <StatusPill status={b.status} label={b.status_label} />
                      </div>
                      <p className={SECONDARY}>
                        {b.equipment}
                        {b.slot_start ? ` · ${shortDate(b.slot_start)}` : ""}
                      </p>
                    </div>
                  </CommandItem>
                ))}
                {staffView ? (
                  <CommandItem
                    value="booking-all"
                    onSelect={() => go(`/booking-management?search=${encodeURIComponent(trimmed)}`)}
                  >
                    <FileSearch className="mr-3 h-4 w-4 text-muted-foreground" aria-hidden />
                    See all matching bookings
                    <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" aria-hidden />
                  </CommandItem>
                ) : null}
              </CommandGroup>
            ) : null}

            {searching && result.equipment.length > 0 ? (
              <CommandGroup heading="Equipment">
                {result.suggestion && result.suggestion.toLowerCase() !== trimmed.toLowerCase() ? (
                  <CommandItem value="equipment-suggestion" onSelect={() => setQuery(result.suggestion ?? "")}>
                    <Sparkles className="mr-3 h-4 w-4 text-muted-foreground" aria-hidden />
                    <span className="text-sm text-muted-foreground">
                      Did you mean <span className="font-medium text-foreground">{result.suggestion}</span>?
                    </span>
                  </CommandItem>
                ) : null}
                {result.equipment.map((e) => (
                  <CommandItem
                    key={`e-${e.id}`}
                    value={`equipment-${e.id}`}
                    onSelect={() => go(`/equipment/${e.id}`)}
                    className="group items-start"
                  >
                    <FlaskConical className="mr-3 mt-0.5 h-4 w-4 shrink-0 text-muted-foreground group-data-[selected=true]:text-current" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        <span className="truncate">{e.name}</span>
                        {e.status && e.status !== "ACTIVE" ? (
                          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
                            {e.status === "DISPOSED" ? "Disposed" : "Under maintenance"}
                          </span>
                        ) : modeInactiveOf(e) ? (
                          <ModeInactivePill info={modeInactiveOf(e)!} />
                        ) : null}
                        {gatedIds.has(Number(e.id)) ? <TrainingRequiredBadge /> : null}
                      </p>
                      <p className={SECONDARY}>
                        {e.code}
                        {e.category ? ` · ${e.category}` : ""}
                        {e.department ? ` · ${e.department}` : ""}
                      </p>
                      {e.hint ? (
                        <p className="truncate text-[11px] italic text-muted-foreground group-data-[selected=true]:text-current group-data-[selected=true]:opacity-80">
                          {e.hint}
                        </p>
                      ) : null}
                      {modeInactiveOf(e) ? <p className={SECONDARY}>{modeInactiveOf(e)!.message}</p> : null}
                      <SearchContacts contacts={e.contacts} />
                    </div>
                    {isAuthenticated && !modeInactiveOf(e) && String(user?.user_type ?? "").toLowerCase() !== "finance" ? (
                      <button
                        type="button"
                        className="ml-2 shrink-0 rounded-md border px-2 py-1 text-xs font-medium text-primary opacity-0 transition-opacity hover:bg-primary hover:text-primary-foreground group-hover:opacity-100 group-data-[selected=true]:opacity-100"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          go(`/book-equipment?equipment_id=${e.id}`);
                        }}
                      >
                        Book
                      </button>
                    ) : null}
                  </CommandItem>
                ))}
                <CommandItem value="equipment-all" onSelect={() => go(`/equipments?q=${encodeURIComponent(trimmed)}`)}>
                  <FileSearch className="mr-3 h-4 w-4 text-muted-foreground" aria-hidden />
                  Search the equipment catalogue
                  <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" aria-hidden />
                </CommandItem>
              </CommandGroup>
            ) : null}

            {finderOn && searching && !loading && trimmed.length >= 3 ? (
              <CommandGroup heading="Not sure which instrument?">
                <CommandItem
                  value="instrument-finder"
                  onSelect={() => go(`/find-instrument?q=${encodeURIComponent(trimmed)}`)}
                >
                  <Sparkles className="mr-3 h-4 w-4 text-muted-foreground" aria-hidden />
                  <span className="truncate">
                    Ask the Instrument finder about <span className="font-medium">“{trimmed}”</span>
                  </span>
                  <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                </CommandItem>
              </CommandGroup>
            ) : null}

            {searching && result.people.length > 0 ? (
              <CommandGroup heading="People">
                {result.people.map((p) => (
                  <CommandItem
                    key={`p-${p.id}`}
                    value={`person-${p.id}`}
                    onSelect={() => openPerson(p.id)}
                    className="group items-start"
                  >
                    <PersonAvatar name={p.name} photoUrl={p.photo_url} />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        <span className="truncate">{p.name}</span>
                        <IdCard className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-data-[selected=true]:text-current" aria-label="Opens ID card" />
                      </p>
                      <p className={SECONDARY}>{[p.user_type, p.department, p.email].filter(Boolean).join(" · ")}</p>
                      {p.relation ? <p className={SECONDARY}>{p.relation}</p> : null}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
          </CommandList>
          <CommandSeparator />
          <div className="hidden items-center gap-4 bg-muted/40 px-4 py-2 text-[11px] text-muted-foreground sm:flex">
            <span>
              <kbd className="rounded border bg-background px-1">↑</kbd>{" "}
              <kbd className="rounded border bg-background px-1">↓</kbd> to move
            </span>
            <span>
              <kbd className="rounded border bg-background px-1">Enter</kbd> to open
            </span>
            <span className="ml-auto">
              Open anywhere with <kbd className="rounded border bg-background px-1">{SEARCH_SHORTCUT_LABEL}</kbd> or{" "}
              <kbd className="rounded border bg-background px-1">/</kbd>
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
