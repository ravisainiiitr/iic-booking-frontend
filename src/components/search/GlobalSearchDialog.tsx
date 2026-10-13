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
  Loader2,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { Command as CommandPrimitive } from "cmdk";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useUserCard } from "@/components/users/UserIdCardLink";
import { apiClient, type GlobalSearchResult } from "@/lib/api";
import { cn } from "@/lib/utils";
import { SEARCH_SHORTCUT_LABEL } from "./GlobalSearch";
import {
  bookingHref,
  clearRecentSearches,
  loadRecentSearches,
  matchPages,
  pagesFor,
  rememberSearch,
} from "./searchCatalog";

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

function shortDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return format(new Date(iso), "d MMM yyyy, HH:mm");
  } catch {
    return "";
  }
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
  const [query, setQuery] = useState(initialQuery);
  const [result, setResult] = useState<GlobalSearchResult>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [recent, setRecent] = useState<string[]>(() => loadRecentSearches());
  const abortRef = useRef<AbortController | null>(null);

  const pages = useMemo(() => pagesFor(user?.user_type, isAuthenticated), [user?.user_type, isAuthenticated]);
  const trimmed = query.trim();
  const pageHits = useMemo(() => matchPages(pages, trimmed), [pages, trimmed]);
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

  const hasHits =
    pageHits.length + result.equipment.length + result.bookings.length + result.people.length > 0;
  const searching = trimmed.length >= 2;
  const isStaffUser =
    isAuthenticated && (staffView || ["admin", "dept_admin", "manager", "operator"].includes(String(user?.user_type ?? "").toLowerCase()));
  const placeholder = isAuthenticated
    ? isStaffUser
      ? "Search booking ID, equipment, user name or email…"
      : "Search your bookings, equipment or pages…"
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
                </CommandGroup>
                <p className="px-4 pb-4 pt-1 text-xs text-muted-foreground">
                  {!isAuthenticated
                    ? "Tip: type an instrument name, code or what you want to measure, e.g. XRD, crystal structure or thermal stability. Sign in to search your bookings."
                    : isStaffUser
                      ? "Tip: type a booking ID (e.g. IICXRD2026…), an equipment name, code or technique, or a user's name, email or phone."
                      : "Tip: type a booking ID (e.g. IICXRD2026…), an equipment name or code, or a technique such as surface morphology."}
                </p>
              </>
            ) : null}

            {searching && !loading && !hasHits ? (
              <CommandEmpty className="px-6 py-10 text-center text-sm text-muted-foreground">
                {failed ? (
                  "Search is unavailable right now. Please try again in a moment."
                ) : (
                  <>
                    No matches for <span className="font-medium text-foreground">“{trimmed}”</span>.
                    <br />
                    Try another word for the technique, or search by booking ID or equipment code.
                  </>
                )}
              </CommandEmpty>
            ) : null}

            {searching && pageHits.length > 0 ? (
              <CommandGroup heading="Pages">
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
                        {b.user_name ? ` · ${b.user_name}` : ""}
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
                        ) : null}
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
                    </div>
                    {isAuthenticated && String(user?.user_type ?? "").toLowerCase() !== "finance" ? (
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

            {searching && result.people.length > 0 ? (
              <CommandGroup heading="People">
                {result.people.map((p) => (
                  <CommandItem key={`p-${p.id}`} value={`person-${p.id}`} onSelect={() => openPerson(p.id)} className="group">
                    <IdCard className="mr-3 h-4 w-4 shrink-0 text-muted-foreground group-data-[selected=true]:text-current" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <p className={SECONDARY}>
                        {[p.user_type, p.department, p.email].filter(Boolean).join(" · ")}
                      </p>
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
