import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
  Activity,
  ArrowRight,
  BookOpen,
  ChevronDown,
  FlaskConical,
  HardDrive,
  Lock,
  MessageSquarePlus,
  Plus,
  RefreshCw,
  Search,
  Share2,
  UsersRound,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import type { MyResearchHome, ResearchWorkspaceCard } from "@/lib/myResearchTypes";
import type { GroupEvent, ResearchGroupCardData, ResearchGroupsHome } from "@/lib/researchGroupTypes";
import { PageHero, PageShell, heroButtonClass } from "@/components/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { BookingsAndResultsSection } from "@/components/my-research/BookingsAndResultsSection";
import { CreateWorkspaceDialog } from "@/components/my-research/CreateWorkspaceDialog";
import { WorkspaceCard } from "@/components/my-research/WorkspaceCard";
import { formatBytes, historyLabel, timeAgo } from "@/components/my-research/researchUtils";
import {
  ActivityFeed,
  CardGridSkeleton,
  EmptyState,
  FilterChips,
  InlineError,
  ListSkeleton,
  ResearchBreadcrumbs,
  SectionHeader,
  type FeedItem,
} from "@/components/my-research/researchUi";
import { CreateResearchGroupDialog } from "@/components/my-research/groups/CreateResearchGroupDialog";
import { MyActivitiesUpdates } from "@/components/my-research/groups/MyActivitiesUpdates";
import { ResearchGroupList } from "@/components/my-research/groups/ResearchGroupList";
import { ResearchNeedsAttention } from "@/components/my-research/groups/ResearchNeedsAttention";
import { SendUpdateButton } from "@/components/my-research/groups/SendUpdateButton";
import { eventSentence, groupPath } from "@/components/my-research/groups/groupLabels";

const WORKSPACES_VISIBLE = 3;
const FEED_LIMIT = 6;
const SMALL_BUTTON = "h-10 sm:h-8";

type PublicationRow = { id: number; title: string; journal: string; year: number | null; status: string };
type GroupsState = { status: "loading" } | { status: "disabled" } | { status: "error" } | { status: "ready"; data: ResearchGroupsHome };
type Filter = "all" | "my_groups" | "member_groups" | "my_workspaces" | "shared" | "archived";

function matches(query: string, ...fields: Array<string | null | undefined>) {
  if (!query) return true;
  return fields.some((f) => (f ?? "").toLowerCase().includes(query));
}

function groupEventTarget(e: GroupEvent): { tab: string; label: string } {
  if (e.action === "UPDATE_SUBMITTED") return { tab: "updates", label: "Review" };
  if (e.action.startsWith("UPDATE_")) return { tab: "updates", label: "Open" };
  if (e.action.startsWith("ACTIVITY_") || e.action === "PROGRESS_UPDATED") return { tab: "activities", label: "Open" };
  if (e.action.startsWith("MEMBER_")) return { tab: "members", label: "Open" };
  if (e.action.startsWith("WORKSPACE_") || e.action.startsWith("PUBLICATION_")) return { tab: "workspaces", label: "Open" };
  return { tab: "", label: "Open" };
}

