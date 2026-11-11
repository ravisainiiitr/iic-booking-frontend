import type { ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  AlertTriangle,
  BadgeCheck,
  Bell,
  Bookmark,
  BookOpen,
  CheckCircle2,
  Compass,
  Eye,
  Home,
  Lock,
  MessageSquare,
  MessagesSquare,
  Pin,
  ShieldCheck,
  Sparkles,
  ThumbsUp,
  Users,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageShell } from "@/components/PageShell";
import { THREAD_TYPE_LABEL, type CommunitySummary, type ThreadCard as ThreadCardData, type ThreadType } from "@/lib/connectApi";
import { timeAgo, useNoIndex } from "./useConnect";
import "./connect.css";

export const CONNECT_TAGLINE = "Connect. Discuss. Share Knowledge. Solve Together.";

export const connectPaths = {
  home: "/connect",
  communities: "/connect/communities",
  community: (slug: string) => `/connect/c/${encodeURIComponent(slug)}`,
  thread: (id: number) => `/connect/t/${id}`,
  newThread: (params: { community?: string; equipment?: number; category?: string } = {}) => {
    const sp = new URLSearchParams();
    if (params.community) sp.set("community", params.community);
    if (params.equipment) sp.set("equipment", String(params.equipment));
    if (params.category) sp.set("category", params.category);
    const s = sp.toString();
    return `/connect/new${s ? `?${s}` : ""}`;
  },
  search: (q = "") => `/connect/search${q ? `?q=${encodeURIComponent(q)}` : ""}`,
  bookmarks: "/connect/search?bookmarked=1",
  mine: "/connect/search?mine=1",
};

const TYPE_TONE: Record<ThreadType, string> = {
  question: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-200",
  technical_issue: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
  solution: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200",
  general: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200",
  suggestion: "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950/50 dark:text-violet-200",
  feature_request: "border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-200",
  announcement: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200",
  research: "border-teal-200 bg-teal-50 text-teal-800 dark:border-teal-900 dark:bg-teal-950/50 dark:text-teal-200",
  poll: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800 dark:border-fuchsia-900 dark:bg-fuchsia-950/50 dark:text-fuchsia-200",
};

