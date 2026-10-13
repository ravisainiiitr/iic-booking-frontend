import { Suspense, useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Search } from "lucide-react";
import { lazyPage } from "@/lib/lazyPage";
import { cn } from "@/lib/utils";

const OPEN_EVENT = "global-search:open";

const loadDialog = () => import("./GlobalSearchDialog");
const GlobalSearchDialog = lazyPage(loadDialog);

/** Opens the site search from anywhere (header buttons, landing-page hero). */
export function openGlobalSearch(query = "") {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { query } }));
}

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);
export const SEARCH_SHORTCUT_LABEL = isMac ? "⌘K" : "Ctrl K";

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

/** Shortcut listener and lazily loaded search palette; mount once near the app root. */
export function GlobalSearchHost() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [openToken, setOpenToken] = useState(0);
  const [initialQuery, setInitialQuery] = useState("");

  const show = useCallback((initial = "") => {
    setInitialQuery(initial);
    setOpenToken((n) => n + 1);
    setMounted(true);
    setOpen(true);
  }, []);

  useEffect(() => {
    const onOpen = (e: Event) => show((e as CustomEvent<{ query?: string }>).detail?.query ?? "");
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        show();
      } else if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey && !isTypingTarget(e.target)) {
        e.preventDefault();
        show();
      }
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(OPEN_EVENT, onOpen);
      window.removeEventListener("keydown", onKey);
    };
  }, [show]);

  // Fetch the palette once the page is idle so the first Ctrl K opens instantly.
  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number; cancelIdleCallback?: (id: number) => void };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(() => void loadDialog().catch(() => undefined));
      return () => w.cancelIdleCallback?.(id);
    }
    const timer = window.setTimeout(() => void loadDialog().catch(() => undefined), 4000);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => setOpen(false), [location.pathname, location.search]);

  if (!mounted) return null;
  return (
    <Suspense fallback={null}>
      <GlobalSearchDialog open={open} onOpenChange={setOpen} openToken={openToken} initialQuery={initialQuery} />
    </Suspense>
  );
}

const BUTTON_WIDTH = {
  md: { box: "md:w-56 lg:w-64", label: "hidden md:inline" },
  xl: { box: "xl:w-56", label: "hidden xl:inline" },
};

/** Header button that opens the search; an icon until the ``wideFrom`` breakpoint. */
export function GlobalSearchButton({ className, wideFrom = "md" }: { className?: string; wideFrom?: "md" | "xl" }) {
  const width = BUTTON_WIDTH[wideFrom];
  return (
    <button
      type="button"
      onClick={() => openGlobalSearch()}
      aria-label="Search"
      aria-keyshortcuts="Control+K /"
      title={`Search (${SEARCH_SHORTCUT_LABEL})`}
      className={cn(
        "inline-flex h-10 items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-2.5 text-sm text-foreground/80 shadow-sm transition-colors hover:border-primary/60 hover:bg-primary/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        width.box,
        className,
      )}
    >
      <Search className="h-4 w-4 shrink-0 text-primary dark:text-sky-300" aria-hidden />
      <span className={cn("flex-1 text-left", width.label)}>Search…</span>
      <kbd className={cn("rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium", width.label)}>
        {SEARCH_SHORTCUT_LABEL}
      </kbd>
    </button>
  );
}

/** Search field at the top of the dashboard, visible at every screen width. */
export function DashboardSearchBar({ className, placeholder }: { className?: string; placeholder?: string }) {
  return (
    <button
      type="button"
      onClick={() => openGlobalSearch()}
      aria-label="Search bookings, equipment and pages"
      aria-keyshortcuts="Control+K /"
      className={cn(
        "group flex h-12 w-full min-w-0 items-center gap-3 rounded-xl border-2 border-primary/30 bg-card px-4 text-left text-sm text-muted-foreground shadow-sm transition-all hover:border-primary/60 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-base",
        className,
      )}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary dark:text-sky-300">
        <Search className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1 truncate">{placeholder ?? "Search booking ID, equipment or a page…"}</span>
      <kbd className="hidden shrink-0 rounded-md border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground sm:inline">
        {SEARCH_SHORTCUT_LABEL}
      </kbd>
    </button>
  );
}

/** Large search field for the landing page. */
export function HeroSearchBar({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => openGlobalSearch()}
      aria-label="Search equipment, bookings and pages"
      className={cn(
        "group flex w-full items-center gap-3 rounded-2xl border border-white/30 bg-white/95 px-5 py-4 text-left text-base text-slate-500 shadow-xl shadow-slate-900/20 backdrop-blur transition-all hover:-translate-y-0.5 hover:shadow-2xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/50 dark:bg-slate-900/90 dark:text-slate-300",
        className,
      )}
    >
      <Search className="h-5 w-5 shrink-0 text-primary dark:text-sky-300" aria-hidden />
      <span className="flex-1 truncate">Search equipment, booking ID or a page…</span>
      <kbd className="hidden rounded-md border bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 sm:inline dark:bg-slate-800 dark:text-slate-300">
        {SEARCH_SHORTCUT_LABEL}
      </kbd>
    </button>
  );
}