export default function MyResearch() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [home, setHome] = useState<MyResearchHome | null>(null);
  const [homeError, setHomeError] = useState<string | null>(null);
  const [groupsState, setGroupsState] = useState<GroupsState>({ status: "loading" });
  const [blocked, setBlocked] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [groupCreateOpen, setGroupCreateOpen] = useState(false);
  const [showAllWorkspaces, setShowAllWorkspaces] = useState(false);
  const [sharedData, setSharedData] = useState<{ total: number; fresh: number; eligible: boolean } | null>(null);
  const [publications, setPublications] = useState<PublicationRow[] | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const loadSummaries = useCallback(async () => {
    const [shared, pubs] = await Promise.all([apiClient.getSharedWithMe(), apiClient.listMyPublicationClaims()]);
    if (shared.data) {
      const rows = shared.data.results ?? [];
      setSharedData({
        total: shared.data.count ?? rows.length,
        fresh: rows.filter((r) => r.is_new).length,
        eligible: shared.data.eligible !== false,
      });
    }
    setPublications(pubs.data ? pubs.data.results ?? [] : []);
  }, []);

  const loadGroups = useCallback(async () => {
    setGroupsState((prev) => (prev.status === "ready" ? prev : { status: "loading" }));
    const res = await apiClient.researchGroupsHome();
    if (res.data && !res.error) setGroupsState({ status: "ready", data: res.data });
    else if (res.status === 404 || res.status === 403 || res.errorCode === "my_research_groups_disabled") setGroupsState({ status: "disabled" });
    else setGroupsState({ status: "error" });
  }, []);

  const loadHome = useCallback(async () => {
    setLoading(true);
    const res = await apiClient.myResearchHome();
    setLoading(false);
    if (res.error || !res.data) {
      if (res.status === 403 || res.status === 404) {
        setBlocked(
          res.status === 404
            ? "My Research is not available yet."
            : res.error || "My Research is available only to IIT Roorkee students and faculty.",
        );
      } else setHomeError("Unable to load your projects.");
      return;
    }
    setBlocked(null);
    setHomeError(null);
    setHome(res.data);
  }, []);

  const load = useCallback(() => {
    void loadSummaries();
    void loadGroups();
    void loadHome();
  }, [loadSummaries, loadGroups, loadHome]);

  useEffect(() => {
    if (authLoading) return;
    if (!apiClient.getToken() || !user) {
      navigate("/auth");
      return;
    }
    load();
  }, [authLoading, user, navigate, load]);

  const groups = groupsState.status === "ready" ? groupsState.data : null;
  const isFaculty = groups ? groups.is_faculty : String(user?.user_type ?? "").toLowerCase() === "faculty";
  const q = query.trim().toLowerCase();

  const managedGroups = useMemo(() => groups?.managed_groups ?? [], [groups]);
  const memberGroups = useMemo(() => groups?.member_groups ?? [], [groups]);
  const allGroups = useMemo(() => {
    const seen = new Set<string>();
    return [...managedGroups, ...memberGroups].filter((g) => (seen.has(g.id) ? false : (seen.add(g.id), true)));
  }, [managedGroups, memberGroups]);
  const myWorkspaces = useMemo(() => home?.my_workspaces ?? [], [home]);
  const sharedWorkspaces = useMemo(() => home?.shared_with_me ?? [], [home]);

  const archivedMode = filter === "archived";
  const groupMatches = (g: ResearchGroupCardData) =>
    (archivedMode ? g.status === "ARCHIVED" : g.status === "ACTIVE") && matches(q, g.name, g.short_code, g.description, g.owner.name);
  const workspaceMatches = (w: ResearchWorkspaceCard) =>
    (archivedMode ? w.status === "ARCHIVED" : w.status === "ACTIVE") &&
    matches(q, w.name, w.description, w.owner.name, w.owner.department);

  const groupSource = filter === "my_groups" ? (isFaculty ? managedGroups : memberGroups) : filter === "member_groups" ? memberGroups : allGroups;
  const visibleGroups = groupSource.filter(groupMatches);
  const visibleMine = myWorkspaces.filter(workspaceMatches);
  const visibleShared = sharedWorkspaces.filter(workspaceMatches);
  const shownMine = showAllWorkspaces ? visibleMine : visibleMine.slice(0, WORKSPACES_VISIBLE);

  const archivedCount =
    allGroups.filter((g) => g.status === "ARCHIVED").length +
    myWorkspaces.filter((w) => w.status === "ARCHIVED").length +
    sharedWorkspaces.filter((w) => w.status === "ARCHIVED").length;
  const totalItems = allGroups.length + myWorkspaces.length + sharedWorkspaces.length;

  const showGroups = groupsState.status !== "disabled" && ["all", "my_groups", "member_groups", "archived"].includes(filter);
  const showWorkspaces = ["all", "my_workspaces", "archived"].includes(filter);
  const showShared = ["all", "shared", "archived"].includes(filter);
  const showSummaries = filter === "all" && !q;
  const filtering = Boolean(q) || filter !== "all";

  const filterOptions = useMemo(() => {
    const active = (list: Array<{ status: string }>) => list.filter((x) => x.status === "ACTIVE").length;
    const opts: { value: Filter; label: string; count?: number }[] = [{ value: "all", label: "All" }];
    if (groupsState.status === "ready") {
      if (isFaculty) {
        opts.push({ value: "my_groups", label: "My groups", count: active(managedGroups) });
        if (memberGroups.length) opts.push({ value: "member_groups", label: "Groups I'm a member of", count: active(memberGroups) });
      } else {
        opts.push({ value: "my_groups", label: "My groups", count: active(memberGroups) });
      }
    }
    opts.push({ value: "my_workspaces", label: "My projects", count: active(myWorkspaces) });
    opts.push({ value: "shared", label: "Projects shared with me", count: active(sharedWorkspaces) });
    if (archivedCount) opts.push({ value: "archived", label: "Archived", count: archivedCount });
    return opts;
  }, [groupsState.status, isFaculty, managedGroups, memberGroups, myWorkspaces, sharedWorkspaces, archivedCount]);

  const feed = useMemo<FeedItem[]>(() => {
    const rows: FeedItem[] = [];
    const stamp = (at: string) => {
      const d = new Date(at);
      return { dateLabel: Number.isNaN(d.getTime()) ? "—" : format(d, "dd MMM"), timeLabel: timeAgo(at) };
    };
    for (const a of home?.recent_activity ?? []) {
      rows.push({
        key: `w-${a.id}`,
        at: a.created_at,
        ...stamp(a.created_at),
        text: (
          <>
            <span className="font-medium">{a.actor?.name ?? "Someone"}</span>{" "}
            <span className="text-muted-foreground">
              {historyLabel(a).toLowerCase()}
              {a.target_label ? ` “${a.target_label}”` : ""}
            </span>
          </>
        ),
        where: a.workspace_name ?? "",
        actionLabel: "Open",
        onAction: a.workspace_id ? () => navigate(`/my-research/${a.workspace_id}`) : undefined,
      });
    }
    for (const e of groups?.recent_events ?? []) {
      const target = groupEventTarget(e);
      rows.push({
        key: `g-${e.id}`,
        at: e.created_at,
        ...stamp(e.created_at),
        text: (
          <>
            <span className="font-medium">{e.actor?.name ?? "System"}</span> <span className="text-muted-foreground">{eventSentence(e)}</span>
          </>
        ),
        where: e.group_name ?? "",
        actionLabel: target.label,
        onAction: e.group_id ? () => navigate(groupPath(e.group_id!, target.tab || undefined)) : undefined,
      });
    }
    return rows.sort((a, b) => b.at.localeCompare(a.at)).slice(0, FEED_LIMIT);
  }, [home, groups, navigate]);

  if (!user) return null;

  const attention = groups?.needs_attention;
  const canCreateGroup = Boolean(isFaculty && groups?.can_create);
  const canCreateWorkspace = Boolean(home?.can_create);
  const hasProjects = myWorkspaces.length + sharedWorkspaces.length > 0;
  /** Brand-new student: one "Get started" card instead of a stack of empty sections. */
  const isNewStudent = !isFaculty && Boolean(home) && !hasProjects && !filtering;
  const askGroups = managedGroups.filter((g) => g.status === "ACTIVE");
  const sendGroups = memberGroups.filter((g) => g.status === "ACTIVE" && g.my_role === "MEMBER");
  const activeProjects = myWorkspaces.filter((w) => w.status === "ACTIVE");
  const pubCounts = publications
    ? {
        total: publications.length,
        pending: publications.filter((p) => String(p.status).toLowerCase() === "pending").length,
        approved: publications.filter((p) => String(p.status).toLowerCase() === "approved").length,
      }
    : null;

  const primaryAction =
    isFaculty && canCreateGroup ? (
      <Button className={`order-1 gap-2 md:order-3 ${heroButtonClass.primary}`} onClick={() => setGroupCreateOpen(true)}>
        <UsersRound className="h-4 w-4" aria-hidden /> New group
      </Button>
    ) : canCreateWorkspace ? (
      <Button className={`order-1 gap-2 md:order-3 ${heroButtonClass.primary}`} onClick={() => setCreateOpen(true)}>
        <Plus className="h-4 w-4" aria-hidden /> New project
      </Button>
    ) : null;
  /** Faculty see "New project" next to My projects, since the header action is "New group". */
  const projectActionInSection = canCreateWorkspace && isFaculty && canCreateGroup;

  const header = (
    <PageHero
      compact
      title="My Research"
      description="Your projects, research groups, tasks and results."
      icon={<FlaskConical className="h-5 w-5" />}
      meta={
        home ? (
          <>
            <span className="inline-flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden /> Visible only to you and the people you share with
            </span>
            {home.storage.used_bytes > 0 ? (
              <span className="inline-flex items-center gap-1.5">
                <HardDrive className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {formatBytes(home.storage.used_bytes)} used
                {home.storage.quota_bytes ? ` of ${formatBytes(home.storage.quota_bytes)}` : ""}
              </span>
            ) : null}
          </>
        ) : null
      }
      actions={
        !blocked ? (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={load}
              disabled={loading}
              aria-label="Refresh My Research"
              title="Refresh"
              className={`order-3 h-10 w-10 md:order-1 md:h-9 md:w-9 ${heroButtonClass.icon}`}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
            </Button>
            {primaryAction}
          </>
        ) : null
      }
    />
  );

  const askAction =
    askGroups.length === 1 ? (
      <Button
        size="sm"
        variant="outline"
        className={`gap-1.5 ${SMALL_BUTTON}`}
        onClick={() => navigate(groupPath(askGroups[0].id, "updates", { ask: "1" }))}
      >
        <MessageSquarePlus className="h-4 w-4" aria-hidden /> Ask for an update
      </Button>
    ) : askGroups.length > 1 ? (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" className={`gap-1.5 ${SMALL_BUTTON}`}>
            <MessageSquarePlus className="h-4 w-4" aria-hidden /> Ask for an update <ChevronDown className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {askGroups.map((g) => (
            <DropdownMenuItem key={g.id} onClick={() => navigate(groupPath(g.id, "updates", { ask: "1" }))}>
              {g.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    ) : null;

  const reviewBox =
    isFaculty && attention && showSummaries ? (
      <ResearchNeedsAttention
        data={attention}
        showGroup
        limit={3}
        action={askAction}
        onOpenRequest={(r) => navigate(groupPath(r.group_id, "updates", { request: r.id }))}
        onOpenActivity={(a) => navigate(groupPath(a.group_id, "activities", { activity: a.id }))}
      />
    ) : null;

  const groupsSection = showGroups ? (
    groupsState.status === "loading" ? (
      <section className="space-y-3" aria-label="Research groups" aria-busy="true">
        <SectionHeader icon={UsersRound} title={isFaculty ? "Research groups" : "My research group"} />
        <CardGridSkeleton />
      </section>
    ) : groupsState.status === "error" ? (
      <section className="space-y-3" aria-label="Research groups">
        <SectionHeader icon={UsersRound} title={isFaculty ? "Research groups" : "My research group"} />
        <InlineError message="Unable to load research groups." onRetry={() => void loadGroups()} />
      </section>
    ) : groups ? (
      <ResearchGroupList
        title={isFaculty ? (filter === "member_groups" ? "Groups I'm a member of" : "Research groups") : "My research group"}
        description={
          isFaculty ? "Your students, their tasks and progress updates." : "Your supervisor's group. Tasks and update requests appear under To do."
        }
        groups={visibleGroups}
        emptyText={
          filtering
            ? archivedMode
              ? "No archived groups."
              : "No groups match."
            : isFaculty
              ? "No research groups yet. Create one to give your students tasks and ask for progress updates."
              : "You're not in a research group yet. Your supervisor can add you."
        }
        canCreate={canCreateGroup && !filtering}
        onCreate={() => setGroupCreateOpen(true)}
      />
    ) : null
  ) : null;

  const newProjectButton = (
    <Button size="sm" variant="outline" className={`gap-1.5 ${SMALL_BUTTON}`} onClick={() => setCreateOpen(true)}>
      <Plus className="h-4 w-4" aria-hidden /> New project
    </Button>
  );

  const workspacesSection =
    showWorkspaces && !isNewStudent ? (
      loading && !home ? (
        <section className="space-y-3" aria-label="My projects" aria-busy="true">
          <SectionHeader icon={FlaskConical} title="My projects" />
          <CardGridSkeleton />
        </section>
      ) : visibleMine.length === 0 ? (
        filtering ? (
          <p className="rounded-lg border bg-card px-4 py-2 text-sm text-muted-foreground">
            {archivedMode ? "No archived projects." : "No projects match."}
          </p>
        ) : canCreateWorkspace ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card px-4 py-2 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <FlaskConical className="h-4 w-4 shrink-0 text-primary dark:text-sky-300" aria-hidden />
              No projects of your own yet. A project keeps the files, bookings and results of one piece of research together.
            </span>
            {newProjectButton}
          </div>
        ) : null
      ) : (
        <section className="space-y-3" aria-labelledby="my-projects-heading">
          <SectionHeader
            id="my-projects-heading"
            icon={FlaskConical}
            title="My projects"
            description="Files, bookings and results for each piece of research."
            count={visibleMine.length || undefined}
            action={
              <>
                {visibleMine.length > WORKSPACES_VISIBLE ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`text-primary dark:text-sky-300 ${SMALL_BUTTON}`}
                    onClick={() => setShowAllWorkspaces((v) => !v)}
                  >
                    {showAllWorkspaces ? "Show fewer" : `View all (${visibleMine.length})`}
                  </Button>
                ) : null}
                {projectActionInSection && !filtering ? newProjectButton : null}
              </>
            }
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shownMine.map((ws) => (
              <WorkspaceCard key={ws.id} ws={ws} onOpen={() => navigate(`/my-research/${ws.id}`)} />
            ))}
          </div>
        </section>
      )
    ) : null;

  const resultsSummary =
    showSummaries && sharedData && sharedData.eligible && sharedData.total > 0 ? (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-2 text-sm">
        <span className="text-muted-foreground">Results shared with me</span>
        <span className="flex items-center gap-2">
          <span className="font-semibold tabular-nums">{sharedData.total}</span>
          {sharedData.fresh > 0 ? (
            <Badge variant="outline" className="border-sky-200 px-1.5 py-0 text-[11px] text-sky-800 dark:border-sky-900 dark:text-sky-300">
              {sharedData.fresh} new
            </Badge>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            className={`gap-1 px-2 text-primary dark:text-sky-300 ${SMALL_BUTTON}`}
            onClick={() => navigate("/shared-data")}
            aria-label="Open results shared with me"
          >
            Open <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </span>
      </div>
    ) : null;

  const sharedSection = showShared ? (
    isNewStudent ? (
      resultsSummary
    ) : (
      <section className="space-y-3" aria-labelledby="shared-with-me-heading">
        <SectionHeader
          id="shared-with-me-heading"
          icon={Share2}
          title="Projects shared with me"
          description={visibleShared.length ? "Projects other IIT Roorkee students and faculty have shared with you." : undefined}
          count={visibleShared.length || undefined}
        />
        {resultsSummary}
        {loading && !home ? (
          <CardGridSkeleton count={2} />
        ) : visibleShared.length === 0 ? (
          <p className="rounded-lg border bg-card px-4 py-2 text-sm text-muted-foreground">
            {filtering
              ? archivedMode
                ? "No archived shared projects."
                : "No shared projects match."
              : isFaculty
                ? "When a student shares a project with you, it appears here."
                : "No projects have been shared with you yet."}
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleShared.map((ws) => (
              <WorkspaceCard key={ws.id} ws={ws} onOpen={() => navigate(`/my-research/${ws.id}`)} />
            ))}
          </div>
        )}
      </section>
    )
  ) : null;

  const getStarted = isNewStudent ? (
    canCreateWorkspace ? (
      <section className="rounded-lg border bg-card p-4" aria-labelledby="get-started-heading">
        <h2 id="get-started-heading" className="flex items-center gap-2 text-base font-semibold">
          <FlaskConical className="h-4 w-4 text-primary dark:text-sky-300" aria-hidden /> Get started
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">Keep the files, bookings and results of your research in one place.</p>
        <ol className="mt-3 grid gap-2 sm:grid-cols-3">
          {[
            { n: 1, title: "Create a project", text: "One project per piece of research, e.g. your thesis chapter." },
            { n: 2, title: "Add a booking", text: "Pick the project when you book, or add bookings you already have." },
            { n: 3, title: "Share with your supervisor", text: "They can view and download, but not change anything." },
          ].map((step) => (
            <li key={step.n} className="flex gap-3 rounded-md border bg-muted/30 p-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                {step.n}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{step.title}</span>
                <span className="block text-xs text-muted-foreground">{step.text}</span>
              </span>
            </li>
          ))}
        </ol>
        <Button className="mt-3 h-10 gap-1.5" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" aria-hidden /> Create your first project
        </Button>
      </section>
    ) : (
      <EmptyState
        icon={Share2}
        title="Projects shared with you appear here."
        description="When your supervisor or a colleague shares a research project with you, you can open its files and results from this page."
      />
    )
  ) : null;

  const publicationsSection =
    isNewStudent && !pubCounts?.total ? null : (
      <section className="space-y-3" aria-labelledby="my-publications-heading">
        <SectionHeader
          id="my-publications-heading"
          icon={BookOpen}
          title="My publications"
          action={
            <Button variant="ghost" size="sm" className={`text-primary dark:text-sky-300 ${SMALL_BUTTON}`} onClick={() => navigate("/my-publications")}>
              View all
            </Button>
          }
        />
        {pubCounts == null ? (
          <ListSkeleton rows={2} />
        ) : pubCounts.total === 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card px-4 py-2 text-sm text-muted-foreground">
            <span>No publications submitted yet.</span>
            <Button size="sm" variant="outline" className={SMALL_BUTTON} onClick={() => navigate("/my-publications")}>
              Submit publication
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border bg-card">
            <dl className="grid grid-cols-3 divide-x border-b text-center">
              <div className="px-2 py-2">
                <dt className="text-xs text-muted-foreground">Submitted</dt>
                <dd className="text-lg font-semibold tabular-nums">{pubCounts.total}</dd>
              </div>
              <div className="px-2 py-2">
                <dt className="text-xs text-muted-foreground">Pending review</dt>
                <dd className={`text-lg font-semibold tabular-nums ${pubCounts.pending ? "text-amber-700 dark:text-amber-300" : ""}`}>{pubCounts.pending}</dd>
              </div>
              <div className="px-2 py-2">
                <dt className="text-xs text-muted-foreground">Approved</dt>
                <dd className="text-lg font-semibold tabular-nums">{pubCounts.approved}</dd>
              </div>
            </dl>
            <ul className="divide-y">
              {(publications ?? []).slice(0, 3).map((p) => {
                const status = String(p.status).toLowerCase();
                return (
                  <li key={p.id} className="flex items-center gap-2 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-sm font-medium">{p.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{[p.journal, p.year].filter(Boolean).join(" · ")}</p>
                    </div>
                    <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[11px] capitalize">
                      {status === "pending" ? "Pending review" : status}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>
    );

  const historySection =
    isNewStudent && feed.length === 0 ? null : (
      <section className="space-y-3" aria-labelledby="recent-changes-heading">
        <SectionHeader id="recent-changes-heading" icon={Activity} title="Recent changes" />
        {loading && !home ? <ListSkeleton rows={4} /> : <ActivityFeed items={feed} />}
      </section>
    );

  return (
    <PageShell>
      <main className="container mx-auto space-y-6 px-4 py-5 sm:space-y-7">
        <div className="space-y-3">
          <ResearchBreadcrumbs items={[{ label: "Dashboard", to: "/dashboard" }, { label: "My Research" }]} />
          {header}
        </div>

        {blocked ? (
          <EmptyState icon={Lock} title={blocked} />
        ) : homeError && !home ? (
          <InlineError message={homeError} onRetry={() => void loadHome()} />
        ) : (
          <>
            {totalItems > 0 ? (
              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                <div className="relative md:w-80">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search groups and projects…"
                    aria-label="Search groups and projects"
                    className="h-10 pl-9 sm:h-9"
                  />
                </div>
                <FilterChips<Filter> label="Filter My Research" value={filter} onChange={setFilter} options={filterOptions} />
              </div>
            ) : null}
            {isFaculty ? (
              <>
                {reviewBox}
                {groupsSection}
                {workspacesSection}
                {sharedSection}
              </>
            ) : (
              <>
                {groups && showSummaries ? (
                  <MyActivitiesUpdates
                    work={groups.my_work}
                    action={sendGroups.length ? <SendUpdateButton groups={sendGroups} onSent={() => void loadGroups()} /> : undefined}
                  />
                ) : null}
                {getStarted}
                {groupsSection}
                {workspacesSection}
                {showSummaries && home ? <BookingsAndResultsSection projects={activeProjects} onLinked={() => void loadHome()} /> : null}
                {sharedSection}
              </>
            )}
            {showSummaries && (publicationsSection || historySection) ? (
              <div className={`grid gap-6 ${publicationsSection && historySection ? "lg:grid-cols-2" : ""}`}>
                {publicationsSection}
                {historySection}
              </div>
            ) : null}
          </>
        )}
      </main>

      <CreateWorkspaceDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={(ws) => navigate(`/my-research/${ws.id}`)} />
      {groups?.can_create ? (
        <CreateResearchGroupDialog
          open={groupCreateOpen}
          onOpenChange={setGroupCreateOpen}
          onSaved={(g) => navigate(`/my-research/groups/${g.id}`)}
        />
      ) : null}
    </PageShell>
  );
}