function Chip({ className, children, title }: { className?: string; children: ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4 whitespace-nowrap",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function TypeBadge({ type }: { type: ThreadType }) {
  return <Chip className={TYPE_TONE[type]}>{THREAD_TYPE_LABEL[type] ?? type}</Chip>;
}

/** Verified role badge. The label comes from the server's assignment records; users never choose it. */
export function RoleBadge({ badge }: { badge: string }) {
  if (!badge) return null;
  return (
    <Chip
      title="Verified from portal assignments"
      className="border-primary/25 bg-primary/5 text-primary dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-200"
    >
      <BadgeCheck className="h-3 w-3" aria-hidden />
      {badge}
    </Chip>
  );
}

/** The person who asked confirmed the answer resolved their question: the strongest signal, shown prominently. */
export function ResolvedBadge() {
  return (
    <Chip
      title="The person who asked confirmed this answer resolved it"
      className="border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-600"
    >
      <BadgeCheck className="h-3 w-3" aria-hidden /> Resolved
    </Chip>
  );
}

export function SolvedBadge() {
  return (
    <Chip className="border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">
      <CheckCircle2 className="h-3 w-3" aria-hidden /> Solved
    </Chip>
  );
}

export function StatusChips({ thread }: { thread: ThreadCardData }) {
  return (
    <>
      {thread.is_pinned ? (
        <Chip className="border-slate-300 text-slate-700 dark:border-slate-600 dark:text-slate-200">
          <Pin className="h-3 w-3" aria-hidden /> Pinned
        </Chip>
      ) : null}
      {thread.is_resolved ? <ResolvedBadge /> : thread.is_solved ? <SolvedBadge /> : null}
      {thread.status === "locked" ? (
        <Chip className="border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-300">
          <Lock className="h-3 w-3" aria-hidden /> Locked
        </Chip>
      ) : null}
      {thread.is_known_problem ? (
        <Chip className="border-amber-300 text-amber-800 dark:border-amber-800 dark:text-amber-200">
          <AlertTriangle className="h-3 w-3" aria-hidden /> Known problem
        </Chip>
      ) : null}
      {thread.has_workaround ? (
        <Chip className="border-teal-300 text-teal-800 dark:border-teal-800 dark:text-teal-200">
          <Wrench className="h-3 w-3" aria-hidden /> Workaround
        </Chip>
      ) : null}
      {thread.is_outdated ? <Chip className="border-slate-300 text-slate-500">Outdated</Chip> : null}
    </>
  );
}

function Stat({ icon, value, label }: { icon: ReactNode; value: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-1" title={label}>
      {icon}
      <span className="tabular-nums">{value}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** One discussion in a feed: title, excerpt, author and role, community, equipment, tags, dates and counts. */
export function ThreadCard({ thread, showCommunity = true }: { thread: ThreadCardData; showCommunity?: boolean }) {
  return (
    <article
      className={cn(
        "group relative rounded-xl border bg-card p-4 shadow-sm transition-colors hover:border-primary/40 focus-within:ring-2 focus-within:ring-ring",
        thread.is_pinned && "border-primary/30 bg-primary/[0.03]",
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <TypeBadge type={thread.type} />
        <StatusChips thread={thread} />
        {thread.unread ? <span className="h-2 w-2 rounded-full bg-primary" title="New activity" aria-label="New activity" /> : null}
      </div>
      <h3 className="mt-2 text-base font-semibold leading-snug text-foreground">
        <Link to={connectPaths.thread(thread.id)} className="after:absolute after:inset-0 focus:outline-none">
          {thread.title}
        </Link>
      </h3>
      {thread.excerpt ? <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{thread.excerpt}</p> : null}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Link
            to={`/connect/search?author=${thread.author.id}`}
            className="relative z-10 font-medium text-foreground hover:underline"
            title={`Discussions started by ${thread.author.name}`}
          >
            {thread.author.name}
          </Link>
          <RoleBadge badge={thread.author.badge} />
        </span>
        {showCommunity ? (
          <Link to={connectPaths.community(thread.community.slug)} className="relative z-10 hover:text-foreground hover:underline">
            {thread.community.name}
          </Link>
        ) : null}
        {thread.category ? <span>{thread.category.name}</span> : null}
        {thread.equipment?.name ? (
          <Link
            to={`/connect/search?equipment=${thread.equipment.id}`}
            className="relative z-10 hover:text-foreground hover:underline"
            title={`Discussions about ${thread.equipment.name}`}
          >
            {thread.equipment.name}
          </Link>
        ) : null}
        <span title={new Date(thread.created_at).toLocaleString()}>Started {timeAgo(thread.created_at)}</span>
        <span>Active {timeAgo(thread.last_activity_at)}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {thread.tags.map((t) => (
            <Link
              key={t.slug}
              to={`/connect/search?tag=${encodeURIComponent(t.slug)}`}
              className="relative z-10 rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
            >
              #{t.name}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <Stat icon={<MessageSquare className="h-3.5 w-3.5" aria-hidden />} value={thread.reply_count} label="replies" />
          <Stat icon={<Eye className="h-3.5 w-3.5" aria-hidden />} value={thread.view_count} label="views" />
          <Stat icon={<ThumbsUp className="h-3.5 w-3.5" aria-hidden />} value={thread.helpful_count} label="marked helpful" />
          {thread.bookmarked ? <Bookmark className="h-3.5 w-3.5 fill-current text-primary" aria-label="Bookmarked" /> : null}
        </div>
      </div>
    </article>
  );
}

export function ThreadListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading discussions">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-28 animate-pulse rounded-xl border bg-muted/40" />
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed p-8 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground" aria-hidden>
        {icon ?? <MessagesSquare className="h-5 w-5" />}
      </div>
      <p className="mt-3 font-medium">{title}</p>
      {children ? <div className="mt-1 text-sm text-muted-foreground">{children}</div> : null}
    </div>
  );
}

export function InlineError({ message }: { message: string }) {
  return (
    <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
      {message}
    </div>
  );
}

const NAV = [
  { to: connectPaths.home, label: "Home", icon: Home, end: true },
  { to: connectPaths.communities, label: "My Communities", icon: Users },
  { to: "/connect/search?type=question,technical_issue", label: "Technical Support", icon: Wrench },
  { to: "/connect/search?status=solved&sort=solved", label: "Solved", icon: CheckCircle2 },
  { to: "/connect/notifications", label: "Notifications", icon: Bell },
  { to: "/connect/knowledge", label: "Knowledge Hub", icon: BookOpen },
  { to: "/connect/search?type=announcement", label: "Announcements", icon: Sparkles },
  { to: connectPaths.bookmarks, label: "Bookmarks", icon: Bookmark },
  { to: connectPaths.mine, label: "My Discussions", icon: MessageSquare },
];

/** Several sections share /connect/search and differ only by query string, so match on path and query. */
function useNavActive() {
  const location = useLocation();
  return (to: string, end?: boolean) => {
    const [path, search = ""] = to.split("?");
    if (search) return location.pathname === path && new URLSearchParams(location.search).toString() === new URLSearchParams(search).toString();
    if (path === "/connect/search") return location.pathname === path && !location.search;
    return end ? location.pathname === path : location.pathname.startsWith(path);
  };
}

function LeftNav({ communities }: { communities?: CommunitySummary[] }) {
  const isActive = useNavActive();
  const groups = (communities ?? []).filter((c) => c.kind === "group");
  const general = (communities ?? []).find((c) => c.kind === "general");
  return (
    <nav aria-label="IITR Connect" className="space-y-5 text-sm">
      <ul className="space-y-0.5">
        {NAV.map((item) => (
          <li key={item.to}>
            <Link
              to={item.to}
              aria-current={isActive(item.to, item.end) ? "page" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-md px-2.5 py-2 text-muted-foreground hover:bg-muted hover:text-foreground",
                isActive(item.to, item.end) && "bg-primary/10 font-medium text-primary dark:text-sky-200",
              )}
            >
              <item.icon className="h-4 w-4" aria-hidden />
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
      {general ? (
        <div>
          <p className="px-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">General</p>
          <NavLink
            to={connectPaths.community(general.slug)}
            className="mt-1 flex items-center gap-2 rounded-md px-2.5 py-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Compass className="h-4 w-4" aria-hidden />
            <span className="truncate">{general.name}</span>
          </NavLink>
        </div>
      ) : null}
      {groups.length ? (
        <div>
          <p className="px-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Equipment Groups</p>
          <ul className="mt-1 max-h-[40vh] space-y-0.5 overflow-y-auto">
            {groups.map((c) => (
              <li key={c.id}>
                <NavLink
                  to={connectPaths.community(c.slug)}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground",
                      isActive && "bg-primary/10 font-medium text-primary dark:text-sky-200",
                    )
                  }
                >
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{c.name}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
        <p className="flex items-center gap-1.5 font-medium text-foreground">
          <Lock className="h-3.5 w-3.5" aria-hidden /> Private to portal users
        </p>
        <p className="mt-1">Equipment group discussions are visible only to that group&apos;s members and staff.</p>
      </div>
    </nav>
  );
}

/** Small screens: the left navigation becomes one scrollable row of links above the content. */
function MobileNav() {
  const isActive = useNavActive();
  return (
    <nav aria-label="IITR Connect sections" className="-mx-4 mb-4 overflow-x-auto px-4 lg:hidden">
      <ul className="flex w-max gap-1.5">
        {NAV.map((item) => (
          <li key={item.to}>
            <Link
              to={item.to}
              aria-current={isActive(item.to, item.end) ? "page" : undefined}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border bg-card px-3 text-sm text-muted-foreground",
                isActive(item.to, item.end) && "border-primary/40 bg-primary/10 font-medium text-primary dark:text-sky-200",
              )}
            >
              <item.icon className="h-4 w-4" aria-hidden />
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * IITR Connect page frame: portal header, then three columns on desktop (left navigation, centre content, right
 * sidebar) and a single column on small screens.
 */
export function ConnectShell({
  children,
  aside,
  communities,
  header,
}: {
  children: ReactNode;
  aside?: ReactNode;
  communities?: CommunitySummary[];
  header?: ReactNode;
}) {
  useNoIndex();
  return (
    <PageShell>
      <main className="container mx-auto px-4 py-5">
        <MobileNav />
        {header}
        <div className="mt-5 grid gap-6 lg:grid-cols-[13.5rem_minmax(0,1fr)] xl:grid-cols-[13.5rem_minmax(0,1fr)_18rem]">
          <aside className="hidden lg:block">
            <div className="sticky top-20">
              <LeftNav communities={communities} />
            </div>
          </aside>
          <div className="min-w-0 space-y-6">{children}</div>
          {aside ? <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">{aside}</aside> : null}
        </div>
      </main>
    </PageShell>
  );
}

export function SideCard({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-4 shadow-sm">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </h2>
      <div className="mt-3 text-sm">{children}</div>
    </section>
  );
}

export function SectionTitle({ title, action, icon }: { title: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
        {icon}
        {title}
      </h2>
      {action}
    </div>
  );
}

/** Shown when Connect is off or not enabled for this user (the API answers 404 then as well). */
export function ConnectUnavailable() {
  useNoIndex();
  return (
    <PageShell>
      <main className="container mx-auto max-w-xl px-4 py-16">
        <EmptyState icon={<BookOpen className="h-5 w-5" />} title="IITR Connect is not available">
          It is not switched on for your account yet. Please check back later.
        </EmptyState>
      </main>
    </PageShell>
  );
}
