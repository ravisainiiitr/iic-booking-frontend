/** Pages offered by the header search, filtered by who is signed in. */

export type PageAudience = "public" | "signed_in" | "booker" | "staff" | "admin";

export interface SearchPage {
  path: string;
  title: string;
  keywords: string;
  audience: PageAudience;
}

export const SEARCH_PAGES: SearchPage[] = [
  { path: "/equipments", title: "Browse and book equipment", keywords: "catalog instruments book new booking", audience: "public" },
  { path: "/availability", title: "Equipment availability", keywords: "free slots calendar open", audience: "public" },
  { path: "/analysis-charges", title: "Analysis charges", keywords: "rates price tariff cost fees", audience: "public" },
  { path: "/publications", title: "Publications", keywords: "papers research acknowledgement", audience: "public" },
  { path: "/dashboard", title: "Dashboard", keywords: "home overview", audience: "signed_in" },
  { path: "/my-bookings", title: "My bookings", keywords: "bookings status reschedule cancel", audience: "booker" },
  { path: "/my-results", title: "My results", keywords: "results download data files reports", audience: "booker" },
  { path: "/shared-data", title: "Shared with me", keywords: "shared results data", audience: "booker" },
  { path: "/booking-templates", title: "Booking templates", keywords: "saved inputs reuse", audience: "booker" },
  { path: "/my-urgent-requests", title: "My urgent requests", keywords: "urgent priority", audience: "booker" },
  { path: "/wallet", title: "Wallet", keywords: "balance recharge credit transactions money", audience: "booker" },
  { path: "/my-trainings", title: "My trainings", keywords: "training certification course", audience: "booker" },
  { path: "/my-authorisations", title: "My authorisations", keywords: "authorisation authorization training required certificate", audience: "booker" },
  { path: "/notifications", title: "Notifications", keywords: "alerts inbox messages", audience: "signed_in" },
  { path: "/notifications?tab=settings", title: "Notification settings", keywords: "email alerts preferences mute unsubscribe", audience: "signed_in" },
  { path: "/profile", title: "Profile", keywords: "account details phone supervisor", audience: "signed_in" },
  { path: "/tickets", title: "Support tickets", keywords: "help support issue problem", audience: "signed_in" },
  { path: "/booking-management", title: "Booking management", keywords: "manage bookings complete approve", audience: "staff" },
  { path: "/booking-calendar", title: "Booking calendar", keywords: "schedule week day", audience: "staff" },
  { path: "/urgent-requests", title: "Urgent requests", keywords: "urgent allocate priority", audience: "staff" },
  { path: "/ups-health", title: "UPS health", keywords: "ups power battery backup mains vertiv", audience: "staff" },
  { path: "/repeat-sample-requests", title: "Repeat sample requests", keywords: "repeat sample", audience: "staff" },
  { path: "/equipment-waitlist", title: "Equipment waitlist", keywords: "waitlist queue", audience: "staff" },
  { path: "/change-slot-status", title: "Change slot status", keywords: "block slots maintenance", audience: "staff" },
  { path: "/disruptions", title: "Disruptions", keywords: "breakdown maintenance outage", audience: "staff" },
  { path: "/training/authorisations", title: "Training authorisations", keywords: "authorised users training requests grandfather gate", audience: "staff" },
  { path: "/reports", title: "Reports", keywords: "statistics revenue usage export", audience: "staff" },
  { path: "/admin/insights/users", title: "Users overview", keywords: "people accounts users", audience: "admin" },
  { path: "/admin/insights/equipment", title: "Equipment overview", keywords: "utilisation usage", audience: "admin" },
  { path: "/admin-settings", title: "Admin settings", keywords: "configuration settings", audience: "admin" },
];

const STAFF_TYPES = new Set(["admin", "dept_admin", "manager", "operator"]);

/** Turns ``change_slot_status`` into words search can match. */
const idWords = (id: string) => id.replace(/[_-]+/g, " ");

/**
 * Everything search may offer this user to open: the fixed pages for their role, every item of their own dashboard
 * menu and the Admin Settings tiles they may open. One entry per path, fixed pages first.
 */
export function searchablePages(
  base: SearchPage[],
  menu: Array<{ id: string; label: string; path: string }>,
  settings: Array<{ title: string; description: string; path: string }>,
): SearchPage[] {
  const out: SearchPage[] = [];
  const add = (page: SearchPage) => {
    if (!out.some((p) => p.path === page.path)) out.push(page);
  };
  base.forEach(add);
  menu.forEach((m) => add({ path: m.path, title: m.label, keywords: `${idWords(m.id)} menu`, audience: "signed_in" }));
  settings.forEach((t) =>
    add({ path: t.path, title: `Admin settings: ${t.title}`, keywords: `${t.description} settings configuration`, audience: "signed_in" }),
  );
  return out;
}

export function pagesFor(userType: string | number | null | undefined, signedIn: boolean): SearchPage[] {
  const type = String(userType ?? "").toLowerCase();
  const staff = STAFF_TYPES.has(type);
  return SEARCH_PAGES.filter((p) => {
    switch (p.audience) {
      case "public":
        return true;
      case "signed_in":
        return signedIn;
      case "booker":
        return signedIn && type !== "finance";
      case "staff":
        return signedIn && staff;
      case "admin":
        return signedIn && (type === "admin" || type === "dept_admin");
      default:
        return false;
    }
  });
}

/** Edit distance (insert, delete, substitute, swap neighbours), or ``limit + 1`` when larger. */
export function editDistance(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let prev2: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
      rowMin = Math.min(rowMin, v);
    }
    if (rowMin > limit) return limit + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[b.length];
}

const allowedTypos = (word: string) => (word.length < 4 ? 0 : word.length < 8 ? 1 : 2);

/**
 * Pages whose title or keywords contain every word of the query. A word found on no page at all may be
 * misspelt by one letter (two for long words), so "notifcations" still finds Notifications.
 */
export function matchPages(pages: SearchPage[], query: string, limit = 5): SearchPage[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const hays = pages.map((p) => `${p.title} ${p.keywords}`.toLowerCase());
  const known = (w: string) => hays.some((h) => h.includes(w));
  const scored: Array<{ page: SearchPage; typos: number; index: number }> = [];
  pages.forEach((page, index) => {
    const hay = hays[index];
    const hayWords = hay.split(/[^a-z0-9]+/).filter(Boolean);
    let typos = 0;
    for (const w of words) {
      if (hay.includes(w)) continue;
      const max = known(w) ? 0 : allowedTypos(w);
      if (!max) return;
      const best = Math.min(...hayWords.map((h) => editDistance(w, h, max)));
      if (best > max) return;
      typos += best;
    }
    scored.push({ page, typos, index });
  });
  return scored
    .sort((a, b) => a.typos - b.typos || a.index - b.index)
    .slice(0, limit)
    .map((s) => s.page);
}

const RECENT_KEY = "global_search_recent";
const RECENT_MAX = 6;

export function loadRecentSearches(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string").slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

export function rememberSearch(query: string): string[] {
  const q = query.trim();
  if (q.length < 2) return loadRecentSearches();
  const next = [q, ...loadRecentSearches().filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, RECENT_MAX);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* storage full or blocked */
  }
  return next;
}

export function clearRecentSearches() {
  try {
    localStorage.removeItem(RECENT_KEY);
  } catch {
    /* ignore */
  }
}

/** Where a booking hit opens: staff manage it; bookers see it among their own bookings. */
export function bookingHref(b: { id: number; virtual_booking_id: string; own: boolean }, staffView: boolean): string {
  if (staffView && !b.own) return `/booking-management?expand=${b.id}`;
  return `/my-bookings?booking=${encodeURIComponent(b.virtual_booking_id)}`;
}
